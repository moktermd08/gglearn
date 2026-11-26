import { queryPath } from "@/lib/urlText";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { safeNext } from "@/lib/nextPath";
import { clearViewAsCookie, viewingAs } from "@/lib/impersonation";
import { controlOf, isBlocked } from "@/lib/accountControl";
import { recordSecurityEvent } from "@/lib/securityLog";
import { clientIp } from "@/lib/rate-limit";

const COOKIE = "gglearn_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

/**
 * Cookie = userId.issuedAt.sessionVersion.mac. The server enforces the 30-day lifetime from issuedAt
 * (the cookie's own maxAge is only a hint), and a bumped users.sessionVersion kills older sessions.
 */
export async function startSession(userId: number) {
  const v = db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId)).get()?.v ?? 0;
  const body = `${userId}.${Math.floor(Date.now() / 1000)}.${v}`;
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
  await clearViewAsCookie();
}

/** Signs out every device: all sessions issued before now stop working. */
export function revokeSessions(userId: number) {
  db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)).run();
}

/** The account the session cookie is genuinely for (signature, age and version all checked), whether or not that account is blocked. */
async function sessionUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [id, iat, ver, mac] = parts;
  const expected = sign(`${id}.${iat}.${ver}`);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const age = Math.floor(Date.now() / 1000) - Number(iat);
  if (!(age >= 0 && age < SESSION_TTL_SEC)) return null; // expired (or issued in the future)
  const user = db.select().from(users).where(eq(users.id, Number(id))).get();
  // offboarded people lose access immediately; a bumped version signs out old sessions
  return user && user.status === "active" && user.sessionVersion === Number(ver) ? user : null;
}

/**
 * The person who is actually signed in, whatever they are viewing as. Use this, not currentUser, to know who is really acting.
 * A BLOCKED account is never signed in, however its session or sign-in was obtained: this is the one place every route's session is recognised,
 * so a password, an emailed link, single sign-on, a social sign-in and a contest link are all covered at once (lib/accountControl.ts).
 */
export async function realUser() {
  const user = await sessionUser();
  return user && !isBlocked(user.id) ? user : null;
}

/** For the sign-in page: when this browser holds a genuine session for an account that is now blocked, what the person is told. Otherwise nothing. */
export async function blockedNotice(): Promise<string | null> {
  const user = await sessionUser();
  const c = user ? controlOf(user.id) : undefined;
  return c?.blockedAt != null ? `Your account has been blocked. ${c.blockReason || "Please contact your administrator."}` : null;
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) {
    // send them back to the page they asked for once they have signed in (set by proxy.ts, and only ever a path inside this site)
    const back = safeNext((await headers()).get("x-return-to"));
    redirect(back && !back.startsWith("/login") ? `/login?next=${queryPath(back)}` : "/login");
  }
  return u;
}

export async function requireManager() {
  const u = await requireUser();
  if (u.role === "learner") redirect("/dashboard");
  return u;
}

/**
 * Who the app treats as signed in: the person a super admin is viewing as, when they are, otherwise the person who is really signed in.
 * (The real session is never replaced; see lib/impersonation.ts.)
 */
export async function currentUser() {
  const real = await realUser();
  if (!real) return null;
  const view = await viewingAs(real);
  return view ? view.target : real;
}

/** For the banner: the super admin, who they are viewing as, and when it ends; null when no view-as is on. */
export async function viewAsState() {
  const real = await realUser();
  const view = real ? await viewingAs(real) : null;
  return real && view ? { actor: real, target: view.target, minutesLeft: Math.max(1, Math.ceil((view.expiresAt * 1000 - Date.now()) / 60000)) } : null;
}

/** Actions that would lock someone out or take over their account call this first: true means refuse. */
export async function refuseWhileViewingAs(): Promise<boolean> {
  return (await viewAsState()) !== null;
}

/**
 * For an action a learner may take on their own account, which is therefore also allowed while a super admin is viewing as them (their CV, notes,
 * replies, settings). Returns who the action is done as, and, when it is done through a view, the super admin who is really doing it. Nothing
 * here widens what a person may do: it is the viewed person's own power, used by the person who is viewing as them.
 * The things that would lock someone out or take over their account (password, email, sign-out everywhere, offboarding) are NOT done through
 * this: they call refuseWhileViewingAs and stay refused.
 */
export async function actingUser() {
  const me = await requireUser();
  const view = await viewAsState();
  if (view) return { me, viewedBy: view.actor };
  const real = await realUser();
  return real && real.id === me.id ? { me, viewedBy: null } : null;
}

/** Every use of someone's account through a view is written to the security log under the REAL person, with what was done. */
export async function logViewAsUse(viewedBy: { id: number } | null, me: { id: number }, what: string) {
  if (viewedBy) recordSecurityEvent({ actorId: viewedBy.id, targetId: me.id, action: "viewas_action", detail: what, ip: await clientIp() });
}

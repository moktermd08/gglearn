import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { safeNext } from "@/lib/nextPath";
import { clearViewAsCookie, viewingAs } from "@/lib/impersonation";

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

/** The person who is actually signed in, whatever they are viewing as. Use this, not currentUser, to know who is really acting. */
export async function realUser() {
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

export async function requireUser() {
  const u = await currentUser();
  if (!u) {
    // send them back to the page they asked for once they have signed in (set by proxy.ts, and only ever a path inside this site)
    const back = safeNext((await headers()).get("x-return-to"));
    redirect(back && !back.startsWith("/login") ? `/login?next=${encodeURIComponent(back)}` : "/login");
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

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { isSuperAdmin } from "@/lib/superAdmin";
import { recordSecurityEvent } from "@/lib/securityLog";
import { allowed, clientIp, hit } from "@/lib/rate-limit";

/**
 * "View as": a super admin uses the app as another person, to see what they see or fix their setup.
 *
 * How it stays safe:
 *  - It rides on top of the super admin's own session and never replaces it. A second cookie says "this super admin is viewing as that
 *    person". It only counts while the real session is a valid super admin session for the same person, so signing out, or revoking the
 *    super admin's sessions, ends it at once. Exit just removes the second cookie.
 *  - The cookie is signed (HMAC, with a prefix that keeps it from ever being read as a session cookie), bound to the super admin, the
 *    person, and the super admin's session version, and expires after an hour whatever else happens.
 *  - Only a super admin can start it; not on themselves, not on another super admin, not on someone who is offboarded, and not from
 *    inside another view-as. A reason is required and kept with every start and end in the security log.
 *  - While it runs, the things that would lock the person out or take over the account (password, sign-out, offboarding, email, starting
 *    another view-as) are refused (see `refuseWhileViewingAs` in lib/auth.ts).
 */
const COOKIE = "gglearn_viewas";
export const VIEWAS_TTL_SEC = 60 * 60;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const mac = (body: string) => createHmac("sha256", secret()).update(`viewas:${body}`).digest("hex");

export type ViewAsToken = { actorId: number; targetId: number; iat: number; ver: number };

export function makeToken(t: ViewAsToken): string {
  const body = `${t.actorId}.${t.targetId}.${t.iat}.${t.ver}`;
  return `${body}.${mac(body)}`;
}

/** The token if it is well formed, correctly signed and not expired; otherwise null. */
export function readToken(raw: string | undefined | null, nowSec = Math.floor(Date.now() / 1000)): ViewAsToken | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 5) return null;
  const [a, t, i, v, m] = parts;
  const expected = mac(`${a}.${t}.${i}.${v}`);
  if (m.length !== expected.length || !timingSafeEqual(Buffer.from(m), Buffer.from(expected))) return null;
  const tok = { actorId: Number(a), targetId: Number(t), iat: Number(i), ver: Number(v) };
  if (![tok.actorId, tok.targetId, tok.iat, tok.ver].every(Number.isInteger)) return null;
  const age = nowSec - tok.iat;
  return age >= 0 && age < VIEWAS_TTL_SEC ? tok : null;
}

type Real = { id: number; email: string; role: string; status: string; sessionVersion: number };

/** Who the signed-in super admin is currently viewing as, or null. `real` must be the person's own session user. */
export async function viewingAs(real: Real): Promise<{ target: typeof users.$inferSelect; expiresAt: number } | null> {
  if (!isSuperAdmin(real)) return null;
  const tok = readToken((await cookies()).get(COOKIE)?.value);
  if (!tok || tok.actorId !== real.id || tok.ver !== real.sessionVersion) return null;
  const target = db.select().from(users).where(eq(users.id, tok.targetId)).get();
  if (!target || target.status !== "active" || target.id === real.id || isSuperAdmin(target)) return null;
  return { target, expiresAt: tok.iat + VIEWAS_TTL_SEC };
}

/** Why a super admin may not view as this person, or null when they may. */
export function whyNotViewAs(actor: Real, target: { id: number; email: string; role: string; status: string } | undefined): string | null {
  if (!isSuperAdmin(actor)) return "Only a super admin can view as someone else.";
  if (!target) return "That person does not exist.";
  if (target.id === actor.id) return "That is you.";
  if (target.status !== "active") return "That person is offboarded.";
  if (isSuperAdmin(target)) return "You cannot view as another super admin.";
  return null;
}

/** Starts viewing as `targetId`. Returns why it was refused, or null when it is on. `actor` must be the real session user. */
export async function startViewAs(actor: Real, targetId: number, reason: string, alreadyViewing: boolean): Promise<string | null> {
  if (alreadyViewing) return "Exit the current view first.";
  const why = reason.trim().replace(/\s+/g, " ");
  if (why.length < 8) return "Say why in at least 8 characters. It is kept in the security log.";
  const key = `viewas:${actor.id}`;
  if (!allowed(key, 20)) return "Too many view-as sessions this hour.";
  const target = db.select().from(users).where(eq(users.id, targetId)).get();
  const no = whyNotViewAs(actor, target);
  if (no) return no;
  hit(key, 60 * 60 * 1000);
  recordSecurityEvent({ actorId: actor.id, targetId, action: "impersonate_start", detail: why.slice(0, 200), ip: await clientIp() });
  (await cookies()).set(COOKIE, makeToken({ actorId: actor.id, targetId, iat: Math.floor(Date.now() / 1000), ver: actor.sessionVersion }), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: VIEWAS_TTL_SEC, secure: process.env.NODE_ENV === "production",
  });
  return null;
}

/** Ends viewing as someone, and records it. Safe to call when nothing is on. Returns who was being viewed. */
export async function stopViewAs(real: Real | null): Promise<number | null> {
  const jar = await cookies();
  const tok = readToken(jar.get(COOKIE)?.value);
  jar.delete(COOKIE);
  if (!real || !tok || tok.actorId !== real.id) return null;
  recordSecurityEvent({ actorId: real.id, targetId: tok.targetId, action: "impersonate_end", ip: await clientIp() });
  return tok.targetId;
}

export const clearViewAsCookie = async () => { (await cookies()).delete(COOKIE); };

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, users } from "@/lib/db";

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
}

/** Signs out every device: all sessions issued before now stop working. */
export function revokeSessions(userId: number) {
  db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)).run();
}

export async function currentUser() {
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
  if (!u) redirect("/login");
  return u;
}

export async function requireManager() {
  const u = await requireUser();
  if (u.role === "learner") redirect("/dashboard");
  return u;
}

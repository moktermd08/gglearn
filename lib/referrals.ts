import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, runs, users } from "@/lib/db";

/**
 * Personal invite links. A person's code is their id plus a short signature, so nothing is stored and a code cannot be guessed or made up
 * for someone else: ${id in base 36}-${first 10 characters of HMAC(secret, "ref:" + id)}. Anyone who creates an account through a link that
 * carries the code is recorded as brought in by that person. The reward is a badge and it only counts a friend once they have passed a
 * level by exam, so an account made just to be counted earns nothing.
 */
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (id: number) => createHmac("sha256", secret()).update(`ref:${id}`).digest("base64url").slice(0, 10);

export const referralCode = (userId: number) => `${userId.toString(36)}-${sign(userId)}`;

/** Splits a code into the person's id and the signature, or null when it does not have that shape. Pure, so it can be tested without a database. */
export function splitCode(code: string | null | undefined): { id: number; sig: string } | null {
  if (!code || code.length > 30 || !/^[0-9a-z]+-[A-Za-z0-9_-]{10}$/.test(code)) return null;
  // the signature is base64url and may itself contain "-", so split at the first dash only
  const dash = code.indexOf("-"), id = parseInt(code.slice(0, dash), 36);
  return Number.isSafeInteger(id) && id >= 1 ? { id, sig: code.slice(dash + 1) } : null;
}

/** The person a code belongs to, or null when it is not a real code or that person no longer exists. */
export function referrerOf(code: string | null | undefined): number | null {
  const parts = splitCode(code);
  if (!parts) return null;
  const want = Buffer.from(sign(parts.id)), got = Buffer.from(parts.sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return db.select({ id: users.id }).from(users).where(eq(users.id, parts.id)).get()?.id ?? null;
}

/** Friends this person brought in: how many joined, and how many of those have passed a level by exam. */
export function referralsOf(userId: number): { joined: number; passed: number } {
  const joined = db.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.referredBy, userId)).get()?.n ?? 0;
  const passed = db.select({ n: sql<number>`count(distinct ${users.id})` }).from(users)
    .innerJoin(runs, and(eq(runs.userId, users.id), eq(runs.passed, true), isNotNull(runs.finishedAt)))
    .where(eq(users.referredBy, userId)).get()?.n ?? 0;
  return { joined: Number(joined), passed: Number(passed) };
}

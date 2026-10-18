import { and, eq, gt, isNull } from "drizzle-orm";
import { db, loginLinks, users } from "@/lib/db";
import { hashToken, newToken } from "@/lib/invites";

/**
 * Sign in without a password, by email. Asking for a link never says whether the address has an account. The token is random, kept only as a
 * hash, works once and lasts LOGIN_LINK_TTL_SEC; asking again cancels the earlier link. Only active accounts can use one.
 * Opening the link does NOT sign anyone in: mail scanners open every link in a message, so `peek` only looks, and the person presses a button
 * on that page, which calls `spend`. Signing in this way leaves the person's other sessions and their password alone.
 */
export const LOGIN_LINK_TTL_SEC = 15 * 60;
const nowSec = () => Math.floor(Date.now() / 1000);

/** Makes a link for this address if it belongs to an active account. Returns the token, or null (the caller must not reveal which). */
export function startLoginLink(email: string): { token: string; userId: number; email: string } | null {
  const u = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
  if (!u || u.status !== "active") return null;
  db.update(loginLinks).set({ usedAt: nowSec() }).where(and(eq(loginLinks.userId, u.id), isNull(loginLinks.usedAt))).run(); // only the newest link works
  const token = newToken();
  db.insert(loginLinks).values({ userId: u.id, tokenHash: hashToken(token), expiresAt: nowSec() + LOGIN_LINK_TTL_SEC }).run();
  return { token, userId: u.id, email: u.email };
}

/** Looks at a link without using it: who it is for (first name only), or null when it is not open. Safe for a page to call on every visit. */
export function peekLoginLink(token: string): { userId: number; firstName: string } | null {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = db.select().from(loginLinks).where(and(eq(loginLinks.tokenHash, hashToken(token)), isNull(loginLinks.usedAt), gt(loginLinks.expiresAt, nowSec()))).get();
  if (!r) return null;
  const u = db.select({ id: users.id, name: users.name, status: users.status }).from(users).where(eq(users.id, r.userId)).get();
  return u && u.status === "active" ? { userId: u.id, firstName: u.name.trim().split(/\s+/)[0] || "you" } : null;
}

/** Uses the link: claims it first, so two presses cannot both succeed. Returns who may now be signed in, or null. */
export function spendLoginLink(token: string): number | null {
  const open = peekLoginLink(token);
  if (!open) return null;
  const claimed = db.update(loginLinks).set({ usedAt: nowSec() }).where(and(eq(loginLinks.tokenHash, hashToken(token)), isNull(loginLinks.usedAt))).run();
  return claimed.changes ? open.userId : null;
}

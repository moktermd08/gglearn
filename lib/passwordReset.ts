import { and, eq, gt, isNull } from "drizzle-orm";
import { db, passwordResets, users } from "@/lib/db";
import { hashToken, newToken } from "@/lib/invites";
import { revokeSessions } from "@/lib/auth";

/**
 * Forgotten passwords, by email. Asking for a link never says whether the address has an account (the page and the timing are the same either
 * way). The link's token is random, kept only as a hash, works once and expires after RESET_TTL_SEC; asking again cancels the earlier link.
 * Using it sets the new password and signs the person out everywhere else. Only active accounts can be reset: someone who has left cannot get back in.
 */
export const RESET_TTL_SEC = 60 * 60, MIN_PASSWORD = 8;
const nowSec = () => Math.floor(Date.now() / 1000);

/** Makes a link for this address if it belongs to an active account. Returns the token and who it is for, or null (the caller must not reveal which). */
export function startReset(email: string): { token: string; userId: number; email: string; name: string } | null {
  const u = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
  if (!u || u.status !== "active") return null;
  db.update(passwordResets).set({ usedAt: nowSec() }).where(and(eq(passwordResets.userId, u.id), isNull(passwordResets.usedAt))).run(); // only the newest link works
  const token = newToken();
  db.insert(passwordResets).values({ userId: u.id, tokenHash: hashToken(token), expiresAt: nowSec() + RESET_TTL_SEC }).run();
  return { token, userId: u.id, email: u.email, name: u.name };
}

/** The reset behind a token, only while it is unused and unexpired and its account is still active. */
export function findOpenReset(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, nowSec()))).get();
  if (!r) return null;
  const u = db.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, r.userId)).get();
  return u && u.status === "active" ? r : null;
}

/**
 * Spends the token and sets the password, in one step: the token is claimed first and only the claim that wins goes on, so two clicks cannot both
 * succeed. Every other session of the person ends. Returns who it was, or null when the link was already used, expired or never real.
 */
export function finishReset(token: string, passwordHash: string): number | null {
  const r = findOpenReset(token);
  if (!r) return null;
  const claimed = db.update(passwordResets).set({ usedAt: nowSec() }).where(and(eq(passwordResets.id, r.id), isNull(passwordResets.usedAt))).run();
  if (!claimed.changes) return null;
  db.update(users).set({ passwordHash }).where(eq(users.id, r.userId)).run();
  revokeSessions(r.userId);
  return r.userId;
}

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, users } from "@/lib/db";

/**
 * A "just looking" account: what someone gets when they start the route check without signing up. It is a real user row, so everything they
 * do (answers, plan, ticked steps) is kept, but it has no password and an address that can never receive mail. Adding an email and a
 * password later (claimAnonymous) turns the very same row into a normal account, so nothing they did is lost.
 */
const DOMAIN = "guest.invalid";

export const isAnonymous = (u: { email: string }) => u.email.endsWith(`@${DOMAIN}`);

export function createAnonymous() {
  return db.insert(users).values({
    name: "Guest", email: `${randomUUID()}@${DOMAIN}`, passwordHash: "", jobRole: "general", audience: "staff", guest: "yes", seasonBoard: "hide",
  }).returning().get();
}

/** Gives an anonymous account its name, email and password. False when the email already belongs to someone else. */
export function claimAnonymous(userId: number, who: { name: string; email: string; passwordHash: string }): boolean {
  const email = who.email.toLowerCase();
  const taken = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (taken) return false;
  const done = db.update(users).set({ name: who.name, email, passwordHash: who.passwordHash }).where(and(eq(users.id, userId), eq(users.passwordHash, ""))).returning({ id: users.id }).get();
  return !!done;
}

import { db, userScopes, users } from "@/lib/db";
import { isAnonymous } from "@/lib/anonymous";

/**
 * People who registered on their own and belong to no company, brand or project. Tenancy puts them in nobody's reach but the platform owner's,
 * and on a live academy nobody may be the owner, so they would never be seen. An admin (not a manager) may therefore see them and place them
 * in a company, brand or project they run. That is all: once placed they are in reach like anyone else, and until then nothing else
 * (sign-in as them, passwords, offboarding, notes) is open to anyone but the owner.
 */
export type Claimable = { role: string; status: string; email: string };

/** Someone who may be claimed: a real, active learner account (not a manager or admin, not a "just looking" guest). */
export const isClaimable = (u: Claimable) => u.role === "learner" && u.status === "active" && !isAnonymous(u);

/** Only an admin may claim; a manager may not. */
export const mayClaim = (me: { role: string }) => me.role === "admin";

/** Ids of the unplaced people an admin may claim. */
export function claimableIds(): Set<number> {
  const placed = new Set(db.select({ u: userScopes.userId }).from(userScopes).all().map((r) => r.u));
  return new Set(db.select().from(users).all().filter((u) => !placed.has(u.id) && isClaimable(u)).map((u) => u.id));
}

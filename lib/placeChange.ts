import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { noteMembershipChange } from "@/lib/membership";
import { type Scope, scopesOf, setScopes, syncRequired } from "@/lib/paths";
import { isGlobal, reachOf, scopeInReach, userInReach } from "@/lib/tenancy";

/**
 * Moves a person to a new set of companies, brands and projects, and enrols them in what that makes required. Returns why it was refused, or null when done.
 * The rules are the ones the People page always had: the person must be active and someone this manager runs; the new places must all be ones the manager
 * runs; and only the platform owner may leave a manager or admin with no places (someone with none runs the whole academy). `next` must already be validScopes.
 */
export function changePlaces(meId: number, userId: number, next: Scope[]): string | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.status !== "active") return "That person is not active.";
  const reach = reachOf(meId);
  if (!userInReach(reach, u.id)) return "You do not run that person.";
  if (!isGlobal(reach)) {
    if (next.some((s) => !scopeInReach(reach, s))) return "You can only place people in the companies, brands and projects you run.";
    if (!next.length && u.role !== "learner") return "A manager or admin must belong to something. With none, they would run the whole academy.";
  }
  const before = scopesOf(u.id);
  db.transaction((tx) => {
    setScopes(tx, u.id, next);
    syncRequired(u, tx);
  });
  noteMembershipChange(u.id, before, next); // tells them if the set of companies they belong to changed, and what that means for them
  return null;
}

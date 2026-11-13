import { db, userScopes, users } from "@/lib/db";
import type { Scope } from "@/lib/paths";
import { type Reach, personInReach, reachFor, structure } from "@/lib/tenancy";

/**
 * Head-counts for the admin: how many people there are in everything this person runs, in each company (or brand) of it,
 * and how many registered without being placed anywhere.
 *
 * A person who belongs to two companies counts under both, so the parts can add up to more than the whole. People with no
 * company, brand or project (they registered on their own, or came in by single sign-on) belong to no company's list: only
 * the platform owner (reach "all") can see or place them, so only the owner is told how many there are.
 */
export type Place = { kind: "company" | "brand"; id: number };
export type Headcount = {
  total: number; // everyone in this reach
  active: number;
  unplaced: number; // owner only: registered but not in any company, brand or project (0 for anyone else)
  of: Map<string, number>; // "company:3" -> people in it, for each place asked about
};

export function headcount(reach: Reach, places: Place[]): Headcount {
  const everyone = db.select({ id: users.id, status: users.status }).from(users).all();
  const by = new Map<number, Scope[]>();
  for (const s of db.select().from(userScopes).all()) by.set(s.userId, [...(by.get(s.userId) ?? []), { kind: s.kind, id: s.refId }]);
  const st = structure();
  const inReach = (id: number) => reach.all || personInReach(reach, by.get(id) ?? [], st);
  const mine = everyone.filter((u) => inReach(u.id));
  const of = new Map<string, number>();
  for (const p of places) {
    const r = reachFor([p]);
    of.set(`${p.kind}:${p.id}`, mine.filter((u) => personInReach(r, by.get(u.id) ?? [], st)).length);
  }
  return {
    total: mine.length,
    active: mine.filter((u) => u.status === "active").length,
    unplaced: reach.all ? everyone.filter((u) => !by.has(u.id)).length : 0,
    of,
  };
}

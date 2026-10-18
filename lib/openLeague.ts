import { and, eq, inArray, isNull } from "drizzle-orm";
import { companies, db, leagueEntries, users } from "@/lib/db";
import { arenaMap, arenaOfUser, OPEN, type Arena } from "@/lib/arena";
import { periodAt } from "@/lib/seasons";

/**
 * The cross-company league. Normally the weekly league keeps a company's people together in that company's arena (lib/arena.ts). Playing against other
 * companies needs two yeses: the company allows it (`companies.leagueOpen`, set by an admin who runs it) AND the person chooses it (`users.openLeague`).
 * Only people with both are moved into one shared arena, "x"; everyone else stays where they were. What the others in that arena see of a person is the same
 * as in any league: first name, an initial and points, never the company. While in it, a person is not in their own company's league, so it is an either-or
 * choice, and it is stated as such. Turning it off (either side) takes effect at once: the person's unsettled place this week is dropped and they are placed
 * again in their own company's league the next time they score (points are worked out from real activity, so nothing is lost).
 * Only people who belong to exactly one company can use it: anyone else is already in the open arena and has no company to ask.
 */
export const CROSS: Arena = "x";

type Me = { id: number };
/** The one company this person belongs to, with whether it allows the cross-company league; null when they have no single company. */
function companyOf(userId: number): { id: number; allows: boolean } | null {
  const a = arenaOfUser(userId);
  if (a === OPEN || a === CROSS) return null;
  const id = Number(a.slice(1)), c = db.select({ o: companies.leagueOpen }).from(companies).where(eq(companies.id, id)).get();
  return c ? { id, allows: c.o === "yes" } : null;
}

export type Offer = { available: boolean; why: "single-company" | "company-off" | null; on: boolean };
/** What a person may do about the cross-company league, for the page. `on` is only true when it is really in effect. */
export function offerFor(userId: number): Offer {
  const c = companyOf(userId), chose = db.select({ o: users.openLeague }).from(users).where(eq(users.id, userId)).get()?.o === "yes";
  if (!c) return { available: false, why: "single-company", on: false };
  if (!c.allows) return { available: false, why: "company-off", on: false };
  return { available: true, why: null, on: chose };
}

/** Is this person playing in the cross-company arena now? */
export const inCross = (userId: number) => offerFor(userId).on;

/** The arenas the league uses: the usual ones, except that people who are in the cross-company league are in "x". */
export function leagueArenaMap(): Map<number, Arena> {
  const map = arenaMap();
  const open = new Set(db.select({ id: companies.id }).from(companies).where(eq(companies.leagueOpen, "yes")).all().map((c) => `c${c.id}`));
  if (!open.size) return map;
  for (const u of db.select({ id: users.id }).from(users).where(eq(users.openLeague, "yes")).all()) if (open.has(map.get(u.id) ?? "")) map.set(u.id, CROSS);
  return map;
}
export const leagueArenaOf = (userId: number): Arena => (inCross(userId) ? CROSS : arenaOfUser(userId));

/** Drops someone's unsettled place in this week's league, so they are placed again, in whichever arena now applies, when they next score. */
function replace(userIds: number[]) {
  if (!userIds.length) return;
  db.delete(leagueEntries).where(and(eq(leagueEntries.key, periodAt("week").key), isNull(leagueEntries.outcome), inArray(leagueEntries.userId, userIds))).run();
}

export type Result = { ok: true } | { error: string };
/** A person chooses (or stops) playing against other companies. Joining needs their company to allow it. */
export function setPersonOptIn(me: Me, on: boolean): Result {
  if (on && !offerFor(me.id).available) return { error: "Your company has not switched the cross-company league on." };
  db.update(users).set({ openLeague: on ? "yes" : "no" }).where(eq(users.id, me.id)).run();
  replace([me.id]);
  return { ok: true };
}

/** A company's policy. Everyone in it who had chosen the cross-company league is moved at once; switching it off also withdraws their choice. */
export function setCompanyPolicy(companyId: number, allow: boolean) {
  db.update(companies).set({ leagueOpen: allow ? "yes" : "no" }).where(eq(companies.id, companyId)).run();
  const map = arenaMap(), chosen = db.select({ id: users.id }).from(users).where(eq(users.openLeague, "yes")).all().map((u) => u.id).filter((id) => map.get(id) === `c${companyId}`);
  // switching it off also withdraws their choice: if the company allows it again later, nobody is put back in without saying yes again
  if (!allow && chosen.length) db.update(users).set({ openLeague: "no" }).where(inArray(users.id, chosen)).run();
  replace(chosen);
}

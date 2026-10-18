/** Checks the weekly league: npm run check:league (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows, in made-up weeks). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { db, leagueEntries, notifications, users } from "../lib/db";
import { COHORT_SIZE, MAX_TIER, MIN_FOR_DEMOTION, cohortFor, movesFor, nextTier, outcomesFor, rankCohort, standingNote } from "../lib/leagueRules";
import { currentTier, ensureEntry, settleLeagueGroup } from "../lib/league";
import type { Row } from "../lib/seasons";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- the rules ----
check("one person alone moves nowhere", JSON.stringify(movesFor(1)) === JSON.stringify({ up: 0, down: 0 }));
check("two people: one can climb, nobody is relegated", JSON.stringify(movesFor(2)) === JSON.stringify({ up: 1, down: 0 }));
check("a small cohort is protected from relegation", movesFor(MIN_FOR_DEMOTION - 1).down === 0 && movesFor(MIN_FOR_DEMOTION).down === 1);
check("a full cohort moves a fifth each way", JSON.stringify(movesFor(COHORT_SIZE)) === JSON.stringify({ up: 6, down: 6 }));
check("it never moves everyone, and someone is always left in the middle", [2, 3, 4, 5, 6, 7, 10, 30].every((n) => { const m = movesFor(n); return m.up + m.down <= n - 1; }));

const cohort = (points: number[]) => rankCohort(points.map((p, i) => ({ userId: i + 1, points: p })));
const o = (points: number[], tier: number) => outcomesFor(cohort(points), tier);
const ten = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
const t1 = o(ten, 3);
check("the top fifth go up and the bottom fifth go down", [1, 2].every((u) => t1.get(u) === "up") && [9, 10].every((u) => t1.get(u) === "down") && [3, 4, 5, 6, 7, 8].every((u) => t1.get(u) === "stay"));
check("Bronze cannot go down", [9, 10].every((u) => o(ten, 0).get(u) === "stay"));
check("the top tier cannot go up", [1, 2].every((u) => o(ten, MAX_TIER).get(u) === "stay"));
check("nobody is promoted on zero points", [...o([0, 0, 0, 0, 0, 0], 2).values()].every((v) => v !== "up"));
check("someone who scored nothing is relegated before someone who scored", o([50, 40, 30, 20, 0], 2).get(5) === "down" && o([50, 40, 30, 20, 0], 2).get(4) === "stay");
check("ties are ranked in the order given", cohort([5, 5, 5]).map((r) => r.userId).join() === "1,2,3");
check("moving up and down clamps at the ends", nextTier(MAX_TIER, "up") === MAX_TIER && nextTier(0, "down") === 0 && nextTier(3, "up") === 4 && nextTier(3, "down") === 2 && nextTier(3, "stay") === 3 && nextTier(3, null) === 3);
check("a new person goes in the lowest cohort with room", cohortFor(new Map()) === 1 && cohortFor(new Map([[1, COHORT_SIZE], [2, 4]])) === 2 && cohortFor(new Map([[1, 10], [2, 4]])) === 1);
check("a full set of cohorts starts a new one", cohortFor(new Map([[1, COHORT_SIZE], [2, COHORT_SIZE]])) === 3);
const at = (r: number) => ten[r - 1] ?? null;
check("the note tells someone in the zone to hold", /promotion zone/.test(standingNote(1, 10, 100, 3, at)) && /Hold your place/.test(standingNote(1, 10, 100, 3, at)));
check("...and someone in danger how many points clear them", /relegation zone\. \d+ more points? gets you clear/.test(standingNote(10, 10, 10, 3, at)));
check("...and someone in the middle how far the promotion zone is", /more points? puts you in the promotion zone/.test(standingNote(5, 10, 60, 3, at)));
check("someone with no points is told how to start", /Score a point/.test(standingNote(10, 10, 0, 3, at)));

// ---- settling weeks ----
const KEY1 = "2099-W01", KEY2 = "2099-W02", ARENA = "check-arena";
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@league.check")).all().map((r) => r.id);
  if (us.length) { db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(leagueEntries).where(inArray(leagueEntries.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
};
sweep();
try {
  const mk = (n: number) => db.insert(users).values({ name: `Player ${n}`, email: `p${n}@league.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const people = Array.from({ length: 12 }, (_, i) => mk(i + 1));
  const rowsFor = (key: string): Row[] => people.map((u, i) => ({ userId: u.id, name: u.name, points: 1200 - i * 100, levels: 12 - i, days: 0, lastAt: 1000 + i, rank: i + 1 }));
  const entry = (u: number, key: string) => db.select().from(leagueEntries).where(and(eq(leagueEntries.userId, u), eq(leagueEntries.key, key))).get()!;

  settleLeagueGroup(KEY1, "staff", ARENA, rowsFor(KEY1), true);
  check("everyone who scored is placed, in Bronze, in one cohort", people.every((u) => entry(u.id, KEY1).tier === 0 && entry(u.id, KEY1).cohort === 1));
  check("ranks and points are written", entry(people[0].id, KEY1).rank === 1 && entry(people[0].id, KEY1).points === 1200 && entry(people[11].id, KEY1).rank === 12);
  check("the top two went up; Bronze has nobody to go down", [0, 1].every((i) => entry(people[i].id, KEY1).outcome === "up") && [10, 11].every((i) => entry(people[i].id, KEY1).outcome === "stay"));
  check("next week's tier is read from the result", currentTier(people[0].id) === 1 && currentTier(people[1].id) === 1 && currentTier(people[2].id) === 0);
  check("a promotion is announced", db.select().from(notifications).where(and(eq(notifications.userId, people[0].id), like(notifications.key, "league-%"))).all().length === 1);
  check("a person who stays is not nagged", db.select().from(notifications).where(and(eq(notifications.userId, people[5].id), like(notifications.key, "league-%"))).all().length === 0);

  settleLeagueGroup(KEY1, "staff", ARENA, rowsFor(KEY1), true);
  check("settling the same week again changes nothing", entry(people[0].id, KEY1).outcome === "up" && db.select().from(notifications).where(and(eq(notifications.userId, people[0].id), like(notifications.key, "league-%"))).all().length === 1);

  // week two: the two climbers form their own small Silver cohort; the rest stay in Bronze
  settleLeagueGroup(KEY2, "staff", ARENA, rowsFor(KEY2), true);
  check("climbers play in the tier above, apart from the rest", entry(people[0].id, KEY2).tier === 1 && entry(people[0].id, KEY2).cohort === 1 && entry(people[5].id, KEY2).tier === 0);
  check("a cohort of two lets the leader climb and nobody drop", entry(people[0].id, KEY2).outcome === "up" && entry(people[1].id, KEY2).outcome === "stay");
  check("two weeks on, the leader is two tiers up", currentTier(people[0].id) === 2 && currentTier(people[1].id) === 1);

  // someone who looked but never scored, in a tier above Bronze, is last and drops
  const KEY3 = "2099-W03";
  const idle = mk(99), gold = Array.from({ length: 6 }, (_, i) => mk(100 + i));
  for (const u of [idle, ...gold]) db.insert(leagueEntries).values({ key: "2099-W00", audience: "staff", arena: ARENA, userId: u.id, tier: 2, cohort: 1, points: 10, rank: 3, outcome: "stay" }).run();
  for (const u of [idle, ...gold]) ensureEntry(u.id, KEY3, "staff", ARENA);
  settleLeagueGroup(KEY3, "staff", ARENA, gold.map((u, i) => ({ userId: u.id, name: u.name, points: 600 - i * 100, levels: 6 - i, days: 0, lastAt: 1000 + i, rank: i + 1 })), false);
  check("someone placed but with no points finishes last and drops a tier", entry(idle.id, KEY3).rank === 7 && entry(idle.id, KEY3).points === 0 && entry(idle.id, KEY3).outcome === "down" && currentTier(idle.id) === 1);
  check("with announcements off nobody is notified", db.select().from(notifications).where(and(eq(notifications.userId, idle.id), like(notifications.key, "league-%"))).all().length === 0);

  // cohorts never overfill
  const many = Array.from({ length: COHORT_SIZE * 2 + 5 }, (_, i) => mk(200 + i));
  for (const u of many) ensureEntry(u.id, "2099-W09", "staff", ARENA + "-big");
  const sizes = new Map<number, number>();
  for (const u of many) { const c = entry(u.id, "2099-W09").cohort; sizes.set(c, (sizes.get(c) ?? 0) + 1); }
  check("65 people fill two full cohorts and a third of five", sizes.get(1) === COHORT_SIZE && sizes.get(2) === COHORT_SIZE && sizes.get(3) === 5 && sizes.size === 3);
  check("asking again puts nobody in twice", ensureEntry(many[0].id, "2099-W09", "staff", ARENA + "-big").id === entry(many[0].id, "2099-W09").id);
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@league.check")).all().length === 0 && db.select().from(leagueEntries).where(like(leagueEntries.key, "2099-%")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

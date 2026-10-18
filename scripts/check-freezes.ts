/** Checks streak freezes: npm run check:freezes (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { dailyQuests, db, notifications, streakFreezes, tracks, users } from "../lib/db";
import { MAX_FREEZES, activityDays, freezesHeld, frozenDays, grantsDue, planFreeze, runEndingAt, syncFreezes } from "../lib/freezes";
import { factsOf, streakOf } from "../lib/progression";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const S = (...d: string[]) => new Set(d);
const dayN = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => dayN(a + i));

// ---- the rules, with no database ----
check("a run is the unbroken days ending on a day", JSON.stringify(runEndingAt(S(...range(21, 27)), dayN(27))) === JSON.stringify({ length: 7, start: dayN(21) }));
check("a gap ends the run", runEndingAt(S(dayN(20), ...range(22, 27)), dayN(27)).length === 6);

check("one missed day after a streak is covered", JSON.stringify(planFreeze({ active: S(dayN(26), dayN(27)), today: dayN(29), held: 1 })) === JSON.stringify([dayN(28)]));
check("with no freeze, nothing is covered", planFreeze({ active: S(dayN(26), dayN(27)), today: dayN(29), held: 0 }).length === 0);
check("nothing is covered while today is still open and yesterday was kept", planFreeze({ active: S(dayN(26), dayN(27), dayN(28)), today: dayN(29), held: 2 }).length === 0);
check("nothing is covered once they have done something today", planFreeze({ active: S(dayN(26), dayN(27), dayN(29)), today: dayN(29), held: 2 }).length === 0);
check("a streak of one day is not worth a freeze", planFreeze({ active: S(dayN(27)), today: dayN(29), held: 2 }).length === 0);
check("two missed days need two freezes", planFreeze({ active: S(dayN(25), dayN(26)), today: dayN(29), held: 2 }).length === 2 && planFreeze({ active: S(dayN(25), dayN(26)), today: dayN(29), held: 1 }).length === 0);
check("it is all or nothing: a gap it cannot cover spends nothing", planFreeze({ active: S(dayN(20), dayN(21)), today: dayN(29), held: 2 }).length === 0);
check("someone who never did anything gets nothing", planFreeze({ active: S(), today: dayN(29), held: 2 }).length === 0);

check("the first activity earns the welcome freeze", JSON.stringify(grantsDue({ active: S(dayN(27)), raw: S(dayN(27)), today: dayN(28), paid: S(), held: 0 })) === JSON.stringify(["welcome"]));
check("the welcome freeze is only paid once", grantsDue({ active: S(dayN(27)), raw: S(dayN(27)), today: dayN(28), paid: S("welcome"), held: 0 }).length === 0);
const week = S(...range(21, 27));
check("seven days in a row earn another", grantsDue({ active: week, raw: week, today: dayN(28), paid: S("welcome"), held: 0 }).join() === `s7:${dayN(21)}:7`);
check("six days do not", grantsDue({ active: S(...range(22, 27)), raw: S(...range(22, 27)), today: dayN(28), paid: S("welcome"), held: 0 }).length === 0);
const month = S(...range(1, 28));
check("a long streak earns one per week, as there is room", grantsDue({ active: month, raw: month, today: dayN(29), paid: S("welcome"), held: 0 }).length === 2);
check("nobody holds more than the maximum", grantsDue({ active: month, raw: month, today: dayN(29), paid: S(), held: 0 }).length === MAX_FREEZES && grantsDue({ active: month, raw: month, today: dayN(29), paid: S(), held: MAX_FREEZES }).length === 0);
check("an already-paid milestone is not paid twice", grantsDue({ active: week, raw: week, today: dayN(28), paid: S("welcome", `s7:${dayN(21)}:7`), held: 0 }).length === 0);

// ---- the ledger ----
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@freeze.check")).all().map((r) => r.id);
  if (us.length) { db.delete(streakFreezes).where(inArray(streakFreezes.userId, us)).run(); db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
};
sweep();
try {
  const track = db.select().from(tracks).get()!;
  const mk = (n: string) => db.insert(users).values({ name: n, email: `${n}@freeze.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const quest = (u: number, days: string[]) => { for (const d of days) db.insert(dailyQuests).values({ userId: u, trackId: track.id, day: d, kind: "drill", xp: 30 }).run(); };

  // a seven-day streak, then one missed day
  const a = mk("a"); quest(a.id, range(21, 27));
  const r1 = syncFreezes(a.id, dayN(29));
  check("a week's streak earns the welcome freeze and a milestone freeze", r1.granted.length === 2 && r1.granted.includes("welcome") && r1.granted.some((k) => k.startsWith("s7:")));
  check("the missed day is covered by one of them", r1.used.join() === dayN(28) && frozenDays(a.id).has(dayN(28)) && freezesHeld(a.id) === 1);
  const f = factsOf(a.id);
  check("the streak carries on through the frozen day", streakOf(f.days, dayN(29), frozenDays(a.id)).current === 8);
  check("...and the frozen day is marked", streakOf(f.days, dayN(29), frozenDays(a.id)).week.some((w) => w.day === dayN(28) && w.frozen));
  check("a frozen day is not counted as practice", !activityDays(a.id).has(dayN(28)) && activityDays(a.id).size === 7);
  const again = syncFreezes(a.id, dayN(29));
  check("doing it again changes nothing", again.granted.length === 0 && again.used.length === 0 && freezesHeld(a.id) === 1);
  check("they are told", db.select().from(notifications).where(and(eq(notifications.userId, a.id), like(notifications.key, "freeze-used-%"))).all().length === 1);

  // a gap too long to cover
  const b = mk("b"); quest(b.id, range(21, 27));
  const r2 = syncFreezes(b.id, "2026-10-31");
  check("a gap longer than the freezes held spends nothing", r2.used.length === 0 && freezesHeld(b.id) === 2 && frozenDays(b.id).size === 0);
  check("...and the streak ends", streakOf(factsOf(b.id).days, "2026-10-31", frozenDays(b.id)).current === 0);

  // a one-day "streak"
  const c = mk("c"); quest(c.id, [dayN(27)]);
  const r3 = syncFreezes(c.id, dayN(29));
  check("one day of activity earns the welcome freeze but is not saved", r3.granted.join() === "welcome" && r3.used.length === 0 && freezesHeld(c.id) === 1);

  // nobody active
  const d = mk("d");
  check("someone with no activity gets nothing", syncFreezes(d.id, dayN(29)).granted.length === 0 && freezesHeld(d.id) === 0);

  // the cap over a long streak
  const e = mk("e"); quest(e.id, range(1, 28));
  syncFreezes(e.id, dayN(29));
  check("a long streak never holds more than the maximum", freezesHeld(e.id) === MAX_FREEZES);
  // spending makes room, and a milestone that was waiting is then paid
  const g = mk("g"); quest(g.id, range(1, 14));                  // a 14-day streak, then day 15 missed
  syncFreezes(g.id, dayN(16));
  check("at the maximum a milestone waits, and one freeze is spent on the missed day", freezesHeld(g.id) === 1 && frozenDays(g.id).has(dayN(15)));
  syncFreezes(g.id, dayN(16));
  check("with room again, the waiting milestone is paid", freezesHeld(g.id) === 2);
  check("...and the streak is still whole", streakOf(factsOf(g.id).days, dayN(16), frozenDays(g.id)).current === 15);
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@freeze.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

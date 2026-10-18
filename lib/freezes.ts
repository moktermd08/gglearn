import { and, eq } from "drizzle-orm";
import { dailyQuests, db, runs, streakFreezes } from "@/lib/db";
import { notify } from "@/lib/notifications";

/**
 * Streak freezes: an instant reward that keeps a streak alive over a missed day.
 *
 * Earning (a ledger of grants): one welcome freeze when someone first does anything, then one more each time a streak reaches another 7 days
 * (7, 14, 21...). At most MAX_FREEZES are held; a milestone reached while holding the maximum waits and is paid when there is room.
 * Spending (automatic, nothing to press): the next time the person opens the app, if they missed whole days after a streak of at least
 * MIN_RUN days and they hold enough freezes to cover every missed day, those days are frozen and the streak carries on. If they cannot cover
 * the whole gap nothing is spent and the streak ends, so a freeze is never wasted on a streak that was lost anyway.
 * A frozen day counts as an active day for the streak (and its badges) but not as practice: XP, quests and recaps ignore it.
 * Everything is worked out from real activity, so it cannot drift: the ledger only remembers what was paid and spent.
 */
export const MAX_FREEZES = 2, EVERY_DAYS = 7, MIN_RUN = 2;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

// ---- pure rules ----

/** The unbroken run of days ending on `last`: how long it is and the day it began. */
export function runEndingAt(active: Set<string>, last: string): { length: number; start: string } {
  let n = 0, day = last;
  while (active.has(day)) { n++; day = shift(day, -1); }
  return { length: n, start: shift(day, 1) };
}

/** The most recent day with activity on or before `before`, or null. */
const lastActive = (active: Set<string>, before: string): string | null => [...active].filter((d) => d <= before).sort().pop() ?? null;

/** The missed days a freeze would cover right now, or none. Today is still open, so it is never counted as missed. */
export function planFreeze(i: { active: Set<string>; today: string; held: number }): string[] {
  if (i.held < 1 || i.active.has(i.today)) return [];
  const yesterday = shift(i.today, -1);
  if (i.active.has(yesterday)) return []; // nothing missed
  const last = lastActive(i.active, yesterday);
  if (!last) return [];
  if (runEndingAt(i.active, last).length < MIN_RUN) return []; // not a streak worth saving
  const missed: string[] = [];
  for (let d = shift(last, 1); d <= yesterday; d = shift(d, 1)) missed.push(d);
  return missed.length <= i.held ? missed : []; // all or nothing
}

/** The grants the person has earned but not yet been paid: the welcome freeze and a freeze for each 7 days of their latest streak. */
export function grantsDue(i: { active: Set<string>; raw: Set<string>; today: string; paid: Set<string>; held: number }): string[] {
  const out: string[] = [];
  let room = MAX_FREEZES - i.held;
  if (i.raw.size > 0 && !i.paid.has("welcome") && room > 0) { out.push("welcome"); room--; }
  // the latest streak: the run ending today, or yesterday, or the last day they were active
  const end = i.active.has(i.today) ? i.today : lastActive(i.active, shift(i.today, -1));
  if (!end) return out;
  const { length, start } = runEndingAt(i.active, end);
  for (let m = EVERY_DAYS; m <= length && room > 0; m += EVERY_DAYS) {
    const key = `s7:${start}:${m}`;
    if (!i.paid.has(key)) { out.push(key); room--; }
  }
  return out;
}

// ---- the ledger ----

/** Days with real practice: a quest, or a finished exam. Frozen days are not in here. */
export function activityDays(userId: number): Set<string> {
  const days = new Set(db.select({ d: dailyQuests.day }).from(dailyQuests).where(eq(dailyQuests.userId, userId)).all().map((r) => r.d));
  for (const r of db.select({ at: runs.finishedAt }).from(runs).where(eq(runs.userId, userId)).all()) if (r.at) days.add(iso(new Date(r.at * 1000)));
  return days;
}

export const frozenDays = (userId: number): Set<string> =>
  new Set(db.select({ d: streakFreezes.day }).from(streakFreezes).where(and(eq(streakFreezes.userId, userId), eq(streakFreezes.kind, "used"))).all().map((r) => r.d!).filter(Boolean));

export function freezesHeld(userId: number): number {
  const rows = db.select({ k: streakFreezes.kind }).from(streakFreezes).where(eq(streakFreezes.userId, userId)).all();
  return Math.max(0, rows.filter((r) => r.k === "grant").length - rows.filter((r) => r.k === "used").length);
}

export type FreezeSync = { held: number; granted: string[]; used: string[] };

/** Pays what has been earned, then spends what is needed. Safe to call on any page: each step is keyed, so repeating it changes nothing. */
export function syncFreezes(userId: number, today = iso(new Date())): FreezeSync {
  const raw = activityDays(userId);
  if (raw.size === 0) return { held: freezesHeld(userId), granted: [], used: [] };
  const paid = () => new Set(db.select({ k: streakFreezes.key }).from(streakFreezes).where(eq(streakFreezes.userId, userId)).all().map((r) => r.k));
  const active = () => new Set([...raw, ...frozenDays(userId)]);
  const granted: string[] = [], used: string[] = [];

  // pay first, so a milestone reached just before a missed day is there to cover it
  for (const key of grantsDue({ active: active(), raw, today, paid: paid(), held: freezesHeld(userId) })) {
    if (db.insert(streakFreezes).values({ userId, kind: "grant", key }).onConflictDoNothing().run().changes) {
      granted.push(key);
      notify(userId, { key: `freeze-grant-${key}`, kind: "badge", title: key === "welcome" ? "You earned a streak freeze" : "Streak freeze earned", body: "It will cover a day you miss and keep your streak alive. You can hold up to 2.", href: "/achievements" });
    }
  }
  const plan = planFreeze({ active: active(), today, held: freezesHeld(userId) });
  for (const day of plan) {
    if (db.insert(streakFreezes).values({ userId, kind: "used", key: `used:${day}`, day }).onConflictDoNothing().run().changes) used.push(day);
  }
  if (used.length) {
    const run = runEndingAt(active(), shift(today, -1)).length;
    notify(userId, { key: `freeze-used-${used[0]}`, kind: "system", title: `A streak freeze kept your ${run}-day streak alive`, body: `You missed ${used.length === 1 ? used[0] : `${used.length} days`}. Do a quest today to keep it going.`, href: "/dashboard" });
  }
  return { held: freezesHeld(userId), granted, used };
}

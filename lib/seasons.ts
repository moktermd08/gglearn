/**
 * Weekly and monthly seasons: a fresh leaderboard every Monday and every first of the month (UTC).
 *
 * Season points reward real, graded progress and resist grinding:
 *   100 per level gained: a level passed in the season that is above the level you already held in that subject when it began
 *   (the same "growth, not absolute level" rule contests use, so beginners and experts race fairly), counted once.
 *    10 per active day: any day you finished an exam or a daily quest.
 * Ranking: points, then levels gained, then who reached their total first. Boards are per audience (staff and customers never
 * see each other) and show first name and initial only. People can opt out on their profile.
 */
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { dailyQuests, db, enrollments, runs, seasonClosed, seasonResults, users } from "@/lib/db";

export const POINTS_PER_LEVEL = 100, POINTS_PER_DAY = 10;
export type Kind = "week" | "month";
export type Period = { kind: Kind; key: string; label: string; start: number; end: number };

const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d) / 1000;

/** ISO week number and its year, for the Thursday of the week (so 29 Dec can belong to next year's week 1). */
function isoWeek(startSec: number) {
  const thu = new Date((startSec + 3 * DAY) * 1000), year = thu.getUTCFullYear();
  const jan1 = utc(year, 0, 1);
  return { year, week: Math.floor((thu.getTime() / 1000 - jan1) / DAY / 7) + 1 };
}

export function periodAt(kind: Kind, at = now()): Period {
  if (kind === "week") {
    const d = new Date(at * 1000), dow = (d.getUTCDay() + 6) % 7, start = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * DAY;
    const { year, week } = isoWeek(start);
    const from = new Date(start * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return { kind, key: `${year}-W${String(week).padStart(2, "0")}`, label: `Week ${week} · from ${from}`, start, end: start + 7 * DAY };
  }
  const d = new Date(at * 1000), y = d.getUTCFullYear(), m = d.getUTCMonth();
  return { kind, key: `${y}-${String(m + 1).padStart(2, "0")}`, label: new Date(utc(y, m, 1) * 1000).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), start: utc(y, m, 1), end: utc(y, m + 1, 1) };
}
export const previous = (p: Period) => periodAt(p.kind, p.start - 1);
export function closedPeriods(kind: Kind, n: number, at = now()): Period[] {
  const out: Period[] = []; let p = previous(periodAt(kind, at));
  for (let i = 0; i < n; i++) { out.push(p); p = previous(p); }
  return out;
}
export const periodByKey = (kind: Kind, key: string, at = now()): Period | undefined =>
  [periodAt(kind, at), ...closedPeriods(kind, kind === "week" ? 26 : 12, at)].find((p) => p.key === key);

export type Row = { userId: number; name: string; points: number; levels: number; days: number; lastAt: number; rank: number };

/** "Ada Lovelace" -> "Ada L." Boards never show full names or emails. */
export const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first || "Player";
};

export function standings(p: Period, audience: "staff" | "customer", trackId?: number): Row[] {
  const end = Math.min(p.end, now() + 1);
  const people = new Map(db.select({ id: users.id, name: users.name }).from(users)
    .where(and(eq(users.status, "active"), eq(users.audience, audience), eq(users.seasonBoard, "show"))).all().map((u) => [u.id, u.name]));
  if (!people.size) return [];
  const inWindow = and(gte(runs.finishedAt, p.start), lt(runs.finishedAt, end), trackId ? eq(runs.trackId, trackId) : undefined);
  const rs = db.select({ u: runs.userId, t: runs.trackId, l: runs.level, at: runs.finishedAt, ok: runs.passed }).from(runs).where(inWindow).all().filter((r) => people.has(r.u));
  const from = iso(p.start), to = iso(end - 1);
  const qs = db.select({ u: dailyQuests.userId, day: dailyQuests.day }).from(dailyQuests)
    .where(and(gte(dailyQuests.day, from), sql`${dailyQuests.day} <= ${to}`, trackId ? eq(dailyQuests.trackId, trackId) : undefined)).all().filter((q) => people.has(q.u));

  const passedPairs = new Set(rs.filter((r) => r.ok).map((r) => `${r.u}:${r.t}`));
  const base = new Map<string, number>(); // level held in each subject when the season began
  if (passedPairs.size) {
    const ids = [...new Set(rs.filter((r) => r.ok).map((r) => r.u))];
    for (const b of db.select({ u: runs.userId, t: runs.trackId, m: sql<number>`max(${runs.level})` }).from(runs)
      .where(and(inArray(runs.userId, ids), eq(runs.passed, true), lt(runs.finishedAt, p.start))).groupBy(runs.userId, runs.trackId).all()) base.set(`${b.u}:${b.t}`, b.m);
    for (const e of db.select({ u: enrollments.userId, t: enrollments.trackId, l: enrollments.placedLevel, at: enrollments.placedAt }).from(enrollments).where(inArray(enrollments.userId, ids)).all())
      if (e.at !== null && e.at <= p.start && e.l > (base.get(`${e.u}:${e.t}`) ?? 0)) base.set(`${e.u}:${e.t}`, e.l);
  }
  const acc = new Map<number, { days: Set<string>; gained: Set<string>; lastAt: number }>();
  const get = (u: number) => acc.get(u) ?? acc.set(u, { days: new Set(), gained: new Set(), lastAt: p.start }).get(u)!;
  for (const r of rs) {
    const a = get(r.u); a.days.add(iso(r.at ?? p.start)); a.lastAt = Math.max(a.lastAt, r.at ?? p.start);
    if (r.ok && r.l > (base.get(`${r.u}:${r.t}`) ?? 0)) a.gained.add(`${r.t}:${r.l}`);
  }
  for (const q of qs) { const a = get(q.u); a.days.add(q.day); a.lastAt = Math.max(a.lastAt, Math.floor(new Date(`${q.day}T00:00:00Z`).getTime() / 1000)); }

  const rows = [...acc].map(([userId, a]) => ({ userId, name: people.get(userId)!, levels: a.gained.size, days: a.days.size, lastAt: a.lastAt, points: a.gained.size * POINTS_PER_LEVEL + a.days.size * POINTS_PER_DAY, rank: 0 }))
    .filter((r) => r.points > 0).sort((x, y) => y.points - x.points || y.levels - x.levels || x.lastAt - y.lastAt || x.userId - y.userId);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Settled seasons keep their original ranks, so hiding later leaves a gap in a past board instead of renumbering anyone else. */
/** Writes the final standings of a finished season, once. Safe to call repeatedly. */
export function settle(p: Period) {
  if (p.end > now() || db.select().from(seasonClosed).where(and(eq(seasonClosed.kind, p.kind), eq(seasonClosed.key, p.key))).get()) return;
  db.transaction((tx) => {
    for (const audience of ["staff", "customer"] as const) {
      const rows = standings(p, audience);
      for (const r of rows) tx.insert(seasonResults).values({ kind: p.kind, key: p.key, userId: r.userId, rank: r.rank, points: r.points, levels: r.levels, days: r.days, players: rows.length }).onConflictDoNothing().run();
    }
    tx.insert(seasonClosed).values({ kind: p.kind, key: p.key }).onConflictDoNothing().run();
  });
}

/** Settles the most recent finished week and month, plus the ones before them that were missed. */
export function settleRecent() {
  for (const p of [...closedPeriods("week", 6), ...closedPeriods("month", 3)]) settle(p);
}

export const medalOf = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

export function resultsFor(userId: number, limit = 12) {
  return db.select().from(seasonResults).where(eq(seasonResults.userId, userId)).all()
    .sort((a, b) => b.key.localeCompare(a.key)).slice(0, limit);
}

export function winnersOf(kind: Kind, key: string, audience: "staff" | "customer") {
  return db.select({ userId: seasonResults.userId, name: users.name, points: seasonResults.points }).from(seasonResults).innerJoin(users, eq(users.id, seasonResults.userId))
    .where(and(eq(seasonResults.kind, kind), eq(seasonResults.key, key), eq(seasonResults.rank, 1), eq(users.audience, audience), eq(users.seasonBoard, "show"))).all();
}

export function timeLeft(sec: number) {
  const d = Math.floor(sec / DAY), h = Math.floor((sec % DAY) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(0, m)}m`;
}

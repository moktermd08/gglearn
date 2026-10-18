import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { dailyQuests, db, leagueClosed, leagueEntries, runs, users } from "@/lib/db";
import type { Arena } from "@/lib/arena";
import { leagueArenaMap, leagueArenaOf, offerFor, type Offer } from "@/lib/openLeague";
import { closedPeriods, periodAt, shortName, standings, timeLeft, type Period, type Row } from "@/lib/seasons";
import { notify } from "@/lib/notifications";
import { MAX_TIER, TIERS, cohortFor, movesFor, nextTier, outcomesFor, rankCohort, standingNote, type Outcome } from "@/lib/leagueRules";

/**
 * The weekly league. It is built on the weekly season's points (100 a level, 10 a practice day), so it is always the same real activity.
 * A person is placed in a tier and a cohort of up to 30 the first time in a week they score or open the league, and keeps that cohort all week.
 * When the week ends the top fifth of each cohort move up a tier and the bottom fifth move down (rules in lib/leagueRules.ts); what happened is
 * written to `league_entries`, and next week's tier is read from the last settled row. Cohorts only ever hold people of one arena and audience,
 * the same walls the season boards have. People who hide themselves from the boards are not in the league.
 */
export { TIERS, MAX_TIER, COHORT_SIZE } from "@/lib/leagueRules";
type Entry = typeof leagueEntries.$inferSelect;
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; };

/** The tier someone plays in next: where their last settled week left them, or Bronze if they have never played. */
export function currentTier(userId: number): number {
  const last = db.select().from(leagueEntries).where(and(eq(leagueEntries.userId, userId), isNotNull(leagueEntries.outcome))).orderBy(desc(leagueEntries.key)).get();
  return last ? nextTier(last.tier, last.outcome) : 0;
}

export const entryOf = (userId: number, key: string): Entry | undefined => db.select().from(leagueEntries).where(and(eq(leagueEntries.userId, userId), eq(leagueEntries.key, key))).get();

/** Puts a person in the week: their tier, and the first cohort of that tier with room. Returns the existing entry if they are already in. */
export function ensureEntry(userId: number, key: string, audience: "staff" | "customer", arena: Arena): Entry {
  const have = entryOf(userId, key);
  if (have) return have;
  // no transaction of its own: settling a week calls this inside one. The unique (week, person) index stops a double entry.
  const tier = currentTier(userId);
  const sizes = new Map(db.select({ c: leagueEntries.cohort, n: sql<number>`count(*)` }).from(leagueEntries)
    .where(and(eq(leagueEntries.key, key), eq(leagueEntries.audience, audience), eq(leagueEntries.arena, arena), eq(leagueEntries.tier, tier))).groupBy(leagueEntries.cohort).all().map((r) => [r.c, Number(r.n)]));
  return db.insert(leagueEntries).values({ key, audience, arena, userId, tier, cohort: cohortFor(sizes) }).onConflictDoNothing().returning().get() ?? entryOf(userId, key)!;
}

const eligible = (u: { status: string; seasonBoard: string }) => u.status === "active" && u.seasonBoard === "show";

/** Has this person scored since the week began? Two cheap indexed lookups; the full ranking is only worked out when the league is opened. */
function scoredSince(userId: number, p: Period): boolean {
  const day = new Date(p.start * 1000).toISOString().slice(0, 10);
  return !!db.select({ id: dailyQuests.id }).from(dailyQuests).where(and(eq(dailyQuests.userId, userId), gte(dailyQuests.day, day))).limit(1).get()
    || !!db.select({ id: runs.id }).from(runs).where(and(eq(runs.userId, userId), gte(runs.finishedAt, p.start))).limit(1).get();
}

/** Called wherever progress is worked out: someone who has scored this week gets their place in the league. Does nothing once they have one. */
export function touchLeague(userId: number, p: Period = periodAt("week")) {
  if (entryOf(userId, p.key)) return;
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || !eligible(u) || !scoredSince(userId, p)) return;
  ensureEntry(userId, p.key, u.audience, leagueArenaOf(userId));
}

/** Arenas for one week: the current ones, except that anyone already placed that week stays where they were placed (so a later change does not move last week's points). */
export function arenaMapFor(key: string): Map<number, Arena> {
  const map = leagueArenaMap();
  for (const e of db.select({ u: leagueEntries.userId, a: leagueEntries.arena }).from(leagueEntries).where(eq(leagueEntries.key, key)).all()) map.set(e.u, e.a);
  return map;
}

// ---- settling a week ----

/**
 * Ranks every cohort of one arena and audience for a finished week and moves people. `rows` are that week's season standings for the same group
 * (anyone who scored). People who scored but had no place yet are put in first, in an order that does not depend on how well they did.
 * Safe to repeat: only entries without an outcome are settled.
 */
export function settleLeagueGroup(key: string, audience: "staff" | "customer", arena: Arena, rows: Row[], announce: boolean) {
  const pts = new Map(rows.map((r) => [r.userId, r]));
  const late = rows.filter((r) => !entryOf(r.userId, key)).sort((a, b) => hash(`${a.userId}:${key}`) - hash(`${b.userId}:${key}`));
  for (const r of late) ensureEntry(r.userId, key, audience, arena);
  const open = db.select().from(leagueEntries).where(and(eq(leagueEntries.key, key), eq(leagueEntries.audience, audience), eq(leagueEntries.arena, arena), isNull(leagueEntries.outcome))).all();
  const groups = new Map<string, Entry[]>();
  for (const e of open) groups.set(`${e.tier}:${e.cohort}`, [...(groups.get(`${e.tier}:${e.cohort}`) ?? []), e]);
  for (const members of groups.values()) {
    const tier = members[0].tier;
    // the season board's own tie-breaks: more levels, then who got there first
    const ordered = members.map((e) => ({ e, r: pts.get(e.userId) })).sort((a, b) => (b.r?.levels ?? 0) - (a.r?.levels ?? 0) || (a.r?.lastAt ?? 0) - (b.r?.lastAt ?? 0) || a.e.userId - b.e.userId);
    const ranked = rankCohort(ordered.map(({ e, r }) => ({ userId: e.userId, points: r?.points ?? 0 })));
    const out = outcomesFor(ranked, tier);
    for (const r of ranked) {
      const outcome = out.get(r.userId)!;
      db.update(leagueEntries).set({ points: r.points, rank: r.rank, outcome }).where(and(eq(leagueEntries.key, key), eq(leagueEntries.userId, r.userId))).run();
      if (announce && outcome !== "stay") {
        const to = nextTier(tier, outcome);
        notify(r.userId, { key: `league-${key}`, kind: "season", title: outcome === "up" ? `Promoted to ${TIERS[to].name} league` : `Moved down to ${TIERS[to].name} league`,
          body: `You finished #${r.rank} of ${ranked.length} in ${TIERS[tier].name} league with ${r.points} points.${outcome === "down" ? " One strong week gets you back." : ""}`, href: "/league" });
      }
    }
  }
}

/**
 * Settles the leagues of finished weeks. The first time it ever runs it settles only the most recent finished week and marks the earlier ones as
 * closed without moving anybody, so switching the league on does not rewrite history into six promotions at once.
 */
export function settleLeagueRecent(at = Math.floor(Date.now() / 1000)) {
  const weeks = closedPeriods("week", 6, at);
  const done = new Set(db.select({ k: leagueClosed.key }).from(leagueClosed).all().map((r) => r.k));
  const todo = weeks.filter((p) => !done.has(p.key));
  if (!todo.length) return;
  const fresh = done.size === 0;
  for (const p of todo.reverse()) { // oldest first, so each week builds on the last
    if (fresh && p.key !== weeks[0].key) { db.insert(leagueClosed).values({ key: p.key }).onConflictDoNothing().run(); continue; }
    db.transaction(() => {
      const map = arenaMapFor(p.key), arenas = [...new Set(map.values())];
      for (const audience of ["staff", "customer"] as const) for (const arena of arenas) {
        const rows = standings(p, audience, undefined, arena, map);
        if (rows.length || db.select({ id: leagueEntries.id }).from(leagueEntries).where(and(eq(leagueEntries.key, p.key), eq(leagueEntries.audience, audience), eq(leagueEntries.arena, arena))).get())
          settleLeagueGroup(p.key, audience, arena, rows, at - p.end < 3 * 86400);
      }
      db.insert(leagueClosed).values({ key: p.key }).onConflictDoNothing().run();
    });
  }
}

// ---- the view ----

export type LeagueRow = { userId: number; name: string; points: number; rank: number; mine: boolean; zone: "up" | "down" | null };
export type LeagueView = {
  weekLabel: string; endsIn: string; tier: number; tierName: string; hue: number; cohort: number; size: number; up: number; down: number;
  cross: boolean; offer: Offer; rows: LeagueRow[]; me: { rank: number; points: number; note: string }; history: { key: string; tier: number; rank: number | null; size: number; outcome: Outcome | null; points: number | null }[];
} | { notIn: "hidden" | "not-yet"; tier: number; tierName: string; hue: number; offer: Offer };

/** Everything the league page shows for one person, or why they are not in it yet. */
export function leagueView(userId: number): LeagueView {
  const p = periodAt("week"), u = db.select().from(users).where(eq(users.id, userId)).get()!;
  const tier = currentTier(userId), offer = offerFor(userId), base = { tier, tierName: TIERS[tier].name, hue: TIERS[tier].hue, offer };
  if (!eligible(u)) return { notIn: "hidden", ...base };
  const arena = leagueArenaOf(userId);
  const prior = db.select({ id: leagueEntries.id }).from(leagueEntries).where(eq(leagueEntries.userId, userId)).limit(1).get();
  if (!entryOf(userId, p.key) && !prior && !scoredSince(userId, p)) return { notIn: "not-yet", ...base };
  const mine = ensureEntry(userId, p.key, u.audience, arena);
  const pts = new Map(standings(p, u.audience, undefined, mine.arena, arenaMapFor(p.key)).map((r) => [r.userId, r]));
  const cohort = db.select({ id: leagueEntries.userId, name: users.name }).from(leagueEntries).innerJoin(users, eq(users.id, leagueEntries.userId))
    .where(and(eq(leagueEntries.key, p.key), eq(leagueEntries.audience, u.audience), eq(leagueEntries.arena, mine.arena), eq(leagueEntries.tier, mine.tier), eq(leagueEntries.cohort, mine.cohort))).all();
  const ordered = cohort.map((c) => ({ userId: c.id, name: c.name, points: pts.get(c.id)?.points ?? 0, levels: pts.get(c.id)?.levels ?? 0, lastAt: pts.get(c.id)?.lastAt ?? 0 }))
    .sort((a, b) => b.levels - a.levels || a.lastAt - b.lastAt || a.userId - b.userId);
  const ranked = rankCohort(ordered), { up, down } = movesFor(ranked.length);
  const rows = ranked.map((r): LeagueRow => ({ userId: r.userId, name: shortName(r.name), points: r.points, rank: r.rank, mine: r.userId === userId,
    zone: r.rank <= up && r.points > 0 && mine.tier < MAX_TIER ? "up" : r.rank > ranked.length - down && mine.tier > 0 ? "down" : null }));
  const me = rows.find((r) => r.mine)!;
  const history = db.select().from(leagueEntries).where(and(eq(leagueEntries.userId, userId), isNotNull(leagueEntries.outcome))).orderBy(desc(leagueEntries.key)).limit(8).all()
    .map((e) => ({ key: e.key, tier: e.tier, rank: e.rank, size: Number(db.select({ n: sql<number>`count(*)` }).from(leagueEntries).where(and(eq(leagueEntries.key, e.key), eq(leagueEntries.audience, e.audience), eq(leagueEntries.arena, e.arena), eq(leagueEntries.tier, e.tier), eq(leagueEntries.cohort, e.cohort))).get()?.n ?? 0), outcome: e.outcome, points: e.points }));
  return { weekLabel: p.label, endsIn: timeLeft(p.end - Math.floor(Date.now() / 1000)), tier: mine.tier, tierName: TIERS[mine.tier].name, hue: TIERS[mine.tier].hue, cohort: mine.cohort, size: ranked.length, up, down, cross: mine.arena === "x", offer, rows,
    me: { rank: me.rank, points: me.points, note: standingNote(me.rank, ranked.length, me.points, mine.tier, (rk) => ranked[rk - 1]?.points ?? null) }, history };
}

/**
 * Player progression across every subject: XP, a player level, a day streak and badges.
 * Everything is derived from exams (`runs`), daily quests and contests, so it can never drift from real activity.
 * Only the moment a badge was first earned is stored (`user_badges`).
 */
import { and, eq, sql } from "drizzle-orm";
import { certificates, competitionCerts, contestAttempts, dailyQuests, db, enrollments, runs, seasonResults, userBadges } from "@/lib/db";
import { settleRecent } from "@/lib/seasons";
import { bonusXp } from "@/lib/rewards";
import { lastLevelNoted, notify } from "@/lib/notifications";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (sec: number) => iso(new Date(sec * 1000));
const now = () => Math.floor(Date.now() / 1000);

// ---- player level ----

export const MAX_PLAYER_LEVEL = 100;
/** Total XP needed to reach a player level: 100 for level 2, 300 for 3, 1,000 for 5, 4,500 for 10, 19,000 for 20. */
export const xpToReach = (level: number) => 50 * level * (level - 1);
export const PLAYER_TITLES = ["Rookie", "Challenger", "Contender", "Competitor", "Specialist", "Veteran", "Champion", "Master", "Grandmaster", "Legend"] as const;
export const titleOf = (level: number) => PLAYER_TITLES[Math.min(PLAYER_TITLES.length - 1, Math.floor(level / 10))];

export function playerLevel(xp: number) {
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && xpToReach(level + 1) <= xp) level++;
  const maxed = level >= MAX_PLAYER_LEVEL, from = xpToReach(level), to = maxed ? from : xpToReach(level + 1);
  return { level, title: titleOf(level), xp, from, to, into: xp - from, need: to - from, pct: maxed ? 1 : (xp - from) / (to - from), maxed };
}

// ---- streak ----

export type Streak = { current: number; longest: number; activeToday: boolean; atRisk: boolean; week: { day: string; active: boolean }[] };

/** A streak is consecutive UTC days with any activity (a quest or a finished exam, on any subject). It stays alive until the day ends. */
export function streakOf(days: Set<string>, today = iso(new Date())): Streak {
  const step = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
  const t = new Date(`${today}T00:00:00Z`);
  const activeToday = days.has(today);
  let cursor = activeToday ? t : step(t, -1), current = 0;
  while (days.has(iso(cursor))) { current++; cursor = step(cursor, -1); }
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev && iso(step(new Date(`${prev}T00:00:00Z`), 1)) === d ? run + 1 : 1;
    longest = Math.max(longest, run); prev = d;
  }
  return { current, longest: Math.max(longest, current), activeToday, atRisk: current > 0 && !activeToday, week: Array.from({ length: 7 }, (_, i) => { const d = iso(step(t, i - 6)); return { day: d, active: days.has(d) }; }) };
}

// ---- facts ----

export type Facts = {
  xp: number; levelsPassed: number; perfect: number; tracksStarted: number; tracksProgressed: number; titan: number;
  certs: number; seasonsPlayed: number; podiums: number; seasonWins: number; contestsFinished: number; champion: number; records: number; longestStreak: number; playerLevel: number;
  days: Set<string>;
};

export function factsOf(userId: number): Facts {
  const done = and(eq(runs.userId, userId), sql`${runs.finishedAt} is not null`);
  const runXp = db.select({ v: sql<number>`coalesce(sum(round(${runs.score} * 100) + case when ${runs.passed} then 50 else 0 end), 0)` }).from(runs).where(done).get()?.v ?? 0;
  const quests = db.select({ day: dailyQuests.day, xp: dailyQuests.xp }).from(dailyQuests).where(eq(dailyQuests.userId, userId)).all();
  const days = new Set(quests.map((q) => q.day));
  for (const r of db.select({ at: runs.finishedAt }).from(runs).where(done).all()) if (r.at) days.add(day(r.at));
  const passed = and(done, eq(runs.passed, true));
  const one = <T,>(q: { n: T } | undefined) => q?.n ?? (0 as T);
  const levelsPassed = Number(db.select({ n: sql<number>`count(*)` }).from(db.select({ t: runs.trackId, l: runs.level }).from(runs).where(passed).groupBy(runs.trackId, runs.level).as("p")).get()?.n ?? 0);
  const xp = runXp + quests.reduce((s, q) => s + q.xp, 0) + bonusXp(userId); // plus any bonus a company's reward policy gave
  const streak = streakOf(days);
  const seasons = db.select({ rank: seasonResults.rank }).from(seasonResults).where(eq(seasonResults.userId, userId)).all();
  return {
    seasonsPlayed: seasons.length, podiums: seasons.filter((r) => r.rank <= 3).length, seasonWins: seasons.filter((r) => r.rank === 1).length,
    xp, levelsPassed, days,
    perfect: Number(one(db.select({ n: sql<number>`count(*)` }).from(runs).where(and(passed, sql`${runs.score} >= 0.999`)).get())),
    tracksStarted: Number(one(db.select({ n: sql<number>`count(*)` }).from(enrollments).where(eq(enrollments.userId, userId)).get())),
    tracksProgressed: Number(one(db.select({ n: sql<number>`count(distinct ${runs.trackId})` }).from(runs).where(passed).get())),
    titan: Number(one(db.select({ n: sql<number>`count(*)` }).from(runs).where(and(passed, eq(runs.level, 20))).get())),
    certs: Number(one(db.select({ n: sql<number>`count(*)` }).from(certificates).where(eq(certificates.userId, userId)).get())),
    contestsFinished: Number(one(db.select({ n: sql<number>`count(*)` }).from(competitionCerts).where(eq(competitionCerts.userId, userId)).get())),
    champion: Number(one(db.select({ n: sql<number>`count(*)` }).from(competitionCerts).where(and(eq(competitionCerts.userId, userId), eq(competitionCerts.kind, "champion"))).get())),
    records: Number(one(db.select({ n: sql<number>`count(*)` }).from(contestAttempts).where(and(eq(contestAttempts.userId, userId), eq(contestAttempts.status, "finished"))).get())),
    longestStreak: streak.longest, playerLevel: playerLevel(xp).level,
  };
}

// ---- badges ----

export type BadgeTier = "bronze" | "silver" | "gold" | "legend";
export type BadgeDef = { key: string; group: string; name: string; desc: string; icon: string; tier: BadgeTier; target: number; value: (f: Facts) => number };

export const BADGE_GROUPS = ["Streaks", "XP", "Levels", "Mastery", "Contests", "Seasons"] as const;
const b = (group: string, key: string, name: string, desc: string, icon: string, tier: BadgeTier, target: number, value: (f: Facts) => number): BadgeDef => ({ key, group, name, desc, icon, tier, target, value });

export const BADGES: BadgeDef[] = [
  b("Streaks", "streak-3", "On Fire", "Learn 3 days in a row", "🔥", "bronze", 3, (f) => f.longestStreak),
  b("Streaks", "streak-7", "Unstoppable", "Learn 7 days in a row", "⚡", "silver", 7, (f) => f.longestStreak),
  b("Streaks", "streak-14", "Fortnight Focus", "Learn 14 days in a row", "🌙", "silver", 14, (f) => f.longestStreak),
  b("Streaks", "streak-30", "Iron Habit", "Learn 30 days in a row", "🛡️", "gold", 30, (f) => f.longestStreak),
  b("Streaks", "streak-100", "Centurion", "Learn 100 days in a row", "🏛️", "legend", 100, (f) => f.longestStreak),
  b("XP", "xp-500", "Spark", "Earn 500 XP", "✨", "bronze", 500, (f) => f.xp),
  b("XP", "xp-2000", "Blaze", "Earn 2,000 XP", "🌟", "silver", 2000, (f) => f.xp),
  b("XP", "xp-10000", "Inferno", "Earn 10,000 XP", "☄️", "gold", 10000, (f) => f.xp),
  b("XP", "xp-50000", "Supernova", "Earn 50,000 XP", "💫", "legend", 50000, (f) => f.xp),
  b("XP", "player-10", "Double Digits", "Reach player level 10", "🔟", "silver", 10, (f) => f.playerLevel),
  b("XP", "player-25", "Quarter Century", "Reach player level 25", "🎖️", "gold", 25, (f) => f.playerLevel),
  b("XP", "player-50", "Halfway to Legend", "Reach player level 50", "🏅", "legend", 50, (f) => f.playerLevel),
  b("Levels", "levels-1", "First Blood", "Pass your first level", "⚔️", "bronze", 1, (f) => f.levelsPassed),
  b("Levels", "levels-10", "Ten Down", "Pass 10 levels", "🗡️", "bronze", 10, (f) => f.levelsPassed),
  b("Levels", "levels-25", "Quarter Hundred", "Pass 25 levels", "🏹", "silver", 25, (f) => f.levelsPassed),
  b("Levels", "levels-50", "Fifty Strong", "Pass 50 levels", "🔱", "gold", 50, (f) => f.levelsPassed),
  b("Levels", "levels-100", "Centurion of Levels", "Pass 100 levels", "👑", "legend", 100, (f) => f.levelsPassed),
  b("Mastery", "perfect-1", "Flawless", "Score 100% on a level exam", "💎", "bronze", 1, (f) => f.perfect),
  b("Mastery", "perfect-10", "Untouchable", "Score 100% on 10 level exams", "🥇", "gold", 10, (f) => f.perfect),
  b("Mastery", "explorer-3", "Explorer", "Start 3 subjects", "🧭", "bronze", 3, (f) => f.tracksStarted),
  b("Mastery", "polymath-10", "Polymath", "Pass a level in 10 different subjects", "🧠", "gold", 10, (f) => f.tracksProgressed),
  b("Mastery", "cert-1", "Certified", "Earn a certificate", "🎓", "silver", 1, (f) => f.certs),
  b("Mastery", "cert-4", "Collector", "Earn 4 certificates", "📜", "gold", 4, (f) => f.certs),
  b("Mastery", "titan", "Titan", "Reach level 20 in any subject", "🏆", "legend", 1, (f) => f.titan),
  b("Contests", "contest-1", "Contender", "Reach the goal in a contest", "🏁", "bronze", 1, (f) => f.contestsFinished),
  b("Contests", "contest-5", "Regular", "Reach the goal in 5 contests", "🎯", "silver", 5, (f) => f.contestsFinished),
  b("Contests", "champion", "Champion", "Finish first in a contest", "🥇", "gold", 1, (f) => f.champion),
  b("Contests", "record", "Record Chaser", "Finish a record attempt", "⏱️", "silver", 1, (f) => f.records),
  b("Seasons", "season-1", "Season Starter", "Score points in a weekly or monthly season", "🗓️", "bronze", 1, (f) => f.seasonsPlayed),
  b("Seasons", "season-5", "Season Regular", "Score points in 5 seasons", "📅", "silver", 5, (f) => f.seasonsPlayed),
  b("Seasons", "podium", "On the Podium", "Finish in the top 3 of a season", "🥉", "silver", 1, (f) => f.podiums),
  b("Seasons", "podium-5", "Podium Habit", "Finish in the top 3 of 5 seasons", "🥈", "gold", 5, (f) => f.podiums),
  b("Seasons", "season-win", "Season Champion", "Finish first in a season", "🥇", "legend", 1, (f) => f.seasonWins),
];

export type BadgeView = Omit<BadgeDef, "value"> & { value: number; earned: boolean; earnedAt: number | null; pct: number };

export type Progression = { facts: Facts; player: ReturnType<typeof playerLevel>; streak: Streak; badges: BadgeView[]; earned: number; fresh: BadgeView[] };

/**
 * Everything the UI needs for one person. Writes a row for each badge whose rule is newly met (idempotent), so it is safe to
 * call on any page load and after any exam. `fresh` are the badges earned in the last `freshSec` seconds.
 */
export function progressionFor(userId: number, freshSec = 30): Progression {
  settleRecent(); // writes the final standings of any season that has just ended (a cheap lookup once settled)
  const facts = factsOf(userId);
  const have = new Map(db.select().from(userBadges).where(eq(userBadges.userId, userId)).all().map((r) => [r.key, r.earnedAt]));
  const t = now();
  const firstSync = have.size === 0; // someone opening this for the first time is not told about everything they already had
  const badges = BADGES.map((d): BadgeView => {
    const { value: rule, ...def } = d, value = rule(facts), met = value >= d.target;
    if (met && !have.has(d.key)) {
      const r = db.insert(userBadges).values({ userId, key: d.key, earnedAt: t }).onConflictDoNothing().run();
      if (r.changes) { have.set(d.key, t); notify(userId, { key: `badge-${d.key}`, kind: "badge", title: `Badge earned: ${d.name}`, body: d.desc, href: "/achievements" }, { read: firstSync }); }
    }
    return { ...def, value, earned: met, earnedAt: have.get(d.key) ?? null, pct: Math.min(1, value / d.target) };
  });
  const player = playerLevel(facts.xp), noted = lastLevelNoted(userId);
  if (player.level >= 2 && player.level > noted) notify(userId, { key: `level-${player.level}`, kind: "level", title: `Level up! You are player level ${player.level}`, body: `${player.title}. ${player.xp.toLocaleString("en-GB")} XP so far.`, href: "/achievements" }, { read: firstSync });
  return { facts, player, streak: streakOf(facts.days), badges, earned: badges.filter((x) => x.earned).length, fresh: badges.filter((x) => x.earnedAt !== null && t - x.earnedAt <= freshSec && x.earned) };
}

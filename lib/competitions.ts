import { and, between, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { competitionMembers, competitions, dailyQuests, db, enrollments, runs, tracks, userAvatars, users } from "@/lib/db";
import { MAX_LEVEL, XP_PER_LEVEL } from "@/lib/levels";
import { PRIZE_SPLITS } from "@/lib/competitions-shared";
import { botReachedAt, botXpAt, type BotSpec, type BotStyle } from "@/lib/bots";

export type Competition = typeof competitions.$inferSelect;
export type Member = typeof competitionMembers.$inferSelect;
type Viewer = { id: number } | null;

export const now = () => Math.floor(Date.now() / 1000);
const dayOf = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

export type State = "upcoming" | "live" | "finished" | "canceled";
export function stateOf(c: Competition, at = now()): State {
  if (c.canceledAt) return "canceled";
  if (at < c.startsAt) return "upcoming";
  return at >= c.endsAt ? "finished" : "live";
}

/** Public contests are visible to everyone. Private ones only to people who were invited or joined, so a stranger cannot tell one exists. */
export function canView(c: Competition, viewer: Viewer): boolean {
  if (c.visibility === "public") return true;
  if (!viewer) return false;
  if (c.createdBy === viewer.id) return true;
  return !!db.select({ id: competitionMembers.id }).from(competitionMembers)
    .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, viewer.id), inArray(competitionMembers.status, ["invited", "joined"]))).get();
}

/** Everyone may see a stranger's photo only if that person plays in a public contest; signed-in colleagues always can. */
export function canSeeAvatar(ownerId: number, viewer: Viewer): boolean {
  if (viewer) return true;
  return !!db.select({ id: competitionMembers.id }).from(competitionMembers)
    .innerJoin(competitions, eq(competitions.id, competitionMembers.competitionId))
    .where(and(eq(competitionMembers.userId, ownerId), eq(competitionMembers.status, "joined"), eq(competitions.visibility, "public"))).get();
}

/**
 * Level this person stood at strictly before `since`: the highest level passed by exam, or the starting point found by the
 * placement check, whichever is higher. Placement made after `since` is ignored here (and journeys refuse to place someone
 * who is already racing the topic), so a check can never hand out free levels mid-contest.
 */
export function baselineLevel(userId: number, trackId: number, since: number): number {
  const passed = db.select({ m: sql<number>`coalesce(max(${runs.level}), 0)` }).from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true), isNotNull(runs.finishedAt), lt(runs.finishedAt, since))).get()?.m ?? 0;
  const e = db.select({ p: enrollments.placedLevel, at: enrollments.placedAt }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId))).get();
  const placed = e && e.at !== null && e.at <= since ? e.p : 0;
  return Math.max(passed, placed);
}

export type Standing = {
  member: Member;
  name: string;
  userId: number | null;
  hasPhoto: boolean;
  photoVersion: number;
  isBot: boolean;
  botStyle: BotStyle | null;
  tagline: string | null;
  startLevel: number | null; // humans: level when they started racing
  target: number; // levels this competitor needs to gain to hit the goal
  gained: number;
  xp: number;
  reachedAt: number | null;
  practiceDays: number;
  accuracy: number | null; // average exam score in the window, humans only
  lastActiveAt: number | null;
  rank: number;
};

export type Event = { at: number; text: string; bot: boolean };

/**
 * Standings at time `at` (clamped to the end of the contest, so finished results never move).
 * Progress is *growth since you started racing*: levels newly passed in the track, so beginners and
 * experts can compete. Ranking: goal reached first (earliest wins), then levels gained, then XP.
 */
export function standings(c: Competition, members: Member[], at = now()) {
  const asOf = Math.min(at, c.endsAt);
  const humans = members.filter((m) => m.kind === "human" && m.status === "joined" && m.userId);
  const ids = humans.map((m) => m.userId!);
  const people = ids.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)).all() : [];
  const photos = ids.length ? db.select({ id: userAvatars.userId, v: userAvatars.updatedAt }).from(userAvatars).where(inArray(userAvatars.userId, ids)).all() : [];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const photoOf = new Map(photos.map((p) => [p.id, p.v]));
  const events: Event[] = [];

  const rows: Omit<Standing, "rank">[] = members.filter((m) => m.kind === "bot" || (m.status === "joined" && m.userId)).map((m) => {
    if (m.kind === "bot") {
      const spec: BotSpec = { style: m.botStyle as BotStyle, pace: m.botPace ?? 0, seed: m.botSeed ?? "" };
      const xp = at < c.startsAt ? 0 : botXpAt(spec, c.startsAt, c.endsAt, asOf);
      const gained = Math.floor(xp / XP_PER_LEVEL);
      for (let k = 1; k <= gained; k++) {
        const t = botReachedAt(spec, c.startsAt, c.endsAt, k);
        if (t && t <= asOf) events.push({ at: t, text: `${m.botName} reached level +${k} (simulated)`, bot: true });
      }
      const reachedAt = botReachedAt(spec, c.startsAt, c.endsAt, c.goalLevels);
      return {
        member: m, name: m.botName ?? "Bot", userId: null, hasPhoto: false, photoVersion: 0, isBot: true,
        botStyle: spec.style, tagline: m.botTagline, startLevel: null, target: c.goalLevels, gained: Math.min(gained, MAX_LEVEL), xp,
        reachedAt: reachedAt && reachedAt <= asOf ? reachedAt : null, practiceDays: 0, accuracy: null, lastActiveAt: null,
      };
    }

    const uid = m.userId!, name = nameOf.get(uid) ?? "Learner";
    const since = Math.max(c.startsAt, m.joinedAt ?? c.startsAt);
    const startLevel = baselineLevel(uid, c.trackId, since);
    const target = Math.min(c.goalLevels, Math.max(0, MAX_LEVEL - startLevel));
    const base = {
      member: m, name, userId: uid, hasPhoto: photoOf.has(uid), photoVersion: photoOf.get(uid) ?? 0, isBot: false, botStyle: null, tagline: null,
      startLevel, target,
    };
    if (asOf < since) return { ...base, gained: 0, xp: 0, reachedAt: null, practiceDays: 0, accuracy: null, lastActiveAt: null };

    const done = db.select({ level: runs.level, score: runs.score, passed: runs.passed, at: runs.finishedAt }).from(runs)
      .where(and(eq(runs.userId, uid), eq(runs.trackId, c.trackId), between(runs.finishedAt, since, asOf))).orderBy(runs.finishedAt).all();
    const quests = db.select({ day: dailyQuests.day, xp: dailyQuests.xp }).from(dailyQuests)
      .where(and(eq(dailyQuests.userId, uid), eq(dailyQuests.trackId, c.trackId), between(dailyQuests.day, dayOf(since), dayOf(asOf)))).all();

    const best = done.reduce((mx, r) => (r.passed ? Math.max(mx, r.level) : mx), 0);
    const gained = Math.max(0, best - startLevel);
    const xp = done.reduce((s, r) => s + Math.round((r.score ?? 0) * 100) + (r.passed ? 50 : 0), 0) + quests.reduce((s, q) => s + q.xp, 0);
    const winRun = target > 0 ? done.find((r) => r.passed && r.level >= startLevel + target) : undefined;
    const seen = new Set(startLevelsPassed(startLevel));
    for (const r of done) {
      if (r.passed && !seen.has(r.level)) { seen.add(r.level); events.push({ at: r.at!, text: `${name} passed level ${r.level} (${Math.round((r.score ?? 0) * 100)}%)`, bot: false }); }
    }
    const days = new Set([...done.map((r) => dayOf(r.at!)), ...quests.map((q) => q.day)]);
    return {
      ...base, gained, xp, reachedAt: winRun?.at ?? null, practiceDays: days.size,
      accuracy: done.length ? done.reduce((s, r) => s + (r.score ?? 0), 0) / done.length : null,
      lastActiveAt: done.length ? done[done.length - 1].at : null,
    };
  });

  const better = (a: Omit<Standing, "rank">, b: Omit<Standing, "rank">) => {
    if (a.reachedAt !== null && b.reachedAt !== null) return a.reachedAt < b.reachedAt;
    if (a.reachedAt !== null || b.reachedAt !== null) return a.reachedAt !== null;
    return a.gained !== b.gained ? a.gained > b.gained : a.xp > b.xp;
  };
  const ranked: Standing[] = rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => o !== r && better(o, r)).length }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  events.sort((a, b) => b.at - a.at);
  return { rows: ranked, events: events.slice(0, 20) };
}

// levels at or below the starting level were passed before the race and are not news
const startLevelsPassed = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** Shortest human-readable span, e.g. "3d 4h" or "25m". */
export function span(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function modeLabel(humans: number, bots: number): string {
  if (humans <= 1 && bots === 0) return "Solo";
  if (humans === 1 && bots === 1) return "Human vs Bot";
  if (humans === 1) return `Human vs ${bots} bots`;
  if (bots === 0) return humans === 2 ? "Human vs Human" : "Group race";
  return "Group race with bots";
}

export type Card = { c: Competition; trackName: string; humans: number; bots: number; state: State; invited: boolean };

/** Contests the viewer may see in a list: public ones plus anything they created, joined or were invited to. */
export function listFor(viewer: Viewer, opts: { mineOnly?: boolean } = {}): Card[] {
  const mineIds = viewer
    ? new Set(db.select({ id: competitionMembers.competitionId }).from(competitionMembers)
        .where(and(eq(competitionMembers.userId, viewer.id), inArray(competitionMembers.status, ["invited", "joined"]))).all().map((r) => r.id))
    : new Set<number>();
  const rows = db.select({ c: competitions, trackName: tracks.name }).from(competitions)
    .innerJoin(tracks, eq(tracks.id, competitions.trackId)).orderBy(desc(competitions.createdAt)).limit(300).all()
    .filter(({ c }) => (viewer && (c.createdBy === viewer.id || mineIds.has(c.id))) || (!opts.mineOnly && c.visibility === "public"));
  if (!rows.length) return [];
  const members = db.select().from(competitionMembers).where(inArray(competitionMembers.competitionId, rows.map((r) => r.c.id))).all();
  const t = now();
  return rows.map(({ c, trackName }) => {
    const ms = members.filter((m) => m.competitionId === c.id);
    return {
      c, trackName, state: stateOf(c, t),
      humans: ms.filter((m) => m.kind === "human" && m.status === "joined").length,
      bots: ms.filter((m) => m.kind === "bot").length,
      invited: !!viewer && ms.some((m) => m.userId === viewer.id && m.status === "invited"),
    };
  });
}

// ---- prizes ----

/**
 * Prizes go to people only, never to simulated bots, and only to those who reached the goal. Ranked by who got there first.
 * Returns the paid places in order; empty when there is no prize or nobody has finished yet.
 */
export function payouts(c: Competition, rows: Standing[]): { place: number; name: string; userId: number; amount: number }[] {
  if (!c.prizeAmount) return [];
  const finishers = rows.filter((r) => !r.isBot && r.userId !== null && r.reachedAt !== null)
    .sort((a, b) => a.reachedAt! - b.reachedAt! || a.member.id - b.member.id);
  const shares = PRIZE_SPLITS[c.prizeSplit];
  const amounts = shares.map((bp) => Math.floor((c.prizeAmount * bp) / 10000));
  amounts[0] += c.prizeAmount - amounts.reduce((s, a) => s + a, 0); // rounding dust goes to first place
  return finishers.slice(0, shares.length).map((r, i) => ({ place: i + 1, name: r.name, userId: r.userId!, amount: amounts[i] }));
}

/** Humans who reached the goal, fastest first. Place 1 is the contest champion. */
export function finishersOf(rows: Standing[]): Standing[] {
  return rows.filter((r) => !r.isBot && r.userId !== null && r.reachedAt !== null)
    .sort((a, b) => a.reachedAt! - b.reachedAt! || a.member.id - b.member.id);
}

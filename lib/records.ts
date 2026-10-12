import { and, between, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { competitionMembers, competitions, contestAttempts, db, runs, userAvatars, users } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";
import { baselineLevel, now, stateOf, type Competition, type Member, type Standing } from "@/lib/competitions";

/**
 * Time records for a contest. Nothing here is stored except record attempts: finish times, ranks, percentiles, splits and
 * badges are all read from real exams (`runs`) every time, so a finished contest's board never changes.
 *
 *  - Finish time = from when you started racing (the contest start, or when you joined if later) to the exam pass that reached the goal.
 *  - After a contest ends, anyone who may see it can start a record attempt: the same goal from wherever they stand, their own clock.
 *    Times from the contest and from attempts share one board, best time per person.
 *  - "Beats X%" = the share of the other people on the board who were slower.
 */

export type Badge = { id: string; label: string; blurb: string; tone: "amber" | "violet" | "emerald" | "sky" | "pink" | "rose" };

export type Entry = {
  key: string;
  userId: number;
  name: string;
  hasPhoto: boolean;
  photoVersion: number;
  seconds: number; // time to reach the goal
  at: number; // when the goal was reached
  source: "contest" | "challenge";
  splits: number[]; // seconds after the start at which each level of the goal was reached
  rank: number;
  beaten: number | null; // % of the other people on the board who were slower; null when alone
  badges: Badge[];
};

export type Attempt = typeof contestAttempts.$inferSelect;

/** One attempt: its splits so far, and whether the goal is reached (settled into the table the first time it is seen). */
export type AttemptView = { attempt: Attempt; splits: number[]; deadline: number; secondsLeft: number };

type PassRun = { userId: number; level: number; score: number; startedAt: number; at: number };

const names = (ids: number[]) => new Map((ids.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)).all() : []).map((u) => [u.id, u.name]));

/** Passing exams by these people on one track in a time window, oldest first. */
function passes(userIds: number[], trackId: number, from: number, to: number): PassRun[] {
  if (!userIds.length) return [];
  return db.select({ userId: runs.userId, level: runs.level, score: runs.score, startedAt: runs.startedAt, at: runs.finishedAt }).from(runs)
    .where(and(inArray(runs.userId, userIds), eq(runs.trackId, trackId), eq(runs.passed, true), isNotNull(runs.finishedAt), between(runs.finishedAt, from, to)))
    .orderBy(runs.finishedAt).all().map((r) => ({ ...r, score: r.score ?? 0, at: r.at! }));
}

/** Seconds after `since` at which each of the next `target` levels above `startLevel` was first passed. Stops at the first gap. */
export function splitsOf(rs: { level: number; at: number }[], startLevel: number, target: number, since: number): number[] {
  const out: number[] = [];
  for (let k = 1; k <= target; k++) {
    const hit = rs.find((r) => r.level >= startLevel + k);
    if (!hit) break;
    out.push(Math.max(1, hit.at - since));
  }
  return out;
}

/** How long an attempt may run: as long as the contest did, so the record chase is the same race. */
export const attemptWindow = (c: Competition) => Math.max(86400, c.endsAt - c.startsAt);

export function attemptView(c: Competition, a: Attempt, at = now()): AttemptView {
  const deadline = a.startedAt + attemptWindow(c);
  const rs = passes([a.userId], c.trackId, a.startedAt, a.status === "active" ? Math.min(at, deadline) : (a.finishedAt ?? deadline));
  return { attempt: a, splits: splitsOf(rs, a.startLevel, a.target, a.startedAt), deadline, secondsLeft: Math.max(0, deadline - at) };
}

/**
 * Closes every running attempt on this contest that has reached its goal or run out of time, so the board only ever
 * shows final times. Safe to call on every page view: the update only touches rows that are still active.
 */
export function settleAttempts(c: Competition, at = now()) {
  const active = db.select().from(contestAttempts).where(and(eq(contestAttempts.competitionId, c.id), eq(contestAttempts.status, "active"))).all();
  for (const a of active) {
    const v = attemptView(c, a, at);
    if (v.splits.length >= a.target && a.target > 0) {
      const secs = v.splits[a.target - 1];
      db.update(contestAttempts).set({ status: "finished", finishedAt: a.startedAt + secs, durationSec: secs })
        .where(and(eq(contestAttempts.id, a.id), eq(contestAttempts.status, "active"))).run();
    } else if (at >= v.deadline) {
      db.update(contestAttempts).set({ status: "expired", finishedAt: v.deadline })
        .where(and(eq(contestAttempts.id, a.id), eq(contestAttempts.status, "active"))).run();
    }
  }
}

/** Best exam time (start to finish of one exam) per person per level inside the contest window. Passing exams only. */
export type LevelTime = { userId: number; name: string; level: number; seconds: number; score: number };

export function levelTimes(c: Competition, members: Member[], only?: number): LevelTime[] {
  const humans = members.filter((m) => m.kind === "human" && m.status === "joined" && m.userId);
  if (!humans.length) return [];
  const joined = new Map(humans.map((m) => [m.userId!, Math.max(c.startsAt, m.joinedAt ?? c.startsAt)]));
  const rs = passes([...joined.keys()], c.trackId, c.startsAt, c.endsAt).filter((r) => r.at >= joined.get(r.userId)! && (only === undefined || r.level === only));
  const who = names([...joined.keys()]);
  const best = new Map<string, LevelTime>();
  for (const r of rs) {
    const sec = Math.max(1, r.at - r.startedAt), key = `${r.userId}:${r.level}`, cur = best.get(key);
    if (!cur || sec < cur.seconds || (sec === cur.seconds && r.score > cur.score)) best.set(key, { userId: r.userId, name: who.get(r.userId) ?? "Learner", level: r.level, seconds: sec, score: r.score });
  }
  return [...best.values()];
}

const byTime = (a: { seconds: number; score?: number }, b: { seconds: number; score?: number }) => a.seconds - b.seconds || (b.score ?? 0) - (a.score ?? 0);

export type Board = {
  entries: Entry[]; // fastest first, best time per person
  participants: number; // people who raced in the contest itself
  finishers: number; // of those, people who reached the goal inside the contest
  median: number | null;
  buckets: { from: number; to: number; count: number }[]; // histogram of finish times
  levelRecords: { level: number; holder: LevelTime; runnersUp: number }[]; // fastest single exam per level (two or more people)
  byUser: Map<number, Entry>;
};

const percentBeaten = (rank: number, n: number) => (n > 1 ? Math.round(((n - rank) / (n - 1)) * 100) : null);

/** Everything the time board shows. `viewerSeesPhotos` mirrors the avatar route: signed-in people see photos, strangers only contest players'. */
export function hallOfFame(c: Competition, rows: Standing[], members: Member[], viewerSeesPhotos: boolean): Board {
  const humans = rows.filter((r) => !r.isBot && r.userId !== null);
  const done = humans.filter((r) => r.reachedAt !== null);
  const sinceOf = new Map(members.filter((m) => m.userId).map((m) => [m.userId!, Math.max(c.startsAt, m.joinedAt ?? c.startsAt)]));
  const win = passes(done.map((r) => r.userId!), c.trackId, c.startsAt, c.endsAt);

  const entries: Omit<Entry, "rank" | "beaten" | "badges">[] = done.map((r) => {
    const since = sinceOf.get(r.userId!) ?? c.startsAt;
    const mine = win.filter((p) => p.userId === r.userId && p.at >= since);
    return {
      key: `c${r.member.id}`, userId: r.userId!, name: r.name, hasPhoto: r.hasPhoto, photoVersion: r.photoVersion,
      seconds: Math.max(1, r.reachedAt! - since), at: r.reachedAt!, source: "contest" as const,
      splits: splitsOf(mine, r.startLevel ?? 0, r.target, since),
    };
  });

  const finished = db.select().from(contestAttempts).where(and(eq(contestAttempts.competitionId, c.id), eq(contestAttempts.status, "finished"))).all();
  if (finished.length) {
    const ids = [...new Set(finished.map((a) => a.userId))];
    const who = names(ids);
    const photos = new Map(db.select({ id: userAvatars.userId, v: userAvatars.updatedAt }).from(userAvatars).where(inArray(userAvatars.userId, ids)).all().map((p) => [p.id, p.v]));
    for (const a of finished) {
      const rs = passes([a.userId], c.trackId, a.startedAt, a.finishedAt ?? a.startedAt);
      entries.push({
        key: `a${a.id}`, userId: a.userId, name: who.get(a.userId) ?? "Learner", hasPhoto: viewerSeesPhotos && photos.has(a.userId), photoVersion: photos.get(a.userId) ?? 0,
        seconds: a.durationSec ?? 1, at: a.finishedAt ?? a.startedAt, source: "challenge", splits: splitsOf(rs, a.startLevel, a.target, a.startedAt),
      });
    }
  }

  // one line per person: their best time
  const bestOf = new Map<number, (typeof entries)[number]>();
  for (const e of entries.sort((a, b) => a.seconds - b.seconds || a.at - b.at)) if (!bestOf.has(e.userId)) bestOf.set(e.userId, e);
  const sorted = [...bestOf.values()];
  const n = sorted.length;
  const ranked: Entry[] = sorted.map((e, i) => ({ ...e, rank: i + 1, beaten: percentBeaten(i + 1, n), badges: [] }));

  const lt = levelTimes(c, members);
  const levels = [...new Set(lt.map((x) => x.level))].sort((a, b) => a - b);
  const levelRecords = levels.map((level) => {
    const here = lt.filter((x) => x.level === level).sort(byTime);
    return { level, holder: here[0], runnersUp: here.length - 1 };
  }).filter((x) => x.runnersUp >= 1);

  const board: Board = {
    entries: ranked, participants: humans.length, finishers: done.length,
    median: n ? sorted[Math.floor((n - 1) / 2)].seconds : null,
    buckets: histogram(ranked.map((e) => e.seconds)),
    levelRecords, byUser: new Map(ranked.map((e) => [e.userId, e])),
  };
  award(c, board, humans, lt);
  return board;
}

function histogram(secs: number[], bins = 8): Board["buckets"] {
  if (secs.length < 3) return [];
  const lo = Math.min(...secs), hi = Math.max(...secs);
  if (hi === lo) return [];
  const w = (hi - lo) / bins;
  return Array.from({ length: bins }, (_, i) => ({
    from: lo + i * w, to: lo + (i + 1) * w,
    count: secs.filter((s) => (i === bins - 1 ? s >= lo + i * w : s >= lo + i * w && s < lo + (i + 1) * w)).length,
  }));
}

export const BADGES = {
  record: { id: "record", label: "Record holder", blurb: "Fastest time to the goal.", tone: "amber" },
  podium: { id: "podium", label: "Podium", blurb: "Top three fastest to the goal.", tone: "amber" },
  top10: { id: "top10", label: "Top 10%", blurb: "Faster than 90% of finishers (needs five or more).", tone: "violet" },
  top25: { id: "top25", label: "Top 25%", blurb: "Faster than 75% of finishers (needs five or more).", tone: "sky" },
  finisher: { id: "finisher", label: "Finisher", blurb: "Reached the goal.", tone: "emerald" },
  breaker: { id: "breaker", label: "Record breaker", blurb: "Came back after the contest and beat the contest's fastest time.", tone: "rose" },
  improved: { id: "improved", label: "Beat their own time", blurb: "Came back and finished faster than the first time.", tone: "pink" },
  speed: { id: "speed", label: "Speed demon", blurb: "Holds the fastest single exam on at least one level.", tone: "sky" },
  flawless: { id: "flawless", label: "Flawless", blurb: "Passed an exam with every answer right.", tone: "emerald" },
  steady: { id: "steady", label: "Steady", blurb: "Practised on five or more different days.", tone: "violet" },
} satisfies Record<string, Badge>;

/** Hands out badges from what is on the board. Derived, so they cannot drift from the results. */
function award(c: Competition, b: Board, humans: Standing[], lt: LevelTime[]) {
  const entries = b.entries;
  const give = (userId: number, badge: Badge) => { const e = b.byUser.get(userId); if (e && !e.badges.some((x) => x.id === badge.id)) e.badges.push(badge); };
  const n = entries.length;
  const flawless = new Set(lt.filter((x) => x.score >= 0.999).map((x) => x.userId));
  const speedy = new Set(b.levelRecords.map((l) => l.holder.userId));
  const originalBest = Math.min(Infinity, ...entries.filter((e) => e.source === "contest").map((e) => e.seconds));
  const firstTime = new Map<number, number>();
  for (const r of humans) if (r.reachedAt !== null) firstTime.set(r.userId!, Math.max(1, r.reachedAt - Math.max(c.startsAt, r.member.joinedAt ?? c.startsAt)));
  const att = db.select({ u: contestAttempts.userId, d: contestAttempts.durationSec }).from(contestAttempts)
    .where(and(eq(contestAttempts.competitionId, c.id), eq(contestAttempts.status, "finished"))).all();
  const bestAttempt = new Map<number, number>();
  for (const a of att) if (a.d !== null) bestAttempt.set(a.u, Math.min(a.d, bestAttempt.get(a.u) ?? Infinity));

  for (const e of entries) {
    if (e.rank === 1 && n >= 2) give(e.userId, BADGES.record);
    else if (e.rank <= 3 && n >= 3) give(e.userId, BADGES.podium);
    if (n >= 5 && e.beaten !== null) { if (e.beaten >= 90) give(e.userId, BADGES.top10); else if (e.beaten >= 75) give(e.userId, BADGES.top25); }
    give(e.userId, BADGES.finisher);
    const ba = bestAttempt.get(e.userId);
    if (ba !== undefined && originalBest !== Infinity && ba < originalBest) give(e.userId, BADGES.breaker);
    const ft = firstTime.get(e.userId);
    if (ba !== undefined && ft !== undefined && ba < ft) give(e.userId, BADGES.improved);
    if (speedy.has(e.userId)) give(e.userId, BADGES.speed);
    if (flawless.has(e.userId)) give(e.userId, BADGES.flawless);
    if ((humans.find((r) => r.userId === e.userId)?.practiceDays ?? 0) >= 5) give(e.userId, BADGES.steady);
  }
}

/** Badges for people who have not reached the goal yet (they are not on the time board). */
export function raceBadges(b: Board, humans: Standing[], userId: number): Badge[] {
  const e = b.byUser.get(userId);
  if (e) return e.badges;
  const out: Badge[] = [];
  if (b.levelRecords.some((l) => l.holder.userId === userId)) out.push(BADGES.speed);
  if ((humans.find((r) => r.userId === userId)?.practiceDays ?? 0) >= 5) out.push(BADGES.steady);
  return out;
}

/**
 * For someone still racing: how long they are on course to take, and how that would rank. Needs at least one level gained;
 * it is a straight-line estimate, shown as such.
 */
export function projection(c: Competition, r: Standing, b: Board, at = now()): { seconds: number; beats: number | null } | null {
  if (r.isBot || r.reachedAt !== null || r.gained < 1 || r.target < 1 || r.userId === null) return null;
  const since = Math.max(c.startsAt, r.member.joinedAt ?? c.startsAt);
  const elapsed = Math.min(at, c.endsAt) - since;
  if (elapsed <= 0) return null;
  const seconds = Math.round((elapsed * r.target) / r.gained);
  const others = b.entries.filter((e) => e.userId !== r.userId);
  return { seconds, beats: others.length ? Math.round((others.filter((e) => e.seconds > seconds).length / others.length) * 100) : null };
}

// ---- record attempts: who may start one, and the start itself ----

export const MAX_RUNNING_ATTEMPTS = 5;

export function attemptsOf(c: Competition, userId: number): Attempt[] {
  return db.select().from(contestAttempts).where(and(eq(contestAttempts.competitionId, c.id), eq(contestAttempts.userId, userId))).orderBy(contestAttempts.startedAt).all();
}

/** Where a new attempt would start from: levels already held count as done, exactly as they do in the contest. */
export function attemptStart(userId: number, c: Competition, at = now()) {
  const startLevel = baselineLevel(userId, c.trackId, at);
  return { startLevel, target: Math.min(c.goalLevels, Math.max(0, MAX_LEVEL - startLevel)) };
}

export const canChallenge = (c: Competition) => stateOf(c) === "finished";

export const runningAttempts = (userId: number) =>
  db.select({ n: sql<number>`count(*)` }).from(contestAttempts).where(and(eq(contestAttempts.userId, userId), eq(contestAttempts.status, "active"))).get()?.n ?? 0;

// ---- the live exam clock ----

/**
 * The fastest passing exam at this level in a live contest the person is racing in, so the exam can show a time to beat.
 * Null when they are in no live contest on the track or nobody has passed the level yet.
 */
export function levelRecordToBeat(userId: number, trackId: number, level: number, at = now()): { seconds: number; holder: string; mine: boolean; title: string; slug: string } | null {
  const mine = db.select({ c: competitions }).from(competitionMembers)
    .innerJoin(competitions, eq(competitions.id, competitionMembers.competitionId))
    .where(and(eq(competitionMembers.userId, userId), eq(competitionMembers.status, "joined"), eq(competitions.trackId, trackId))).all()
    .map((r) => r.c).filter((c) => stateOf(c, at) === "live");
  let best: { seconds: number; holder: string; mine: boolean; title: string; slug: string } | null = null;
  for (const c of mine) {
    const members = db.select().from(competitionMembers).where(eq(competitionMembers.competitionId, c.id)).all();
    const top = levelTimes(c, members, level).sort(byTime)[0];
    if (top && (!best || top.seconds < best.seconds)) best = { seconds: top.seconds, holder: top.name, mine: top.userId === userId, title: c.title, slug: c.slug };
  }
  return best;
}

/** How one finished exam did against others' exams at the same level in each contest the person raced in. */
export function examStanding(userId: number, run: { trackId: number; level: number; startedAt: number; finishedAt: number | null; passed: boolean | null }) {
  if (!run.passed || run.finishedAt === null) return [];
  const mine = Math.max(1, run.finishedAt - run.startedAt);
  const cs = db.select({ c: competitions }).from(competitionMembers)
    .innerJoin(competitions, eq(competitions.id, competitionMembers.competitionId))
    .where(and(eq(competitionMembers.userId, userId), eq(competitionMembers.status, "joined"), eq(competitions.trackId, run.trackId))).all()
    .map((r) => r.c).filter((c) => !c.canceledAt && run.finishedAt! >= c.startsAt && run.finishedAt! <= c.endsAt);
  return cs.map((c) => {
    const members = db.select().from(competitionMembers).where(eq(competitionMembers.competitionId, c.id)).all();
    const all = levelTimes(c, members, run.level).sort(byTime);
    const others = all.filter((x) => x.userId !== userId);
    const best = all[0];
    return {
      slug: c.slug, title: c.title, seconds: mine, people: all.length,
      record: best ? { seconds: best.seconds, holder: best.name, mine: best.userId === userId } : null,
      isRecord: !!best && best.userId === userId && best.seconds === mine && others.length > 0,
      beaten: others.length ? Math.round((others.filter((x) => x.seconds > mine).length / others.length) * 100) : null,
    };
  });
}

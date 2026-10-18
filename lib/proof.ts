import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { certificates, competitionMembers, competitions, dailyQuests, db, enrollments, runs, users } from "@/lib/db";

/**
 * Honest social proof: real numbers about what people are doing here, shown only when they say something. Nothing is made up and nothing is rounded up.
 * A count is shown only when at least MIN_SHOWN people are behind it, so a small number never looks sad and never points at an individual
 * ("1 person passed level 5 today" is someone). Counts are of everyone active, whatever they chose for the boards, because they say who each person is not.
 */
export const MIN_SHOWN = 5;
const DAY = 86400;

/** A count worth showing, or null. */
export const shown = (n: number, min = MIN_SHOWN): number | null => (n >= min ? n : null);

export type SiteProof = {
  /** people who did a quest or finished an exam in the last 7 days */ learners: number | null;
  /** distinct levels passed in the last 7 days (counted once per person and topic) */ levels: number | null;
  /** certificates issued, not revoked */ certificates: number | null;
  /** people taking part in public races that are running now */ racers: number | null;
  /** public races running now, which anyone can join: a fact about what is on offer, not about people */ races: number;
};

const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

export type RawProof = { learners: number; levels: number; certificates: number; racers: number; races: number };

/** The true counts, with nothing hidden. Only the tests and the filter below use these. */
export function rawSiteProof(at = Math.floor(Date.now() / 1000)): RawProof {
  const since = at - 7 * DAY;
  const active = new Set<number>();
  for (const r of db.select({ u: runs.userId }).from(runs).innerJoin(users, eq(users.id, runs.userId)).where(and(gte(runs.finishedAt, since), lt(runs.finishedAt, at + 1), eq(users.status, "active"))).all()) active.add(r.u);
  for (const q of db.select({ u: dailyQuests.userId }).from(dailyQuests).innerJoin(users, eq(users.id, dailyQuests.userId)).where(and(gte(dailyQuests.day, iso(since)), sql`${dailyQuests.day} <= ${iso(at)}`, eq(users.status, "active"))).all()) active.add(q.u);
  const levels = Number(db.select({ n: sql<number>`count(*)` }).from(db.select({ u: runs.userId, t: runs.trackId, l: runs.level }).from(runs).where(and(eq(runs.passed, true), gte(runs.finishedAt, since), lt(runs.finishedAt, at + 1))).groupBy(runs.userId, runs.trackId, runs.level).as("p")).get()?.n ?? 0);
  const certs = Number(db.select({ n: sql<number>`count(*)` }).from(certificates).where(isNull(certificates.revokedAt)).get()?.n ?? 0);
  const live = and(eq(competitions.visibility, "public"), isNull(competitions.canceledAt), sql`${competitions.startsAt} <= ${at}`, sql`${competitions.endsAt} > ${at}`);
  const racers = Number(db.select({ n: sql<number>`count(distinct ${competitionMembers.userId})` }).from(competitionMembers).innerJoin(competitions, eq(competitions.id, competitionMembers.competitionId))
    .where(and(live, eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).get()?.n ?? 0);
  const races = Number(db.select({ n: sql<number>`count(*)` }).from(competitions).where(live).get()?.n ?? 0);
  return { learners: active.size, levels, certificates: certs, racers, races };
}

/** The numbers, worked out fresh, with every people-count below the bar left out. */
export function computeSiteProof(at = Math.floor(Date.now() / 1000)): SiteProof {
  const r = rawSiteProof(at);
  return { learners: shown(r.learners), levels: shown(r.levels), certificates: shown(r.certificates), racers: shown(r.racers), races: r.races };
}

let cached: { at: number; v: SiteProof } | null = null;
/** The numbers, kept for five minutes so a busy front page does not recount them on every visit. */
export function siteProof(): SiteProof {
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.v;
  const v = computeSiteProof();
  cached = { at: Date.now(), v };
  return v;
}

export type TopicProof = { learners: number | null; passedThisMonth: number | null };

/** The true counts for one topic: people enrolled, and people who passed a level in it in the last 30 days. */
export function rawTopicProof(trackId: number, at = Math.floor(Date.now() / 1000)): { learners: number; passedThisMonth: number } {
  const learners = Number(db.select({ n: sql<number>`count(distinct ${enrollments.userId})` }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).where(and(eq(enrollments.trackId, trackId), eq(users.status, "active"))).get()?.n ?? 0);
  const passed = Number(db.select({ n: sql<number>`count(distinct ${runs.userId})` }).from(runs).where(and(eq(runs.trackId, trackId), eq(runs.passed, true), gte(runs.finishedAt, at - 30 * DAY), lt(runs.finishedAt, at + 1))).get()?.n ?? 0);
  return { learners, passedThisMonth: passed };
}

/** Who is on one topic, with each count left out when fewer than the bar are behind it. */
export function topicProof(trackId: number, at = Math.floor(Date.now() / 1000)): TopicProof {
  const r = rawTopicProof(trackId, at);
  return { learners: shown(r.learners), passedThisMonth: shown(r.passedThisMonth) };
}

/** The phrases for what is worth saying, in order. Empty when there is nothing that clears the bar. */
export function proofLines(p: SiteProof): string[] {
  const n = (x: number) => x.toLocaleString("en-GB");
  const out: string[] = [];
  if (p.learners) out.push(`${n(p.learners)} people practised this week`);
  if (p.levels) out.push(`${n(p.levels)} levels passed this week`);
  if (p.certificates) out.push(`${n(p.certificates)} certificates earned`);
  if (p.racers) out.push(`${n(p.racers)} people racing right now`);
  return out;
}

import { and, eq, gt, isNull, max, or } from "drizzle-orm";
import { db, enrollments, levelCredits, runs } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";

/** A starting level someone was given (lib/credits.ts) is in force until it is revoked or runs out. */
export const creditInForce = (at = Math.floor(Date.now() / 1000)) => and(isNull(levelCredits.revokedAt), or(isNull(levelCredits.expiresAt), gt(levelCredits.expiresAt, at)));

/** The highest starting level in force for a person in a track (0 = none). `completeOnly` keeps just the ones an admin marked "counts as complete". */
export function creditLevel(userId: number, trackId: number, completeOnly = false): number {
  const row = db.select({ m: max(levelCredits.level) }).from(levelCredits)
    .where(and(eq(levelCredits.userId, userId), eq(levelCredits.trackId, trackId), creditInForce(), completeOnly ? eq(levelCredits.countsAsComplete, true) : undefined)).get();
  return row?.m ?? 0;
}

/**
 * Highest level passed in a track (0 = none), counting the starting point found by the placement check and any starting level someone
 * was given. Next playable level = passed + 1.
 */
export function levelsPassed(userId: number, trackId: number): number {
  const row = db
    .select({ m: max(runs.level) })
    .from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true)))
    .get();
  const placed = db.select({ p: enrollments.placedLevel }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId))).get()?.p ?? 0;
  return Math.min(Math.max(row?.m ?? 0, placed, creditLevel(userId, trackId)), MAX_LEVEL);
}

/**
 * Highest level passed by a real exam (0 = none), plus any starting level an admin marked "counts as complete". Unlike `levelsPassed` this
 * ignores the placement check and ordinary starting levels, which say where to start, so it is what required learning and promotions
 * are measured against.
 */
export function levelsEarned(userId: number, trackId: number): number {
  const row = db.select({ m: max(runs.level) }).from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true))).get();
  return Math.min(Math.max(row?.m ?? 0, creditLevel(userId, trackId, true)), MAX_LEVEL);
}

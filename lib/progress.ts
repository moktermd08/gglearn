import { and, eq, max } from "drizzle-orm";
import { db, enrollments, runs } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";

/** Highest level passed in a track (0 = none), counting the starting point found by the placement check. Next playable level = passed + 1. */
export function levelsPassed(userId: number, trackId: number): number {
  const row = db
    .select({ m: max(runs.level) })
    .from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true)))
    .get();
  const placed = db.select({ p: enrollments.placedLevel }).from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId))).get()?.p ?? 0;
  return Math.min(Math.max(row?.m ?? 0, placed), MAX_LEVEL);
}

/**
 * Highest level passed by a real exam (0 = none). Unlike `levelsPassed` this ignores the placement check, which is a guess at
 * where to start, so it is what required learning and promotions are measured against.
 */
export function levelsEarned(userId: number, trackId: number): number {
  const row = db.select({ m: max(runs.level) }).from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true))).get();
  return Math.min(row?.m ?? 0, MAX_LEVEL);
}

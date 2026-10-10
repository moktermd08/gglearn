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

import { and, eq, max } from "drizzle-orm";
import { db, runs } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";

/** Highest level passed in a track (0 = none). Next playable level = passed + 1. */
export function levelsPassed(userId: number, trackId: number): number {
  const row = db
    .select({ m: max(runs.level) })
    .from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true)))
    .get();
  return Math.min(row?.m ?? 0, MAX_LEVEL);
}

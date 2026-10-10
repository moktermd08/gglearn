import { and, eq, inArray, sql } from "drizzle-orm";
import { db, journeys, questions } from "@/lib/db";

export const PLACEMENT_BATCH = 3; // questions per probed level
export const PLACEMENT_PASS = 2; // correct answers needed to count the level as mastered
export const PLACEMENT_CAP = 15; // higher levels have to be earned by exam; the check never skips past Master

type Journey = typeof journeys.$inferSelect;

/**
 * Binary search for the level a person already knows. `lo` is the highest level believed mastered, `hi` the highest it
 * could still be. Each round probes the middle level with a few multiple-choice questions: pass raises `lo`, fail lowers `hi`.
 * Levels without enough questions are skipped by probing the nearest level that has them.
 */
export function nextProbe(j: Pick<Journey, "lo" | "hi" | "trackId">): { level: number; ids: number[] } | null {
  const { lo } = j;
  let { hi } = j;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const ids = db.select({ id: questions.id }).from(questions)
      .where(and(eq(questions.trackId, j.trackId), eq(questions.level, mid), eq(questions.type, "mcq"), eq(questions.status, "active")))
      .orderBy(sql`random()`).limit(PLACEMENT_BATCH).all().map((r) => r.id);
    if (ids.length >= PLACEMENT_BATCH) return { level: mid, ids };
    // not enough material at this level: treat it as untestable and narrow the range from above
    hi = mid - 1;
  }
  return null;
}

/** True when the track has enough multiple-choice questions to run a meaningful check at all. */
export function canPlace(trackId: number): boolean {
  return nextProbe({ lo: 0, hi: PLACEMENT_CAP, trackId }) !== null;
}

/** Marks a batch: how many of `ids` the person got right, from the posted answers. Unanswered counts as wrong. */
export function scoreBatch(ids: number[], answerFor: (id: number) => string): { right: number; level: number } {
  const rows = ids.length ? db.select({ id: questions.id, answer: questions.answer, level: questions.level }).from(questions).where(inArray(questions.id, ids)).all() : [];
  let right = 0;
  for (const q of rows) if (q.answer && answerFor(q.id) === q.answer) right++;
  return { right, level: rows[0]?.level ?? 0 };
}

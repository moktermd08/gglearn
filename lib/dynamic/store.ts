import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { answers, db, questions, runs } from "@/lib/db";
import { familiesFor, generate, keyOf } from "./engine";

/** How many of a level exam's 10 questions are freshly generated. If the stored pool is thin, generated ones fill the gap. */
export const DYNAMIC_PER_RUN = 7;

/** Generated questions this learner has already been asked on the track, as level|prompt keys. */
function seenKeys(userId: number, trackId: number): Set<string> {
  const rows = db.select({ level: questions.level, prompt: questions.prompt }).from(answers)
    .innerJoin(runs, eq(runs.id, answers.runId)).innerJoin(questions, eq(questions.id, answers.questionId))
    .where(and(eq(runs.userId, userId), eq(questions.trackId, trackId), eq(questions.source, "dynamic"))).all();
  return new Set(rows.map((r) => keyOf(r.level, r.prompt)));
}

export const hasDynamic = (slug: string, level: number) => familiesFor(slug, level).length > 0;

/**
 * Returns ids of `count` generated questions this learner has never been asked, creating rows as needed.
 * A row is a snapshot of one question instance (the answer key lives only on the server). Identical instances are shared
 * between learners, never repeated for the same learner. Fewer than `count` come back only when the families run dry.
 */
export function drawDynamic(userId: number, track: { id: number; slug: string }, level: number, count: number): number[] {
  if (count <= 0 || !hasDynamic(track.slug, level)) return [];
  const seen = seenKeys(userId, track.id), ids: number[] = [];
  for (let round = 0; round < 4 && ids.length < count; round++) {
    const batch = generate(track.slug, level, count - ids.length, seen, randomBytes(8).toString("hex"));
    if (!batch.length) break;
    for (const g of batch) {
      const key = keyOf(level, g.prompt);
      seen.add(key);
      const existing = db.select().from(questions).where(and(eq(questions.trackId, track.id), eq(questions.level, level), eq(questions.prompt, g.prompt))).get();
      if (existing) {
        // same prompt: reuse only if it is the very same generated instance, otherwise the unique index forbids a second row
        if (existing.source === "dynamic" && (existing.code ?? null) === g.code) ids.push(existing.id);
        continue;
      }
      const row = db.insert(questions).values({
        trackId: track.id, level, type: "mcq", prompt: g.prompt, code: g.code, options: g.options, answer: g.answer,
        hint: g.hint, topic: g.topic, weight: 10, timeSec: 60, source: "dynamic", status: "generated",
      }).returning({ id: questions.id }).get();
      ids.push(row.id);
    }
  }
  return ids;
}

import { and, eq, inArray, sql } from "drizzle-orm";
import { db, enrollments, questions, type users } from "@/lib/db";
import { enrol } from "@/lib/contests";
import { diagnose } from "@/lib/careerDoctor";
import { now } from "@/lib/competitions";

type Person = typeof users.$inferSelect;

/** The level the taster asks at, and how many questions per field. All right counts as that level mastered, the same bar the placement check sets. */
export const TASTE_LEVEL = 3, TASTE_SIZE = 3, TASTE_FIELDS = 6;

export type TasterQuestion = { id: number; prompt: string; code: string | null; options: { key: string; text: string }[] };
export type TasterField = { family: string; trackId: number; name: string; questions: TasterQuestion[] };
export type TasterResult = { family: string; name: string; right: number; of: number; placed: boolean };

const pool = (trackId: number) => and(eq(questions.trackId, trackId), eq(questions.level, TASTE_LEVEL), eq(questions.type, "mcq"), eq(questions.status, "active"));
const poolSize = (trackId: number) => Number(db.select({ n: sql<number>`count(*)` }).from(questions).where(pool(trackId)).get()?.n ?? 0);

/**
 * One area from each of several fields the person has no result in yet, so a single sitting touches coding, management, marketing and so on.
 * The area is the untried one most of that field's roles ask for. Answers are never sent out: they are looked up again when the form is posted.
 */
export function tasterFor(person: Person): TasterField[] {
  const out: TasterField[] = [];
  for (const f of diagnose(person).families) {
    if (out.length >= TASTE_FIELDS) break;
    const count = new Map<number, { name: string; trackId: number; n: number }>();
    for (const r of f.roles) for (const a of r.areas) if (!a.tested) count.set(a.trackId, { name: a.name, trackId: a.trackId, n: (count.get(a.trackId)?.n ?? 0) + 1 });
    const pick = [...count.values()].sort((a, b) => b.n - a.n).find((c) => poolSize(c.trackId) >= TASTE_SIZE);
    if (!pick) continue;
    const qs = db.select().from(questions).where(pool(pick.trackId)).orderBy(sql`random()`).limit(TASTE_SIZE).all();
    out.push({ family: f.family, trackId: pick.trackId, name: pick.name, questions: qs.map((q) => ({ id: q.id, prompt: q.prompt, code: q.code, options: (q.options ?? []).map((o) => ({ key: o.key, text: o.text })) })) });
  }
  return out;
}

/**
 * Marks one field's answers. The question ids come from the page, so each is checked again: it must be one of exactly TASTE_SIZE different live
 * level-TASTE_LEVEL multiple-choice questions of that track. All right records the level as the person's starting point (only ever raised).
 */
export function markField(person: Person, trackId: number, ids: number[], pick: (id: number) => string): Omit<TasterResult, "family" | "name"> | null {
  const unique = [...new Set(ids)];
  if (unique.length !== TASTE_SIZE) return null;
  const rows = db.select().from(questions).where(and(pool(trackId), inArray(questions.id, unique))).all();
  if (rows.length !== TASTE_SIZE) return null;
  const right = rows.filter((q) => q.answer && pick(q.id).toLowerCase() === q.answer.toLowerCase()).length;
  const placed = right === TASTE_SIZE;
  if (placed) db.transaction((tx) => {
    enrol(tx, person.id, trackId, "Career doctor taster");
    const e = tx.select().from(enrollments).where(and(eq(enrollments.userId, person.id), eq(enrollments.trackId, trackId))).get();
    if (e && e.placedLevel < TASTE_LEVEL) tx.update(enrollments).set({ placedLevel: TASTE_LEVEL, placedAt: now() }).where(eq(enrollments.id, e.id)).run();
  });
  return { right, of: TASTE_SIZE, placed };
}

/**
 * Imports authored knowledge items and their questions from JSON files.
 *   npm run import:knowledge -- path/to/moksy.json [more.json ...]
 * File shape: { trackSlug, status?, lessons?, items: [{ title, body, questions: [{ level, type, prompt, options?, answer, ... }] }] }
 * "status": "review" saves the questions as unpublished until an admin activates them (default "active").
 * "lessons": [{ level, title, syllabus: string[] }] sets the study guide for those levels (updated in place).
 * Idempotent: an item is matched by (track, title) and a question by the (track, level, prompt) unique index.
 * Changing an existing item's body bumps its version and records the change (lib/freshness.ts); existing questions are left alone.
 * Add "changeNote": "what changed" to an item to make it a material change that enrolled learners are asked to read.
 */
import fs from "node:fs";
import { db, tracks, knowledgeItems, lessons, questions } from "../lib/db";
import { and, eq } from "drizzle-orm";
import { recordChange } from "../lib/freshness";

type Q = {
  level: number; type: "mcq" | "open" | "scenario"; prompt: string;
  options?: { key: string; text: string }[]; answer: string;
  rubric?: string; hint?: string; topic?: string;
};
type File = { trackSlug: string; status?: "active" | "review"; lessons?: { level: number; title: string; syllabus: string[] }[]; items: { title: string; body: string; changeNote?: string; questions: Q[] }[] };

function validate(f: File, name: string): string[] {
  const errs: string[] = [];
  if (f.status && f.status !== "active" && f.status !== "review") errs.push(`${name}: status must be "active" or "review"`);
  for (const l of f.lessons ?? []) if (!Number.isInteger(l.level) || l.level < 1 || l.level > 20 || !l.title || !Array.isArray(l.syllabus) || !l.syllabus.length) errs.push(`${name}: bad lesson for level ${l.level}`);
  const seen = new Set<string>();
  for (const it of f.items) {
    if (!it.title || !it.body) errs.push(`${name}: item missing title/body`);
    for (const q of it.questions) {
      const at = `${name} / ${it.title} / "${q.prompt?.slice(0, 40)}"`;
      if (!q.prompt || !q.answer) errs.push(`${at}: missing prompt/answer`);
      if (!Number.isInteger(q.level) || q.level < 1 || q.level > 20) errs.push(`${at}: bad level`);
      if (seen.has(q.prompt)) errs.push(`${at}: duplicate prompt`);
      seen.add(q.prompt);
      if (q.type === "mcq") {
        const keys = (q.options ?? []).map((o) => o.key);
        if (keys.length < 2 || new Set(keys).size !== keys.length) errs.push(`${at}: bad options`);
        if (!keys.includes(q.answer)) errs.push(`${at}: answer "${q.answer}" not in options`);
      } else if (!q.rubric) errs.push(`${at}: ${q.type} needs a rubric`);
    }
  }
  return errs;
}

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: import-knowledge <file.json> ..."); process.exit(1); }

const parsed = files.map((p) => ({ p, f: JSON.parse(fs.readFileSync(p, "utf8")) as File }));
const errors = parsed.flatMap(({ p, f }) => validate(f, p));
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

for (const { p, f } of parsed) {
  const track = db.select().from(tracks).where(eq(tracks.slug, f.trackSlug)).get();
  if (!track) { console.error(`${p}: track not found: ${f.trackSlug}`); process.exit(1); }
  let nItems = 0, nQ = 0, nSkipped = 0;
  for (const it of f.items) {
    let item = db.select().from(knowledgeItems)
      .where(and(eq(knowledgeItems.trackId, track.id), eq(knowledgeItems.title, it.title))).get();
    if (!item) {
      item = db.insert(knowledgeItems).values({ trackId: track.id, title: it.title, body: it.body }).returning().get();
      nItems++;
    } else if (item.body !== it.body) {
      // "changeNote" marks a real change people must read; without it the edit is recorded as a wording fix
      recordChange(db, item, it.body, { note: it.changeNote, material: !!it.changeNote });
      item = db.select().from(knowledgeItems).where(eq(knowledgeItems.id, item.id)).get()!;
    }
    for (const q of it.questions) {
      const r = db.insert(questions).values({
        trackId: track.id, knowledgeItemId: item.id, source: "authored",
        level: q.level, type: q.type, prompt: q.prompt, options: q.options ?? null,
        answer: q.answer, rubric: q.rubric ?? null, hint: q.hint ?? null, topic: q.topic ?? it.title, status: f.status ?? "active",
      }).onConflictDoNothing().run();
      if (r.changes) nQ++; else nSkipped++;
    }
  }
  for (const l of f.lessons ?? []) {
    db.insert(lessons).values({ trackId: track.id, level: l.level, title: l.title, syllabus: l.syllabus })
      .onConflictDoUpdate({ target: [lessons.trackId, lessons.level], set: { title: l.title, syllabus: l.syllabus } }).run();
  }
  console.log(`${f.trackSlug}: ${nItems} new items, ${nQ} new questions, ${nSkipped} already present, ${f.lessons?.length ?? 0} lessons`);
}

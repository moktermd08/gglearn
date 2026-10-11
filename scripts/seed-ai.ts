/**
 * Builds the AI technologies tracks from scripts/ai/data/*.ts.
 *   npm run seed:ai                    add tracks that have no AI-generated questions yet
 *   npm run seed:ai -- --reset         regenerate: replaces this script's questions (those already answered by a learner are retired, not deleted)
 *   npm run seed:ai -- <slug> ...      only these tracks
 * Generation is deterministic (seeded by slug), so the same data always yields the same bank.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { answers, brands, db, lessons, questions, tracks } from "../lib/db";
import { LEVELS } from "../lib/levels";
import { generate, levelOf, shuffled, LEVEL_COUNT, MIN_PER_LEVEL } from "./ai/engine";
import { makeRng } from "./ai/rng";
import type { TrackSpec } from "./ai/types";

const dir = path.join(__dirname, "ai", "data");
const reset = process.argv.includes("--reset");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

(async () => {
  const brand = db.select().from(brands).where(eq(brands.slug, "titan-academy")).get()
    ?? db.insert(brands).values({ slug: "titan-academy", name: "Titan Academy", tagline: "Race a rival to Titan" }).returning().get();

  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
    const slug = f.replace(".ts", "");
    if (only.length && !only.includes(slug)) continue;
    const spec: TrackSpec = (await import(path.join(dir, f))).default;
    if (spec.slug !== slug) { console.log(`${slug}: slug mismatch, skipped`); continue; }

    const { qs } = generate(spec);
    const per = Array(LEVEL_COUNT).fill(0);
    qs.forEach((_, i) => per[levelOf(i, qs.length) - 1]++);
    if (Math.min(...per) < MIN_PER_LEVEL) { console.log(`${slug}: only ${Math.min(...per)} questions on the thinnest level (need ${MIN_PER_LEVEL}), skipped`); continue; }

    const track = db.select().from(tracks).where(eq(tracks.slug, slug)).get()
      ?? db.insert(tracks).values({ brandId: brand.id, slug, name: spec.name, kind: "technology", roles: spec.roles, description: spec.description }).returning().get();
    db.update(tracks).set({ name: spec.name, roles: spec.roles, description: spec.description }).where(eq(tracks.id, track.id)).run();

    const mine = and(eq(questions.trackId, track.id), eq(questions.source, "ai"));
    const existing = db.select({ n: sql<number>`count(*)` }).from(questions).where(mine).get()!.n;
    if (existing && !reset) { console.log(`${slug}: already has ${existing} AI questions, left alone (use --reset)`); continue; }

    const rng = makeRng(slug + ":options");
    db.transaction((tx) => {
      if (existing) {
        const ids = tx.select({ id: questions.id }).from(questions).where(mine).all().map((x) => x.id);
        const used = new Set<number>();
        for (let i = 0; i < ids.length; i += 500) for (const a of tx.select({ q: answers.questionId }).from(answers).where(inArray(answers.questionId, ids.slice(i, i + 500))).all()) used.add(a.q);
        const gone = ids.filter((id) => !used.has(id));
        for (let i = 0; i < gone.length; i += 500) tx.delete(questions).where(inArray(questions.id, gone.slice(i, i + 500))).run();
        for (const id of used) tx.update(questions).set({ status: "retired", prompt: sql`'[retired #' || ${id} || '] ' || prompt` }).where(eq(questions.id, id)).run();
      }
      const rows = qs.map((q, i) => {
        const { options, answer } = shuffled(q, rng);
        return { trackId: track.id, level: levelOf(i, qs.length), type: "mcq" as const, prompt: q.prompt, code: q.code ?? null, options, answer, hint: q.hint ?? null,
          topic: q.topic, weight: 10, timeSec: q.timeSec, source: "ai" as const };
      });
      for (let i = 0; i < rows.length; i += 400) tx.insert(questions).values(rows.slice(i, i + 400)).onConflictDoNothing().run();

      // study guide: the concepts that show up most at each level
      for (let level = 1; level <= LEVEL_COUNT; level++) {
        const count = new Map<string, { n: number; blurb: string }>();
        qs.forEach((q, i) => { if (q.blurb && levelOf(i, qs.length) === level) count.set(q.subject!, { n: (count.get(q.subject!)?.n ?? 0) + 1, blurb: q.blurb }); });
        const syllabus = [...count.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.blurb);
        if (!syllabus.length) continue;
        tx.insert(lessons).values({ trackId: track.id, level, title: LEVELS[level - 1], syllabus })
          .onConflictDoUpdate({ target: [lessons.trackId, lessons.level], set: { title: LEVELS[level - 1], syllabus } }).run();
      }
    });
    console.log(`${slug}: ${qs.length} questions (${Math.min(...per)}-${Math.max(...per)} per level)`);
  }
})();

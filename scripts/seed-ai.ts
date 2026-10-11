/**
 * Builds question banks from concept cards: the AI technologies tracks in scripts/ai/data/*.ts, or with --cards the company,
 * product, service, process, tool and leadership tracks in content/cards/*.json (npm run seed:cards).
 *   npm run seed:ai                    add tracks that have no engine-generated questions yet
 *   npm run seed:ai -- --reset         regenerate: replaces this script's questions (those already answered by a learner are retired, not deleted)
 *   npm run seed:ai -- <slug> ...      only these tracks
 * With --cards a track that already exists keeps its own name, brand, kind, roles and policy (the card file only adds questions
 * and a study guide for levels that have none). A new card track is created from the card file's kind, brand, audience and tier.
 * Generation is deterministic (seeded by slug), so the same data always yields the same bank.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { answers, brands, db, lessons, questions, tracks } from "../lib/db";
import { LEVELS } from "../lib/levels";
import { generate, levelOf, shuffled, LEVEL_COUNT } from "./ai/engine";
import { makeRng } from "./ai/rng";
import { loadSpecs, minPerLevelFor } from "./ai/specs";

const cards = process.argv.includes("--cards");
const reset = process.argv.includes("--reset");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

(async () => {
  const titan = db.select().from(brands).where(eq(brands.slug, "titan-academy")).get()
    ?? db.insert(brands).values({ slug: "titan-academy", name: "Titan Academy", tagline: "Race a rival to Titan" }).returning().get();

  for (const { slug, spec, origin } of await loadSpecs(cards ? "cards" : "ts", only)) {
    if (spec.slug !== slug) { console.log(`${slug}: slug mismatch, skipped`); continue; }

    const { qs } = generate(spec);
    const per = Array(LEVEL_COUNT).fill(0);
    qs.forEach((_, i) => per[levelOf(i, qs.length) - 1]++);
    const need = minPerLevelFor(spec, origin);
    if (Math.min(...per) < need) { console.log(`${slug}: only ${Math.min(...per)} questions on the thinnest level (need ${need}), skipped`); continue; }

    let track = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
    if (!track) {
      const brand = spec.brand ? db.select().from(brands).where(eq(brands.slug, spec.brand)).get() : titan;
      if (!brand) { console.log(`${slug}: brand "${spec.brand}" does not exist, skipped`); continue; }
      track = db.insert(tracks).values({ brandId: brand.id, slug, name: spec.name, kind: spec.kind ?? "technology", roles: spec.roles, description: spec.description,
        audience: spec.audience ?? "staff", tier: spec.tier ?? "growth", ...(cards ? { scope: spec.scope ?? "company" } : {}) }).returning().get();
    } else if (origin === "ts") {
      db.update(tracks).set({ name: spec.name, roles: spec.roles, description: spec.description }).where(eq(tracks.id, track.id)).run();
    }
    const trackId = track.id;

    const mine = and(eq(questions.trackId, trackId), eq(questions.source, "ai"));
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
        return { trackId, level: levelOf(i, qs.length), type: "mcq" as const, prompt: q.prompt, code: q.code ?? null, options, answer, hint: q.hint ?? null,
          topic: q.topic, weight: 10, timeSec: q.timeSec, source: "ai" as const };
      });
      for (let i = 0; i < rows.length; i += 400) tx.insert(questions).values(rows.slice(i, i + 400)).onConflictDoNothing().run();

      // study guide: the concepts that show up most at each level
      for (let level = 1; level <= LEVEL_COUNT; level++) {
        const count = new Map<string, { n: number; blurb: string }>();
        qs.forEach((q, i) => { if (q.blurb && levelOf(i, qs.length) === level) count.set(q.subject!, { n: (count.get(q.subject!)?.n ?? 0) + 1, blurb: q.blurb }); });
        const syllabus = [...count.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.blurb);
        if (!syllabus.length) continue;
        const row = tx.insert(lessons).values({ trackId, level, title: LEVELS[level - 1], syllabus });
        // an existing company track may already have a hand-written study guide; card tracks only fill the gaps
        if (origin === "cards") row.onConflictDoNothing().run();
        else row.onConflictDoUpdate({ target: [lessons.trackId, lessons.level], set: { title: LEVELS[level - 1], syllabus } }).run();
      }
    });
    console.log(`${slug}: ${qs.length} questions (${Math.min(...per)}-${Math.max(...per)} per level)`);
  }
})();

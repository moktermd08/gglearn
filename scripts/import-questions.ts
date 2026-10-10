/**
 * Imports subject folders from the `questions` repo as ONE track.
 *   npm run import:questions -- <track-slug> "<Track name>" <folder> [folder...]
 *   e.g. npm run import:questions -- git-titan "Git: Novice to Titan" git "GIT & GITHUB"
 * Repo location defaults to ../questions (override with QUESTIONS_DIR).
 *
 * The repo is messy (typo'd file names, invalid JSON, mixed field names, numeric and text difficulty), so this
 * normalises what it can, reports what it skips, and spreads questions evenly over the 20 levels easiest-first.
 * If a folder has topics.json with a `progression` map (Novice..Legend), it becomes the per-level syllabus.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, brands, tracks, questions, lessons } from "../lib/db";
import { LEVELS, MAX_LEVEL } from "../lib/levels";

const DIR = process.env.QUESTIONS_DIR ?? path.resolve(process.cwd(), "../questions");
const [slug, name, ...folders] = process.argv.slice(2);
if (!slug || !name || !folders.length) { console.error('usage: import-questions <slug> "<name>" <folder>...'); process.exit(1); }

type Raw = Record<string, unknown>;
const TEXT_DIFF: Record<string, number> = { beginner: 2, beginners: 2, novice: 1, intermediate: 5, advanced: 8, expert: 9, "extremely difficult": 10 };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const promptOf = (q: Raw) => str(q.question ?? q.question_text ?? q.questions_text);

function difficulty(q: Raw): number {
  if (typeof q.complexityLevel === "number") return q.complexityLevel;
  return TEXT_DIFF[str(q.complexity).toLowerCase()] ?? 5;
}

const bad: string[] = [];
const items: { q: Raw; d: number; order: number }[] = [];
let order = 0;
for (const folder of folders) {
  const dir = path.join(DIR, folder);
  if (!fs.existsSync(dir)) { console.error("missing folder", dir); continue; }
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !/^(topics?|exams?|structure)\.json$/i.test(f))) {
    let data: unknown;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")); } catch { bad.push(`${folder}/${file}`); continue; }
    if (!Array.isArray(data)) continue;
    for (const q of data as Raw[]) if (q && typeof q === "object") items.push({ q, d: difficulty(q), order: order++ });
  }
}

const brand = db.select().from(brands).where(eq(brands.slug, "titan-academy")).get()
  ?? db.insert(brands).values({ slug: "titan-academy", name: "Titan Academy", tagline: "Race a rival to Titan" }).returning().get();
const track = db.select().from(tracks).where(eq(tracks.slug, slug)).get()
  ?? db.insert(tracks).values({ brandId: brand.id, slug, name, kind: "technology", roles: "developer",
    description: `${name}. Study, drill and sit exams across 20 levels while a rival races you to Titan.` }).returning().get();

const seen = new Set<string>();
const valid = items.filter(({ q }) => {
  const p = promptOf(q);
  if (!p || !Array.isArray(q.answers) || q.answers.length < 2 || !str(q.correct_answer)) return false;
  const key = p + "|" + JSON.stringify(q.code ?? q.question_code ?? "");
  if (seen.has(key)) return false; // the repo repeats questions across files
  seen.add(key);
  return true;
});
valid.sort((a, b) => a.d - b.d || a.order - b.order); // easiest first; stable within a difficulty

let added = 0, dup = 0;
valid.forEach(({ q }, idx) => {
  const prompt0 = promptOf(q);
  const base = Math.min(MAX_LEVEL, 1 + Math.floor((idx / valid.length) * MAX_LEVEL));
  const code = (q.code ?? q.question_code) as unknown;
  const answers = q.answers as { option: string; text: string }[];
  // the unique index is (track, level, prompt) and many prompts are generic ("What does this command do?"),
  // so a collision moves the question to the nearest level where that prompt is free
  const firstLine = Array.isArray(code) && code.length ? String(code[0]).trim() : "";
  // last resort for generic prompts: name the snippet in the prompt so the index sees them as different
  for (const [shift, withCode] of [[0, false], [1, false], [-1, false], [2, false], [-2, false], [0, true], [1, true], [-1, true], [2, true], [-2, true]] as const) {
    const level = base + shift, prompt = withCode && firstLine ? `${prompt0} \`${firstLine.slice(0, 80)}\`` : prompt0;
    if (level < 1 || level > MAX_LEVEL) continue;
    const r = db.insert(questions).values({
      trackId: track.id, level, type: "mcq", prompt,
      code: Array.isArray(code) && code.length ? code.join("\n") : null,
      options: answers.map((a) => ({ key: str(a.option), text: str(a.text) })),
      answer: str(q.correct_answer), hint: str(q.answerHint) || null,
      topic: str(q.topic), weight: typeof q.QuestionWeight === "number" ? q.QuestionWeight : 10,
      timeSec: typeof q.maxTimeAllocation === "number" ? q.maxTimeAllocation : 60, source: "questions-repo",
    }).onConflictDoNothing().run();
    if (r.changes) { added++; return; }
  }
  dup++;
});

// syllabus -> lessons: N tiers share the 20 levels evenly, bullets split across each tier's levels
let lessonCount = 0;
for (const folder of folders) {
  const f = path.join(DIR, folder, "topics.json");
  if (!fs.existsSync(f)) continue;
  let prog: Record<string, string[]> | undefined;
  try { prog = JSON.parse(fs.readFileSync(f, "utf8")).progression; } catch { bad.push(`${folder}/topics.json`); }
  if (!prog) continue;
  const tiers = Object.entries(prog), per = MAX_LEVEL / tiers.length;
  tiers.forEach(([tier, bullets], ti) => {
    const first = Math.round(ti * per), last = Math.round((ti + 1) * per), span = Math.max(1, last - first);
    for (let l = first; l < last; l++) {
      const size = Math.ceil(bullets.length / span), slice = bullets.slice((l - first) * size, (l - first + 1) * size);
      if (!slice.length) continue;
      const level = l + 1, title = LEVELS[level - 1] === tier ? tier : `${LEVELS[level - 1]} · ${tier} syllabus`;
      db.insert(lessons).values({ trackId: track.id, level, title, syllabus: slice })
        .onConflictDoUpdate({ target: [lessons.trackId, lessons.level], set: { title, syllabus: slice } }).run();
      lessonCount++;
    }
  });
}
console.log(`${track.slug}: ${added} questions added, ${dup} duplicates skipped, ${valid.length} valid of ${items.length} read, ${lessonCount} lessons`);
if (bad.length) console.log(`invalid JSON, skipped (${bad.length}): ${bad.join(", ")}`);

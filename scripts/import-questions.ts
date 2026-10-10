/**
 * Imports subject folders from the `questions` repo as tracks in the Titan Academy brand.
 *   npm run import:questions -- <track-slug> "<Track name>" <folder> [folder...]
 *   e.g. npm run import:questions -- git-titan "Git: Novice to Titan" git "GIT & GITHUB"
 *   npm run import:questions -- --all [--dry]    every folder with 20+ usable questions becomes its own track
 * Repo location defaults to ../questions (override with QUESTIONS_DIR).
 *
 * The repo is messy (typo'd file names, invalid JSON, mixed field names, numeric and text difficulty), so this
 * normalises what it can, reports what it skips, and spreads questions evenly over the 20 levels easiest-first.
 * If a folder has topics.json with a `progression` map (Novice..Legend), it becomes the per-level syllabus.
 * A track that already has questions is left alone, so re-running is safe.
 */
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, brands, tracks, questions, lessons } from "../lib/db";
import { LEVELS, MAX_LEVEL } from "../lib/levels";

const DIR = process.env.QUESTIONS_DIR ?? path.resolve(process.cwd(), "../questions");
const MIN_QUESTIONS = 20; // fewer than this cannot fill 20 levels

type Raw = Record<string, unknown>;
const TEXT_DIFF: Record<string, number> = { beginner: 2, beginners: 2, novice: 1, intermediate: 5, advanced: 8, expert: 9, "extremely difficult": 10 };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const promptOf = (q: Raw) => str(q.question ?? q.question_text ?? q.questions_text);

function difficulty(q: Raw): number {
  if (typeof q.complexityLevel === "number") return q.complexityLevel;
  return TEXT_DIFF[str(q.complexity).toLowerCase()] ?? 5;
}

/** Parse a JSON array; if it is corrupt part-way, keep every complete element before the damage. */
function parseSalvage(text: string): { data: unknown; partial: boolean } | null {
  try { return { data: JSON.parse(text), partial: false }; } catch { /* try repairs */ }
  // a missing comma between two objects is the most common damage; `} {` is never valid JSON
  let t = text.replace(/\}(\s*)\{/g, "},$1{").replace(/\]\s*\n\s*\[(?=\s*\{)/g, ","); // also: two arrays glued together
  for (let i = 0; i < 5; i++) {
    try { return { data: JSON.parse(t), partial: !/\}(\s*)\{/.test(text) && t !== text }; } catch (e) {
      const m = /position (\d+)/.exec((e as Error).message);
      if (!m || !t.trimStart().startsWith("[")) return null;
      const cut = t.lastIndexOf("}", Number(m[1]));
      if (cut < 0) return null;
      t = t.slice(0, cut + 1).replace(/,\s*$/, "") + "]";
    }
  }
  return null;
}

/** Read, normalise and dedupe the questions of some folders. Invalid JSON files are reported, not fatal. */
function load(folders: string[]) {
  const bad: string[] = [];
  const items: { q: Raw; d: number; order: number }[] = [];
  let order = 0;
  for (const folder of folders) {
    const dir = path.join(DIR, folder);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !/^(topics?|exams?|structure)\.json$/i.test(f))) {
      const parsed = parseSalvage(fs.readFileSync(path.join(dir, file), "utf8"));
      if (!parsed) { bad.push(`${folder}/${file}`); continue; }
      if (parsed.partial) bad.push(`${folder}/${file} (partial: kept what parsed)`);
      const data = parsed.data;
      if (!Array.isArray(data)) continue;
      for (const q of data as Raw[]) if (q && typeof q === "object") items.push({ q, d: difficulty(q), order: order++ });
    }
  }
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
  return { bad, valid, read: items.length };
}

function importTrack(slug: string, name: string, folders: string[]) {
  const { bad, valid, read } = load(folders);
  const brand = db.select().from(brands).where(eq(brands.slug, "titan-academy")).get()
    ?? db.insert(brands).values({ slug: "titan-academy", name: "Titan Academy", tagline: "Race a rival to Titan" }).returning().get();
  const track = db.select().from(tracks).where(eq(tracks.slug, slug)).get()
    ?? db.insert(tracks).values({ brandId: brand.id, slug, name, kind: "technology", roles: "developer",
      description: `${name}. Study, drill and sit exams across 20 levels while a rival races you to Titan.` }).returning().get();
  if (db.select({ n: sql<number>`count(*)` }).from(questions).where(eq(questions.trackId, track.id)).get()!.n > 0) {
    return { summary: `${slug}: already has questions, left alone`, bad };
  }

  let added = 0, dup = 0;
  valid.forEach(({ q }, idx) => {
    const prompt0 = promptOf(q);
    const base = Math.min(MAX_LEVEL, 1 + Math.floor((idx / valid.length) * MAX_LEVEL));
    const code = (q.code ?? q.question_code) as unknown;
    const answers = q.answers as { option: string; text: string }[];
    const firstLine = Array.isArray(code) && code.length ? String(code[0]).trim() : "";
    // The unique index is (track, level, prompt) and many prompts are generic ("What does this command do?").
    // A collision moves the question to a nearby level; as a last resort the snippet is named in the prompt.
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
    if (!prog || typeof prog !== "object") continue;
    const tiers = Object.entries(prog).filter(([, b]) => Array.isArray(b) && b.length), per = MAX_LEVEL / Math.max(1, tiers.length);
    tiers.forEach(([tier, bullets], ti) => {
      const first = Math.round(ti * per), last = Math.round((ti + 1) * per), span = Math.max(1, last - first);
      for (let l = first; l < last; l++) {
        const size = Math.ceil(bullets.length / span), slice = bullets.slice((l - first) * size, (l - first + 1) * size).map(String);
        if (!slice.length) continue;
        const level = l + 1, title = LEVELS[level - 1] === tier ? tier : `${LEVELS[level - 1]} · ${tier} syllabus`;
        db.insert(lessons).values({ trackId: track.id, level, title, syllabus: slice })
          .onConflictDoUpdate({ target: [lessons.trackId, lessons.level], set: { title, syllabus: slice } }).run();
        lessonCount++;
      }
    });
  }
  return { summary: `${slug}: ${added} questions, ${dup} dropped, ${valid.length}/${read} usable, ${lessonCount} lessons`, bad };
}

// folders that are the same subject spelled differently or split in two
const MERGE: Record<string, string> = {
  reactjs: "react", objectoriantedprogramming: "oop", blockchains: "blockchain", "git&github": "git", github: "git",
  anroid: "android", fluter: "flutter", awslamda: "lambda",
};
const NOT_SUBJECTS = new Set(["templates", "structure", "roleselector", "javarayhantest"]);
const norm = (d: string) => d.toLowerCase().replace(/[^a-z0-9&+#]/g, "");
const slugOf = (key: string) => key.replace(/\+\+/g, "pp").replace(/#/g, "sharp").replace(/&/g, "and").replace(/[^a-z0-9]/g, "") + "-titan";
const pretty = (d: string) => d.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").trim();

const args = process.argv.slice(2);
if (args[0] === "--all") {
  const dry = args.includes("--dry");
  const groups = new Map<string, string[]>();
  for (const d of fs.readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort()) {
    const key = norm(d);
    if (NOT_SUBJECTS.has(key)) continue;
    const k = MERGE[key] ?? key;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const imported: string[] = [], thin: string[] = [], allBad: string[] = [];
  for (const [key, folders] of groups) {
    const slug = key === "git" ? "git-titan" : slugOf(key);
    const name = `${pretty(folders[0])}: Novice to Titan`;
    const { valid, bad } = load(folders);
    allBad.push(...bad);
    if (valid.length < MIN_QUESTIONS) { thin.push(`${folders.join("+")} (${valid.length})`); continue; }
    if (dry) { imported.push(`${slug} ${valid.length}`); continue; }
    const r = importTrack(slug, name, folders);
    imported.push(r.summary);
  }
  console.log(`${dry ? "DRY RUN: would import" : "imported"} ${imported.length} tracks`);
  console.log(imported.join("\n"));
  console.log(`\nskipped, under ${MIN_QUESTIONS} usable questions (${thin.length}): ${thin.join(", ")}`);
  console.log(`\ninvalid JSON files (${allBad.length}): ${allBad.join(", ")}`);
} else {
  const [slug, name, ...folders] = args;
  if (!slug || !name || !folders.length) { console.error('usage: import-questions <slug> "<name>" <folder>... | --all [--dry]'); process.exit(1); }
  const r = importTrack(slug, name, folders);
  console.log(r.summary);
  if (r.bad.length) console.log(`invalid JSON, skipped (${r.bad.length}): ${r.bad.join(", ")}`);
}

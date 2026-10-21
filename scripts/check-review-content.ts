/**
 * Checks drafted learning content waiting for review: npm run check:review
 * Everything under content/review/ is a draft. Each file must be status "review" (so importing it saves the questions unpublished
 * until an admin activates them), name a track that exists, and hold well-formed items and questions. Business-stop drafts must
 * also name a real stop of the business map whose learning track is the file's track.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { MAPS } from "../lib/lifecycle/maps";

const root = path.join(process.cwd(), "content", "review");
let fails = 0, files = 0, items = 0, qn = 0;
const fail = (msg: string) => { fails++; console.error(`FAIL ${msg}`); };
const walk = (d: string): string[] => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []) : [];

const dbFile = process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "gglearn.db");
const db = fs.existsSync(dbFile) ? new Database(dbFile, { readonly: true }) : null;
// Track names are only checked against a database that has tracks. A database with none (an empty one built from the schema, as CI uses) has
// nothing to check them against, so that rule is skipped rather than failing every file; the rest still runs.
const hasTracks = !!db && ((db.prepare("select count(*) as n from tracks").get() as { n: number }).n > 0);
const trackExists = (slug: string) => !hasTracks || !!db!.prepare("select 1 from tracks where slug=?").get(slug);
const liveHas = (slug: string, prompt: string) => !!db?.prepare("select 1 from questions q join tracks t on t.id=q.track_id where t.slug=? and q.prompt=?").get(slug, prompt);

type Q = { level: number; type: string; prompt: string; options?: { key: string; text: string }[]; answer: string; topic?: string };
type Item = { title: string; stop?: string; body: string; questions: Q[] };
type File = { trackSlug: string; status?: string; items: Item[] };
const seenPrompt = new Set<string>(), letters: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
const BAD = /all of the above|none of the above|both a and b/i;

for (const file of walk(root)) {
  files++;
  const rel = path.relative(process.cwd(), file);
  let f: File;
  try { f = JSON.parse(fs.readFileSync(file, "utf8")); } catch { fail(`${rel}: not valid JSON`); continue; }
  if (f.status !== "review") fail(`${rel}: status must be "review" (a draft must never import as live)`);
  if (!f.trackSlug || !trackExists(f.trackSlug)) fail(`${rel}: no track "${f.trackSlug}"`);
  if (!Array.isArray(f.items) || !f.items.length) { fail(`${rel}: no items`); continue; }
  for (const it of f.items) {
    items++;
    const at = `${rel} / ${it.title}`;
    const wc = (it.body ?? "").split(/\s+/).filter(Boolean).length;
    if (!it.title || wc < 60 || wc > 200) fail(`${at}: needs a title and a body of 60 to 200 words (has ${wc})`);
    if (rel.includes(`${path.sep}business-stops${path.sep}`)) {
      const st = it.stop ? MAPS.business.STATION_BY_ID.get(it.stop) : undefined;
      if (!st) fail(`${at}: "stop" must be a stop of the business map (got ${it.stop})`);
      else if (st.track !== f.trackSlug) fail(`${at}: stop ${it.stop} learns in ${st.track}, not ${f.trackSlug}`);
    }
    if ((it.questions ?? []).length < 4) fail(`${at}: needs at least 4 questions`);
    const levels = (it.questions ?? []).map((q) => q.level);
    if (new Set(levels).size !== levels.length) fail(`${at}: two questions share a level`);
    for (const q of it.questions ?? []) {
      qn++;
      const qa = `${at} / "${q.prompt?.slice(0, 40)}"`;
      if (!q.prompt || q.type !== "mcq") fail(`${qa}: needs a prompt and type mcq`);
      if (!Number.isInteger(q.level) || q.level < 1 || q.level > 20) fail(`${qa}: bad level`);
      if (seenPrompt.has(q.prompt)) fail(`${qa}: duplicate prompt`);
      seenPrompt.add(q.prompt);
      if (f.trackSlug && liveHas(f.trackSlug, q.prompt)) fail(`${qa}: the live bank already has this prompt`);
      const keys = (q.options ?? []).map((o) => o.key), texts = (q.options ?? []).map((o) => o.text.trim().toLowerCase());
      if (keys.join() !== "a,b,c,d") fail(`${qa}: options must be exactly a, b, c, d`);
      if (new Set(texts).size !== texts.length) fail(`${qa}: two options are the same`);
      if (!keys.includes(q.answer)) fail(`${qa}: answer "${q.answer}" is not an option`);
      if ((q.options ?? []).some((o) => !o.text || BAD.test(o.text))) fail(`${qa}: an option is empty or says "all/none of the above"`);
      if (q.answer in letters) letters[q.answer]++;
    }
  }
}
// the reviewer handouts (content/review/packs) are generated from the JSON: a stale one would have people approving text that is no longer what is in the app
if (fs.existsSync(path.join(root, "packs"))) {
  const r = spawnSync("npx", ["tsx", "scripts/build-review-packs.ts", "--check"], { cwd: process.cwd(), encoding: "utf8" });
  if (r.status !== 0) fail(`review packs are out of date with the JSON; run npm run review:packs${(r.stderr || "").trim() ? ` (${(r.stderr || "").trim().split("\n")[0]})` : ""}`);
}
// the right answer must not sit in one place
const total = Object.values(letters).reduce((a, b) => a + b, 0);
for (const [k, n] of Object.entries(letters)) if (total >= 20 && (n / total < 0.15 || n / total > 0.35)) fail(`answer position: "${k}" is ${Math.round((n / total) * 100)}% of answers (15 to 35% expected)`);
console.log(`review  ${files} files, ${items} items, ${qn} questions; answers a/b/c/d ${Object.values(letters).join("/")}${hasTracks ? "" : " (track names not checked: the database has no tracks)"}`);
if (fails) { console.error(`${fails} problem(s)`); process.exit(1); }
console.log("review content ok");

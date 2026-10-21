/**
 * How well the question bank backs each stop of the business map: npm run report:coverage [-- --map business] [-- --thin 15]
 *
 * A stop teaches through its learning track, and many stops share one track, so a stop can sit on a track with thousands of
 * questions and still have almost none about its own subject. This counts, per stop, the track's questions whose topic or prompt
 * mention the stop's own words. It is a keyword count, so it is indicative, not exact: a stop with 0 matches is a likely gap to
 * write questions for; a stop with 300 is probably well covered. It also shows how much of each track is about this product
 * (gglearn, Moksy...) rather than the subject, since that is not business learning for everyone.
 *
 * With --write it saves the counts to content/lifecycle/coverage-<map>.json, which the stop cards show ("Thin / Partly / Well covered").
 * Re-run it when the question bank changes a lot. Otherwise read-only.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { MAPS } from "../lib/lifecycle/maps";

const arg = (name: string, d: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const mapId = arg("map", "business"), thin = Number(arg("thin", "15"));
const m = MAPS[mapId];
if (!m) { console.error(`no map "${mapId}"; try: ${Object.keys(MAPS).join(", ")}`); process.exit(1); }

const db = new Database(process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "gglearn.db"), { readonly: true });
const PRODUCT = /gglearn|moksy|ggmoney|ggsocial|gglink|titan academy|trialtest|skillstest/i;
/** words too common to say anything about one stop */
const GENERIC = new Set("business plan check review team customer customers basics needs work data tools new your owner and the for with from you what who how are use make get".split(" "));
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, (x, _g, i) => (i > 3 ? "" : x));
const words = (s: string) => [...new Set(s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !GENERIC.has(w)).map(stem))];

/** questions drafted for a stop in content/review/ (not in the bank until reviewed and activated) */
const drafted = new Map<string, number>();
const reviewDir = path.join(process.cwd(), "content", "review", "business-stops");
if (mapId === "business" && fs.existsSync(reviewDir)) for (const f of fs.readdirSync(reviewDir).filter((n) => n.endsWith(".json"))) for (const it of JSON.parse(fs.readFileSync(path.join(reviewDir, f), "utf8")).items ?? []) if (it.stop) drafted.set(it.stop, (drafted.get(it.stop) ?? 0) + (it.questions?.length ?? 0));

type Q = { topic: string; prompt: string };
const cache = new Map<string, Q[]>();
const questionsOf = (slug: string): Q[] => {
  if (!cache.has(slug)) cache.set(slug, db.prepare("select q.topic, q.prompt from questions q join tracks t on t.id=q.track_id where t.slug=? and q.status='active'").all(slug) as Q[]);
  return cache.get(slug)!;
};

console.log(`\n== ${m.label}: how well the question bank backs each stop (keyword match, indicative) ==\n`);
const rows = m.STATIONS.map((s) => {
  const qs = questionsOf(s.track), ws = words(s.name);
  // a question matches when its topic or prompt has at least half of the stop's own words (all of them for one or two words, so "cash flow" is found for "Cash Flow Watch")
  const need = Math.max(1, Math.ceil(ws.length / 2));
  // a stop whose name is all generic words ("Business Plan", "Customer Data") cannot be measured this way: it is left out, not counted as zero
  const hit = ws.length ? qs.filter((q) => { const t = `${q.topic} ${q.prompt}`.toLowerCase(); return ws.filter((w) => t.includes(w)).length >= need; }).length : 0;
  return { id: s.id, name: s.name, track: s.track, line: s.line, total: qs.length, hit: ws.length ? hit : null, ws };
});

const measured = rows.filter((r): r is typeof r & { hit: number } => r.hit !== null);
const thinStops = measured.filter((r) => r.hit < thin).sort((a, b) => a.hit - b.hit || a.name.localeCompare(b.name));
console.log(`Stops with fewer than ${thin} matching questions: ${thinStops.length} of ${measured.length} measured (${rows.length - measured.length} have only generic words in their name and are not measured)\n`);
console.log("matches  stop                                  track");
for (const r of thinStops) console.log(`${String(r.hit).padStart(7)}  ${r.name.padEnd(36)}  ${r.track}  (looked for: ${r.ws.join(" + ")})${drafted.get(r.id) ? `  [+${drafted.get(r.id)} drafted for review]` : ""}`);
const needDraft = thinStops.filter((r) => !drafted.has(r.id)).length;
if (drafted.size) console.log(`\n${drafted.size} stops have drafted questions waiting in content/review/ (not live); ${needDraft} thin stops have none yet. A stop needs ${thin} matching questions to stop being thin.`);

console.log("\nBy track: questions, share about this product, and how many stops lean on it\n");
console.log("track                         questions  product  stops  thin stops");
for (const slug of [...new Set(rows.map((r) => r.track))]) {
  const qs = questionsOf(slug), p = qs.filter((q) => PRODUCT.test(q.topic) || PRODUCT.test(q.prompt)).length;
  const mine = rows.filter((r) => r.track === slug);
  console.log(`${slug.padEnd(28)}  ${String(qs.length).padStart(9)}  ${String(Math.round((p / Math.max(1, qs.length)) * 100) + "%").padStart(7)}  ${String(mine.length).padStart(5)}  ${String(mine.filter((r) => r.hit !== null && r.hit < thin).length).padStart(10)}`);
}
const none = rows.filter((r) => r.total === 0);
if (none.length) console.log(`\nStops whose track has NO questions at all: ${none.map((r) => r.name).join(", ")}`);
if (process.argv.includes("--write")) {
  const file = path.join(process.cwd(), "content", "lifecycle", `coverage-${mapId}.json`);
  const stops = Object.fromEntries(measured.map((r) => [r.id, { hit: r.hit, total: r.total }]));
  fs.writeFileSync(file, JSON.stringify({ about: "Per stop: how many of its learning track's active questions mention the stop's own words. A keyword count, so indicative. Written by npm run report:coverage -- --write.", generated: new Date().toISOString().slice(0, 10), stops }, null, 1) + "\n");
  console.log(`\nWrote ${Object.keys(stops).length} stops to ${path.relative(process.cwd(), file)}`);
}
console.log("\nA keyword count cannot tell a good question from a passing mention. Use it to find where to look, then read the questions.\n");

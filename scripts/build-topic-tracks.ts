/**
 * Learning topics (content/topics/topics.json): one subject that cuts across tracks, such as version control or accessibility.
 *
 *   npm run topics            report only: what each topic would hold, and which are thin or empty (also writes docs/topic-coverage.md)
 *   npm run topics -- --apply  make or refresh one track per ready topic ("topic-<slug>") in the shared "Topics" brand
 *
 * A topic track holds COPIES of the questions it draws on, at their own levels, so it is required, raced and certified like any other
 * track. Running --apply again adds new questions and retires copies whose source is gone. Uses DATABASE_FILE or data/gglearn.db.
 * Only generic content feeds a topic that every company can see: see `_about` in the JSON.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { and, eq, inArray, like, ne, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "../lib/db";
import { MAX_LEVEL } from "../lib/levels";

type Spec = { slug: string; name: string; family: string; src: string[] };
type Config = { genericTracks: Record<string, "*" | string[]>; minQuestions: number; minPerLevel: number; maxPerLevel: number; families: Record<string, string>; topics: Spec[] };
type Cards = { slug: string; groups: Record<string, string>; cards: { group: string }[] };

const apply = process.argv.includes("--apply");
const cfg: Config = JSON.parse(readFileSync("content/topics/topics.json", "utf8"));
const cap = (s: string) => (/^(nn|np|pd|tf)\b|^[a-z]+[._(\d]|^[a-z]+[A-Z]|^[a-z]+_/.test(s) ? s : s.charAt(0).toUpperCase() + s.slice(1)); // as scripts/ai/engine.ts: a question's topic is its group's label
const COMPANY_LABEL = /moksy|\bgg|gglearn|gglink|guru|\bour\b|\bcompany\b/i; // a group about one company's own facts
const COMPANY_TEXT = /moksy|gglearn|gglink|ggmoney|ggsocial|guru graphics/i; // last safety net on the copied question itself

const cardFiles = new Map<string, Cards>();
for (const f of readdirSync("content/cards").filter((x) => x.endsWith(".json"))) { const j: Cards = JSON.parse(readFileSync(`content/cards/${f}`, "utf8")); cardFiles.set(j.slug, j); }
const trackRows = new Map(db.select({ id: tracks.id, slug: tracks.slug, brand: brands.slug, kind: brands.kind }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).all().map((r) => [r.slug, r]));

type Row = typeof questions.$inferSelect;
const problems: string[] = [];

/** The questions one source gives a topic, and why anything was left out. */
function pull(topic: string, src: string): Row[] {
  const [slug, groupList] = src.split(":");
  const t = trackRows.get(slug);
  if (!t) { problems.push(`${topic}: no track "${slug}"`); return []; }
  const cards = cardFiles.get(slug);
  const allowed = cfg.genericTracks[slug];
  const shared = t.kind === "shared";
  if (!shared && !allowed) { problems.push(`${topic}: "${slug}" belongs to one company and is not listed in genericTracks`); return []; }
  const wanted = groupList ? groupList.split(",") : null;
  if (!cards) {
    if (wanted) { problems.push(`${topic}: "${slug}" has no card groups to name`); return []; }
    return db.select().from(questions).where(and(eq(questions.trackId, t.id), eq(questions.status, "active"), ne(questions.source, "legacy-trialtest"))).all(); // the old trial-test padding (sums and the like) is not about the topic
  }
  const labelOf = (g: string) => cards.groups[g];
  const keys = wanted ?? Object.keys(cards.groups);
  const out: string[] = [];
  for (const g of keys) {
    if (!labelOf(g)) { problems.push(`${topic}: "${slug}" has no group "${g}"`); continue; }
    if (!shared && allowed !== "*" && !allowed.includes(g)) { problems.push(`${topic}: "${slug}:${g}" is not listed as generic`); continue; }
    if (COMPANY_LABEL.test(labelOf(g))) { if (wanted) problems.push(`${topic}: "${slug}:${g}" (${labelOf(g)}) is about one company`); continue; }
    out.push(cap(labelOf(g)));
  }
  if (!out.length) return [];
  // hand-written scenario questions have no group; take them only from a track that has no company group at all
  const clean = Object.values(cards.groups).every((l) => !COMPANY_LABEL.test(l));
  if (!wanted && clean) out.push("Applied", "Calculations");
  return db.select().from(questions).where(and(eq(questions.trackId, t.id), eq(questions.status, "active"), inArray(questions.topic, out))).all();
}

/** At most `max` questions a level, taken in turn from each source group so no one track dominates. Enough for many exams of ten, without copying a track in full. */
function capPerLevel(rows: Row[], max: number): Row[] {
  const out: Row[] = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const buckets = new Map<string, Row[]>();
    for (const q of rows.filter((x) => x.level === level).sort((a, b) => a.id - b.id)) buckets.set(`${q.trackId}|${q.topic}`, [...(buckets.get(`${q.trackId}|${q.topic}`) ?? []), q]);
    const lists = [...buckets.values()];
    for (let i = 0; out.filter((x) => x.level === level).length < max && lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length && out.filter((x) => x.level === level).length < max) out.push(l[i]);
  }
  return out;
}

type Result = { spec: Spec; rows: Row[]; byLevel: number[]; reach: number; dropped: number; state: "ready" | "thin" | "gap" };
const results: Result[] = cfg.topics.map((spec) => {
  const seen = new Set<string>();
  let rows: Row[] = [];
  let dropped = 0;
  for (const src of spec.src) for (const q of pull(spec.slug, src)) {
    const k = `${q.level}|${q.prompt}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (COMPANY_TEXT.test(`${q.prompt} ${q.code ?? ""} ${JSON.stringify(q.options)} ${q.hint ?? ""} ${q.rubric ?? ""}`)) { dropped++; continue; }
    rows.push(q);
  }
  rows = capPerLevel(rows, cfg.maxPerLevel);
  const byLevel = Array.from({ length: MAX_LEVEL }, (_, i) => rows.filter((q) => q.level === i + 1).length);
  let reach = 0;
  while (reach < MAX_LEVEL && byLevel[reach] > 0) reach++;
  const thinLevels = byLevel.filter((n) => n < cfg.minPerLevel).length;
  const state = !rows.length ? "gap" : rows.length >= cfg.minQuestions && reach === MAX_LEVEL && thinLevels === 0 ? "ready" : "thin";
  return { spec, rows, byLevel, reach, dropped, state };
});

const label = (s: Result["state"]) => (s === "ready" ? "ready" : s === "thin" ? "THIN" : "GAP");
console.log(`${results.length} topics: ${results.filter((r) => r.state === "ready").length} ready, ${results.filter((r) => r.state === "thin").length} thin, ${results.filter((r) => r.state === "gap").length} with nothing yet\n`);
for (const r of results) console.log(`${label(r.state).padEnd(5)} ${r.spec.slug.padEnd(22)} ${String(r.rows.length).padStart(5)} questions · levels reached ${String(r.reach).padStart(2)} · fewest at a level ${Math.min(...r.byLevel)}${r.dropped ? ` · ${r.dropped} left out as company-specific` : ""}`);
if (problems.length) { console.log(`\n${problems.length} problems in topics.json:`); for (const p of problems) console.log(`  ${p}`); }

// the report an admin or author reads to decide what to write next
const md = [
  "# Learning topic coverage", "",
  "Generated by `npm run topics` from `content/topics/topics.json`. **Ready** topics get their own track. **Thin** ones have too few questions or leave levels empty. **Gap** means nothing generic covers it yet.", "",
  "| Topic | Family | State | Questions | Levels reached | Fewest per level |", "|---|---|---|---:|---:|---:|",
  ...results.map((r) => `| ${r.spec.name} | ${cfg.families[r.spec.family]} | ${label(r.state)} | ${r.rows.length} | ${r.reach} | ${Math.min(...r.byLevel)} |`), "",
  "Company-specific content (Moksy, GGLink, Guru Graphics...) is not used: every company can see a topic. Write per-company topics for those.", "",
].join("\n");
writeFileSync("docs/topic-coverage.md", md);

if (problems.length && !apply) process.exitCode = 1;
if (apply) {
  if (problems.length) { console.log("\nFix the problems above before --apply."); process.exit(1); }
  let brand = db.select().from(brands).where(eq(brands.slug, "topics")).get();
  if (!brand) brand = db.insert(brands).values({ slug: "topics", name: "Topics", tagline: "One subject at a time, across every track", kind: "shared" }).returning().get();
  for (const r of results.filter((x) => x.state === "ready")) {
    const slug = `topic-${r.spec.slug}`;
    let t = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
    const description = `${r.spec.name}, taken from every track that covers it.`;
    if (!t) t = db.insert(tracks).values({ brandId: brand.id, slug, name: r.spec.name, kind: "subject", description, roles: "", scope: "company", audience: "staff", tier: "growth" }).returning().get();
    else db.update(tracks).set({ name: r.spec.name, description }).where(eq(tracks.id, t.id)).run();
    const have = new Map(db.select({ id: questions.id, k: sql<string>`${questions.level} || '|' || ${questions.prompt}`, s: questions.status }).from(questions).where(eq(questions.trackId, t.id)).all().map((q) => [q.k, q]));
    const want = new Set(r.rows.map((q) => `${q.level}|${q.prompt}`));
    let added = 0, retired = 0;
    db.transaction((tx) => {
      for (const q of r.rows) {
        if (have.has(`${q.level}|${q.prompt}`)) continue;
        tx.insert(questions).values({ trackId: t.id, level: q.level, type: q.type, prompt: q.prompt, code: q.code, options: q.options, answer: q.answer, rubric: q.rubric, hint: q.hint, topic: q.topic, weight: q.weight, timeSec: q.timeSec, source: q.source === "twist" ? "authored" : q.source, status: "active" }).onConflictDoNothing().run();
        added++;
      }
      for (const [k, q] of have) if (!want.has(k) && q.s === "active") { tx.update(questions).set({ status: "retired" }).where(eq(questions.id, q.id)).run(); retired++; }
    });
    console.log(`${slug}: ${added} added, ${retired} retired`);
  }
  const stale = db.select({ slug: tracks.slug }).from(tracks).where(like(tracks.slug, "topic-%")).all().filter((x) => !results.some((r) => r.state === "ready" && `topic-${r.spec.slug}` === x.slug));
  if (stale.length) console.log(`\nTopic tracks that are no longer ready (left as they are): ${stale.map((s) => s.slug).join(", ")}`);
}

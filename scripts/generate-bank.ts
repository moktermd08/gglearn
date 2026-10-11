/**
 * Fills the question bank for tracks the dynamic generators cannot serve (company knowledge, processes, products).
 * For every level below the target it asks Claude for new multiple-choice questions grounded in the track's knowledge
 * items, then has a second blind pass answer each one and keeps only those where the answers agree.
 *
 *   npm run generate:bank -- --track sdlc-backend [--target 110] [--level 5] [--activate] [--dry]
 *   npm run generate:bank -- --all-short
 *
 * New rows are saved with status "review" (source "ai") unless --activate is given, so nothing unreviewed goes live by
 * accident. Needs ANTHROPIC_API_KEY. Safe to re-run: it only requests the shortfall and the unique index drops duplicates.
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, knowledgeItems, questions, tracks } from "@/lib/db";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";
import { familiesFor } from "@/lib/dynamic/engine";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? undefined : process.argv[i + 1] ?? ""; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const TARGET = Number(arg("target") ?? 110), BATCH = 10, MODEL = process.env.GENERATOR_MODEL ?? "claude-sonnet-5-5";
const status = flag("activate") ? "active" : "review";
if (!process.env.ANTHROPIC_API_KEY && !flag("dry")) { console.error("Set ANTHROPIC_API_KEY (or use --dry to only print the plan)."); process.exit(1); }
const client = new Anthropic();

type Draft = { prompt: string; code?: string | null; options: string[]; answer: number; hint?: string; topic?: string };

const difficulty = (level: number) =>
  level <= 4 ? "recognition and basic vocabulary" : level <= 8 ? "everyday practical knowledge" : level <= 12 ? "applying the knowledge to realistic situations"
  : level <= 16 ? "trade-offs, edge cases and troubleshooting" : "expert judgement, subtle distinctions and multi-step reasoning";

async function ask(system: string, user: string): Promise<string> {
  const msg = await client.messages.create({ model: MODEL, max_tokens: 6000, system, messages: [{ role: "user", content: user }] });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}
const json = <T,>(text: string): T => JSON.parse(text.slice(text.search(/[[{]/), Math.max(text.lastIndexOf("]"), text.lastIndexOf("}")) + 1));

async function author(track: typeof tracks.$inferSelect, facts: string, level: number, existing: string[]): Promise<Draft[]> {
  const text = await ask(
    "You write exam questions for a company training academy. Output JSON only: an array of objects " +
      '{"prompt": string, "code": string|null, "options": [4 strings], "answer": 0-3 index of the single correct option, "hint": one sentence explaining why, "topic": short label}. ' +
      "Rules: exactly one option is correct and the other three are plausible but definitely wrong; no 'all of the above'; vary which index is correct; " +
      "base every question on the supplied facts or on well-established general knowledge of the subject; never invent company specifics; each question stands alone.",
    `Track: ${track.name} (${track.kind}). ${track.description}\nLevel ${level} of ${MAX_LEVEL} (${LEVELS[level - 1]}): ${difficulty(level)}.\n` +
      `Write ${BATCH} new questions. Do not repeat or paraphrase these existing prompts:\n${existing.slice(0, 40).map((p) => `- ${p}`).join("\n") || "(none)"}\n\nFacts:\n${facts.slice(0, 12000) || "(no stored facts: use established general knowledge of the subject)"}`,
  );
  return json<Draft[]>(text).filter((d) => d && typeof d.prompt === "string" && Array.isArray(d.options) && d.options.length === 4 && Number.isInteger(d.answer) && d.answer >= 0 && d.answer < 4);
}

/** Blind pass: a fresh call sees the question without the key. Only questions it answers the same way are kept. */
async function audit(drafts: Draft[]): Promise<Draft[]> {
  if (!drafts.length) return [];
  const view = drafts.map((d, i) => ({ i, prompt: d.prompt, code: d.code ?? null, options: d.options }));
  const text = await ask("Answer each multiple-choice question. Output JSON only: [{\"i\": number, \"answer\": 0-3, \"ambiguous\": boolean}]. Mark ambiguous if more than one option could be argued correct or none is.", JSON.stringify(view));
  const got = new Map(json<{ i: number; answer: number; ambiguous?: boolean }[]>(text).map((x) => [x.i, x]));
  return drafts.filter((d, i) => got.get(i)?.answer === d.answer && !got.get(i)?.ambiguous && new Set(d.options.map((o) => o.trim().toLowerCase())).size === 4);
}

async function fill(track: typeof tracks.$inferSelect) {
  const facts = db.select().from(knowledgeItems).where(eq(knowledgeItems.trackId, track.id)).all().map((k) => `## ${k.title}\n${k.body}`).join("\n\n");
  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (arg("level") && Number(arg("level")) !== level) continue;
    const have = db.select({ n: sql<number>`count(*)` }).from(questions)
      .where(and(eq(questions.trackId, track.id), eq(questions.level, level), inArray(questions.status, ["active", "review"]))).get()?.n ?? 0;
    const dyn = familiesFor(track.slug, level).length ? TARGET : 0; // dynamic families already cover the level
    let need = TARGET - Math.max(have, dyn);
    console.log(`${track.slug} L${level}: ${have} stored, need ${Math.max(need, 0)} more`);
    if (flag("dry")) continue;
    for (let tries = 0; need > 0 && tries < 25; tries++) {
      const existing = db.select({ p: questions.prompt }).from(questions).where(and(eq(questions.trackId, track.id), eq(questions.level, level))).all().map((r) => r.p);
      let kept: Draft[] = [];
      try { kept = await audit(await author(track, facts, level, existing)); } catch (e) {
        // a rejected key or exhausted quota will fail every later batch too, so stop instead of retrying
        if (e instanceof Anthropic.APIError && [401, 403, 429].includes(e.status ?? 0) && e.status !== 429) { console.error(`  stopping: ${e.status} ${e.message}`); process.exit(1); }
        console.error("  batch failed:", (e as Error).message); continue;
      }
      for (const d of kept) {
        const r = db.insert(questions).values({
          trackId: track.id, level, type: "mcq", prompt: d.prompt.trim(), code: d.code || null, options: d.options.map((text, i) => ({ key: "abcd"[i], text: text.trim() })),
          answer: "abcd"[d.answer], hint: d.hint ?? null, topic: d.topic ?? "", source: "ai", status,
        }).onConflictDoNothing().run();
        if (r.changes) need--;
      }
      console.log(`  +${kept.length} kept, ${Math.max(need, 0)} to go`);
    }
  }
}

const wanted = flag("all-short")
  ? db.select().from(tracks).all().filter((t) => Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).some((l) => !familiesFor(t.slug, l).length))
  : db.select().from(tracks).where(eq(tracks.slug, arg("track") ?? "")).all();
if (!wanted.length) { console.error("No matching track. Use --track <slug> or --all-short."); process.exit(1); }
(async () => { for (const t of wanted) await fill(t); })();

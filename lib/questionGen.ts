import { and, eq, inArray, sql } from "drizzle-orm";
import { db, knowledgeItems, questions, tracks } from "@/lib/db";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";

/**
 * Writes multiple-choice questions for a track from its knowledge items, then has a second blind pass answer each one and keeps only
 * those where the answers agree. Shared by `npm run generate:bank` and the profile page's "Write questions" button.
 * New rows are saved with status "review" unless the caller says otherwise, so nothing unreviewed goes live by accident.
 */
export const GEN_MODEL = process.env.GENERATOR_MODEL ?? "claude-sonnet-5-5";
export const BATCH = 10;

/** The one thing used from the Anthropic client, so a test can pass a fake. */
export type Chat = { messages: { create(args: { model: string; max_tokens: number; system: string; messages: { role: "user"; content: string }[] }): Promise<{ content: { type: string; text?: string }[] }> } };
export type Draft = { prompt: string; code?: string | null; options: string[]; answer: number; hint?: string; topic?: string };
type Track = typeof tracks.$inferSelect;

export const difficulty = (level: number) =>
  level <= 4 ? "recognition and basic vocabulary" : level <= 8 ? "everyday practical knowledge" : level <= 12 ? "applying the knowledge to realistic situations"
  : level <= 16 ? "trade-offs, edge cases and troubleshooting" : "expert judgement, subtle distinctions and multi-step reasoning";

async function ask(client: Chat, system: string, user: string): Promise<string> {
  const msg = await client.messages.create({ model: GEN_MODEL, max_tokens: 6000, system, messages: [{ role: "user", content: user }] });
  return msg.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
}
const json = <T,>(text: string): T => JSON.parse(text.slice(text.search(/[[{]/), Math.max(text.lastIndexOf("]"), text.lastIndexOf("}")) + 1));

export async function author(client: Chat, track: Track, facts: string, level: number, existing: string[]): Promise<Draft[]> {
  const text = await ask(
    client,
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
export async function audit(client: Chat, drafts: Draft[]): Promise<Draft[]> {
  if (!drafts.length) return [];
  const view = drafts.map((d, i) => ({ i, prompt: d.prompt, code: d.code ?? null, options: d.options }));
  const text = await ask(client, "Answer each multiple-choice question. Output JSON only: [{\"i\": number, \"answer\": 0-3, \"ambiguous\": boolean}]. Mark ambiguous if more than one option could be argued correct or none is.", JSON.stringify(view));
  const got = new Map(json<{ i: number; answer: number; ambiguous?: boolean }[]>(text).map((x) => [x.i, x]));
  return drafts.filter((d, i) => got.get(i)?.answer === d.answer && !got.get(i)?.ambiguous && new Set(d.options.map((o) => o.trim().toLowerCase())).size === 4);
}

export const factsOf = (trackId: number) =>
  db.select().from(knowledgeItems).where(eq(knowledgeItems.trackId, trackId)).all().map((k) => `## ${k.title}\n${k.body}`).join("\n\n");

/** Questions already stored (live or waiting for review) for a track at a level. */
export const storedAt = (trackId: number, level: number) =>
  db.select({ n: sql<number>`count(*)` }).from(questions).where(and(eq(questions.trackId, trackId), eq(questions.level, level), inArray(questions.status, ["active", "review"]))).get()?.n ?? 0;

/** Saves drafts as questions for a track and level. Returns how many were new (the unique index drops repeats). */
export function saveDrafts(trackId: number, level: number, drafts: Draft[], status: "active" | "review"): number {
  let added = 0;
  for (const d of drafts) {
    const r = db.insert(questions).values({
      trackId, level, type: "mcq", prompt: d.prompt.trim(), code: d.code || null, options: d.options.map((text, i) => ({ key: "abcd"[i], text: text.trim() })),
      answer: "abcd"[d.answer], hint: d.hint ?? null, topic: d.topic ?? "", source: "ai", status,
    }).onConflictDoNothing().run();
    if (r.changes) added++;
  }
  return added;
}

/** One batch for one level: write, check with a blind second pass, save. Returns how many questions were new. */
export async function fillLevel(client: Chat, track: Track, facts: string, level: number, status: "active" | "review"): Promise<number> {
  const existing = db.select({ p: questions.prompt }).from(questions).where(and(eq(questions.trackId, track.id), eq(questions.level, level))).all().map((r) => r.p);
  return saveDrafts(track.id, level, await audit(client, await author(client, track, facts, level, existing)), status);
}

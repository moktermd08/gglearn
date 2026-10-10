/**
 * Seeds the academy.
 *   npm run seed                      -> brands, sample track, admin user, legacy TrialTest bank
 * Legacy bank location defaults to ../trialtest.ai/database/data (override with LEGACY_DIR).
 */
import fs from "node:fs";
import path from "node:path";
import { db, brands, tracks, questions, users, knowledgeItems } from "../lib/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hashPasswordSync as hashPassword } from "../lib/password";

const LEGACY_DIR = process.env.LEGACY_DIR ?? path.resolve(process.cwd(), "../trialtest.ai/database/data");

// legacy file suffix -> band of the 20 levels
const BANDS: Record<string, [number, number]> = {
  novice: [1, 5], beginners: [1, 5], "cloud-beginners": [1, 5],
  intermediate: [6, 10], general: [6, 10],
  expert: [11, 15],
  professional: [16, 17], genius: [18, 18], extreme: [19, 19], master: [20, 20],
};

const SUBJECT_NAMES: Record<string, string> = {
  nodejs: "Node.js", expressJS: "Express.js", nextJS: "Next.js", mysql: "MySQL", mongodb: "MongoDB",
  restapi: "REST API", chatgpt: "ChatGPT", openai: "OpenAI", oop: "OOP", aws: "AWS", css: "CSS",
  html: "HTML", php: "PHP", npm: "npm", json: "JSON", xml: "XML", jquery: "jQuery", linkedin: "LinkedIn",
  typeacript: "TypeScript", typescript: "TypeScript", google: "Google Cloud",
};
const pretty = (s: string) => SUBJECT_NAMES[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

type Legacy = {
  question?: string; question_text?: string; code?: string[];
  answers?: { option: string; text: string }[]; correct_answer?: string;
  topic?: string; complexityLevel?: number; QuestionWeight?: number;
  maxTimeAllocation?: number; answerHint?: string;
};

function upsertBrand(slug: string, name: string, tagline: string) {
  return (
    db.select().from(brands).where(eq(brands.slug, slug)).get() ??
    db.insert(brands).values({ slug, name, tagline }).returning().get()
  );
}
function upsertTrack(v: typeof tracks.$inferInsert) {
  return db.select().from(tracks).where(eq(tracks.slug, v.slug)).get() ?? db.insert(tracks).values(v).returning().get();
}

function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@gglearn.local";
  if (!db.select().from(users).where(eq(users.email, email)).get()) {
    const pw = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    db.insert(users).values({ email, name: "Academy Admin", role: "admin", passwordHash: hashPassword(pw) }).run();
    console.log(`admin user: ${email}  password: ${pw}  (shown once; change it)`);
  }
}

function seedSample() {
  const brand = upsertBrand("sample-brand", "Sample Brand", "Replace me with a real brand");
  const track = upsertTrack({
    brandId: brand.id, slug: "sample-brand-sales-basics", name: "Sales Basics (sample)",
    kind: "process", roles: "sales",
    description: "Placeholder track showing how brand knowledge becomes questions. Replace with real content.",
  });
  if (db.select().from(knowledgeItems).where(eq(knowledgeItems.trackId, track.id)).get()) return;
  const k = db.insert(knowledgeItems).values({
    trackId: track.id, title: "Discovery call standard",
    body: "Every discovery call opens with the customer's goal, not our product. We ask about current tools, budget owner and timeline before demoing. We never quote a price before agreeing the problem to solve.",
  }).returning().get();
  const base = { trackId: track.id, knowledgeItemId: k.id, source: "authored" as const, topic: "Discovery calls" };
  db.insert(questions).values([
    { ...base, level: 1, type: "mcq", prompt: "What does a discovery call open with?",
      options: [{ key: "a", text: "A product demo" }, { key: "b", text: "The customer's goal" }, { key: "c", text: "Our price list" }, { key: "d", text: "A case study" }],
      answer: "b", hint: "Think about whose problem we are solving." },
    { ...base, level: 1, type: "mcq", prompt: "When may a price be quoted?",
      options: [{ key: "a", text: "In the first minute" }, { key: "b", text: "After agreeing the problem to solve" }, { key: "c", text: "Never" }, { key: "d", text: "Only by email" }],
      answer: "b" },
    { ...base, level: 2, type: "open", prompt: "List three things we ask about before demoing.",
      answer: "Current tools, budget owner, timeline.", rubric: "Must mention current tools, budget owner and timeline." },
    { ...base, level: 3, type: "scenario", prompt: "A prospect asks for the price in the first two minutes. How do you respond, and why?",
      answer: "Acknowledge, defer the price, steer back to the goal and problem before any quote.",
      rubric: "Defers price politely; returns to the customer's goal; explains that price follows an agreed problem." },
  ]).run();
  console.log("sample brand + track seeded");
}

function seedLegacy() {
  if (!fs.existsSync(LEGACY_DIR)) { console.log(`legacy dir not found, skipping: ${LEGACY_DIR}`); return; }
  const brand = upsertBrand("foundations", "Tech Foundations", "Core technology skills imported from TrialTest");
  let total = 0, skipped = 0;
  const bad: string[] = [];

  for (const file of fs.readdirSync(LEGACY_DIR).filter((f) => f.endsWith(".json") && f !== "questions.json").sort()) {
    const stem = file.replace(".json", "");
    const i = stem.indexOf("-");
    if (i < 0) continue;
    const subject = stem.slice(0, i), levelName = stem.slice(i + 1).replace(/^cloud-(?=intermediate|expert)/, "");
    const band = BANDS[levelName];
    if (!band) { console.log("no level band for", file); continue; }

    let data: unknown;
    try { data = JSON.parse(fs.readFileSync(path.join(LEGACY_DIR, file), "utf8")); }
    catch { bad.push(file); continue; }
    const list = (Array.isArray(data) ? data : (data as { questions?: Legacy[] }).questions ?? []) as Legacy[];
    if (!list.length) continue;

    const track = upsertTrack({
      brandId: brand.id, slug: `foundations-${subject.toLowerCase()}`, name: pretty(subject),
      kind: "technology", roles: "developer",
      description: `${pretty(subject)} fundamentals to advanced.`,
    });

    // spread this file's questions across its band, easiest first
    const sorted = [...list].sort((a, b) => (a.complexityLevel ?? 0) - (b.complexityLevel ?? 0));
    const [lo, hi] = band, span = hi - lo + 1;
    sorted.forEach((q, idx) => {
      const prompt = (q.question ?? q.question_text ?? "").trim();
      if (!prompt || !q.answers?.length || !q.correct_answer) { skipped++; return; }
      const level = lo + Math.min(span - 1, Math.floor((idx / sorted.length) * span));
      const r = db.insert(questions).values({
        trackId: track.id, level, type: "mcq", prompt,
        code: q.code?.length ? q.code.join("\n") : null,
        options: q.answers.map((a) => ({ key: a.option, text: a.text })),
        answer: q.correct_answer, hint: q.answerHint ?? null,
        topic: q.topic ?? "", weight: q.QuestionWeight ?? 10, timeSec: q.maxTimeAllocation ?? 60,
        source: "legacy-trialtest",
      }).onConflictDoNothing().run();
      if (r.changes) total++; else skipped++;
    });
  }
  console.log(`legacy: imported ${total}, skipped ${skipped}${bad.length ? `, unparsable files: ${bad.join(", ")}` : ""}`);
}

seedAdmin();
seedSample();
seedLegacy();

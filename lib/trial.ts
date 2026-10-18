import { and, eq, lte, sql } from "drizzle-orm";
import { db, questions, tracks } from "@/lib/db";
import { enrol } from "@/lib/contests";
import { QUEST_XP, completeQuest } from "@/lib/stats";
import { isPublicTrack, publicTracks } from "@/lib/publicCatalog";

/**
 * "Try it": a visitor with no account answers a few real questions and sees how they did. Nothing about them is stored. Only topics that are public
 * (lib/publicCatalog.ts, the same rule as the landing page and the sitemap) can be tried, only easy stored multiple-choice questions are used, and the
 * right answer is only ever told after an answer is given, by the server, one question at a time, never sent with the question.
 */
export const TRIAL_SIZE = 3, TRIAL_MAX_LEVEL = 2;

/** Topics worth showing first, when they exist and are public: the ones most people have heard of. */
const FAVOURITES = ["python-titan", "javascript-titan", "git-titan", "html-titan", "css-titan", "react-titan", "claude-chatgpt-everyday-titan", "llm-prompting-titan", "facebook-marketing-titan", "lead-generation-titan", "sdlc-discovery", "ai-llm-practice"];

export type TrialTopic = { slug: string; name: string; kind: string; n: number };

/** Public topics with enough easy questions to try, favourites first, then the biggest. */
export function trialTopics(limit = 12): TrialTopic[] {
  const rows = publicTracks().map((r) => ({ slug: r.track.slug, name: r.track.name, kind: r.track.kind, n: r.n, id: r.track.id }));
  const ok = rows.filter((r) => easyCount(r.id) >= TRIAL_SIZE);
  const rank = (s: string) => { const i = FAVOURITES.indexOf(s); return i < 0 ? 999 : i; };
  return ok.sort((a, b) => rank(a.slug) - rank(b.slug) || b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit).map((r) => ({ slug: r.slug, name: r.name, kind: r.kind, n: r.n }));
}

const easy = (trackId: number) => and(eq(questions.trackId, trackId), eq(questions.status, "active"), eq(questions.type, "mcq"), lte(questions.level, TRIAL_MAX_LEVEL));
const easyCount = (trackId: number) => Number(db.select({ n: sql<number>`count(*)` }).from(questions).where(easy(trackId)).get()?.n ?? 0);

export type TrialQuestion = { id: number; prompt: string; code: string | null; options: { key: string; text: string }[] };

/** The track for a slug, only if a stranger may try it. */
export function trialTrack(slug: string) {
  const t = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  return t && isPublicTrack(t.id) && easyCount(t.id) >= TRIAL_SIZE ? t : null;
}

/** Three random easy questions, without their answers. */
export function trialQuestions(trackId: number): TrialQuestion[] {
  return db.select().from(questions).where(easy(trackId)).orderBy(sql`random()`).limit(TRIAL_SIZE).all()
    .map((q) => ({ id: q.id, prompt: q.prompt, code: q.code, options: (q.options ?? []).map((o) => ({ key: o.key, text: o.text })) }));
}

/** Was this the right answer? Null when the question is not one a stranger may be asked (not public, not easy, not multiple choice, retired). */
export function checkTrial(questionId: number, choice: string): { correct: boolean; answer: string; trackId: number } | null {
  const q = db.select().from(questions).where(eq(questions.id, questionId)).get();
  if (!q || q.type !== "mcq" || q.status !== "active" || q.level > TRIAL_MAX_LEVEL || !isPublicTrack(q.trackId)) return null;
  const answer = q.answer ?? "";
  return { correct: choice.toLowerCase() === answer.toLowerCase(), answer, trackId: q.trackId };
}

// ---- a trial by someone who already has an account counts as their first win ----

// Answers the server has checked for a signed-in person, per topic (one process, like lib/drill.ts). Finishing only pays out when three different
// questions were really answered here, not on the page's say-so.
const checked = new Map<string, { ids: Set<number>; at: number }>();
const WINDOW_MS = 30 * 60 * 1000;

/** Remembers that this signed-in person answered this question of the topic's trial. */
export function noteTrialCheck(userId: number, trackId: number, questionId: number, now = Date.now()) {
  const key = `${userId}:${trackId}`;
  let e = checked.get(key);
  if (!e || now - e.at > WINDOW_MS) checked.set(key, (e = { ids: new Set(), at: now }));
  e.ids.add(questionId);
}

/**
 * Finishing a trial while signed in: the person is enrolled in the topic and it counts as the day's quick drill, so they leave with XP and a
 * streak started. Needs TRIAL_SIZE different questions answered here recently, and a topic a stranger may try. Pays once (the drill quest is
 * once per topic per day); the answers are used up either way. Returns the XP earned (0 if that drill was already done today), or null.
 */
export function completeTrial(userId: number, trackId: number, now = Date.now()): { xp: number } | null {
  const key = `${userId}:${trackId}`, e = checked.get(key);
  if (!e || now - e.at > WINDOW_MS || e.ids.size < TRIAL_SIZE || !isPublicTrack(trackId)) return null;
  checked.delete(key);
  enrol(db, userId, trackId, "Tried it first");
  return { xp: completeQuest(userId, trackId, "drill") };
}

export const TRIAL_XP = QUEST_XP.drill;

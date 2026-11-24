import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { careerGoals, careerLevels, db, termBanks, termExamAnswers, termExams, terms, users } from "@/lib/db";
import { MAX_PICK, MIN_PICK, MIN_TIER_TESTED, buildCheck, rankForRung, rankFromStats, pooledShare, untested, verdict, type TermLite, type TierStats } from "@/lib/termsCore";

type Person = typeof users.$inferSelect;
type TermRow = typeof terms.$inferSelect;

const parseList = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
};

const lite = (r: TermRow): TermLite => ({
  id: r.id, term: r.term, meaning: r.meaning, tier: r.tier, group: r.groupName, bankId: r.bankId,
  source: r.ownerUserId == null ? "shared" : "mine", similar: parseList(r.similar),
});

/** Are the term bank tables there? They arrive with `npm run db:push`; until then the pages stay quiet instead of failing. */
export function termsAvailable(): boolean {
  try { db.select({ id: termBanks.id }).from(termBanks).limit(1).all(); return true; } catch (err) {
    if (/no such table/i.test(String((err as { message?: unknown }).message ?? ""))) return false;
    throw err;
  }
}

export const sharedTerms = (): TermRow[] =>
  db.select().from(terms).where(and(isNull(terms.ownerUserId), eq(terms.status, "active"))).orderBy(asc(terms.bankId), asc(terms.sortOrder), asc(terms.id)).all();

export const myTerms = (userId: number): TermRow[] =>
  db.select().from(terms).where(and(eq(terms.ownerUserId, userId), eq(terms.status, "active"))).orderBy(asc(terms.tier), asc(terms.term)).all();

export const allBanks = () => db.select().from(termBanks).orderBy(asc(termBanks.sortOrder), asc(termBanks.name)).all();

/** Banks that suit a role, first: the ones made for the role, then the ones for everyone, then the rest. */
export function banksForRole(jobRole: string) {
  const role = jobRole.trim().toLowerCase();
  const score = (roles: string) => {
    const list = roles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
    return list.length === 0 ? 1 : list.includes(role) ? 0 : 2;
  };
  return allBanks().map((b) => ({ b, s: score(b.roles) })).sort((x, y) => x.s - y.s || x.b.sortOrder - y.b.sortOrder).map((x) => x.b);
}

// ---- starting a check

export type StartResult = { id: number } | { error: string };

/** Makes a term check from the terms a person picked (shared ones and their own), at the rank they say they are at. */
export function startCheck(user: Person, claimedTier: number, termIds: number[]): StartResult {
  if (!Number.isInteger(claimedTier) || claimedTier < 1 || claimedTier > 5) return { error: "Choose the rank you think you are at." };
  const ids = [...new Set(termIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length < MIN_PICK) return { error: `Pick at least ${MIN_PICK} terms.` };
  if (ids.length > MAX_PICK) return { error: `Pick at most ${MAX_PICK} terms for one check.` };

  const shared = sharedTerms().map(lite), mine = myTerms(user.id).map(lite);
  const pool = [...shared, ...mine];
  const byId = new Map(pool.map((t) => [t.id, t]));
  const picked = ids.map((id) => byId.get(id)).filter((t): t is TermLite => !!t);
  if (picked.length !== ids.length) return { error: "One of those terms is no longer available. Reload and pick again." };
  const atClaim = picked.filter((t) => t.tier === claimedTier).length;
  if (atClaim < MIN_TIER_TESTED) return { error: `Pick at least ${MIN_TIER_TESTED} terms at ${rankLabel(claimedTier)} level, so the check can show whether you are really there.` };

  const qs = buildCheck(picked, pool);
  if (qs.length < MIN_PICK) return { error: "There are not enough different terms to make fair questions from. Pick more terms, or add meanings that differ." };

  const id = db.transaction((tx) => {
    const exam = tx.insert(termExams).values({ userId: user.id, claimedTier }).returning({ id: termExams.id }).get();
    for (const q of qs) tx.insert(termExamAnswers).values({ examId: exam.id, termId: q.termId, tier: q.tier, prompt: q.prompt, options: JSON.stringify(q.options), correct: q.correct }).run();
    return exam.id;
  });
  return { id };
}

const RANK_LABELS = ["", "Initiate", "Adept", "Expert", "Master", "Titan"];
const rankLabel = (t: number) => RANK_LABELS[t] ?? String(t);

// ---- marking

export type MarkResult = { error: string } | { ok: true };

/** Marks a check from the options a person chose (answer id -> option index). Only the owner's unfinished check can be marked, and only once. */
export function markCheck(user: Person, examId: number, chosen: Record<number, number>): MarkResult {
  const exam = db.select().from(termExams).where(and(eq(termExams.id, examId), eq(termExams.userId, user.id))).get();
  if (!exam) return { error: "That check was not found." };
  if (exam.finishedAt != null) return { error: "That check is already finished." };
  const rows = db.select().from(termExamAnswers).where(eq(termExamAnswers.examId, examId)).all();
  db.transaction((tx) => {
    let right = 0;
    for (const r of rows) {
      const n = parseList(r.options).length;
      const c = chosen[r.id];
      const pick = Number.isInteger(c) && c >= 0 && c < n ? c : null;
      const ok = pick != null && pick === r.correct;
      if (ok) right++;
      tx.update(termExamAnswers).set({ chosen: pick, right: ok }).where(eq(termExamAnswers.id, r.id)).run();
    }
    tx.update(termExams).set({ score: rows.length ? right / rows.length : 0, finishedAt: Math.floor(Date.now() / 1000) }).where(eq(termExams.id, examId)).run();
  });
  return { ok: true };
}

export type CheckAnswer = { id: number; termId: number; term: string; meaning: string; tier: number; prompt: string; options: string[]; correct: number; chosen: number | null; right: boolean | null };

export function loadCheck(user: Person, examId: number) {
  const exam = db.select().from(termExams).where(and(eq(termExams.id, examId), eq(termExams.userId, user.id))).get();
  if (!exam) return null;
  const rows = db.select({ a: termExamAnswers, term: terms.term, meaning: terms.meaning }).from(termExamAnswers)
    .innerJoin(terms, eq(terms.id, termExamAnswers.termId)).where(eq(termExamAnswers.examId, examId)).orderBy(asc(termExamAnswers.id)).all();
  const answers: CheckAnswer[] = rows.map(({ a, term, meaning }) => ({
    id: a.id, termId: a.termId, term, meaning, tier: a.tier, prompt: a.prompt, options: parseList(a.options), correct: a.correct, chosen: a.chosen, right: a.right,
  }));
  const stats: TierStats = {};
  if (exam.finishedAt != null) for (const a of answers) { const s = (stats[a.tier] ??= { tested: 0, right: 0 }); s.tested++; if (a.right) s.right++; }
  const reached = rankFromStats(stats);
  return { exam, answers, stats, reached, share: pooledShare(stats), untested: untested(stats), verdict: verdict(exam.claimedTier, reached, (stats[exam.claimedTier]?.tested ?? 0) >= MIN_TIER_TESTED) };
}

export function recentChecks(userId: number, limit = 8) {
  return db.select().from(termExams).where(eq(termExams.userId, userId)).orderBy(desc(termExams.id)).limit(limit).all();
}

// ---- where a person stands

/** The latest result for every term the person has been asked, whichever check it came from. */
function latestResults(userId: number) {
  const rows = db.select({ termId: termExamAnswers.termId, tier: termExamAnswers.tier, right: termExamAnswers.right, id: termExamAnswers.id })
    .from(termExamAnswers).innerJoin(termExams, eq(termExams.id, termExamAnswers.examId))
    .where(and(eq(termExams.userId, userId), sql`${termExams.finishedAt} is not null`)).orderBy(asc(termExamAnswers.id)).all();
  const latest = new Map<number, { tier: number; right: boolean }>();
  for (const r of rows) latest.set(r.termId, { tier: r.tier, right: !!r.right });
  return latest;
}

export type BankStanding = { bank: { id: number | null; slug: string; name: string }; total: number; asked: number; known: number; stats: TierStats; rank: number; untested: number[] };

/** Per bank, and for the person's own terms: how many terms there are, how many they have been asked, how many they know, and the rank that supports. */
export function standingFor(userId: number): { banks: BankStanding[]; mine: BankStanding } {
  const latest = latestResults(userId);
  const shared = sharedTerms(), mine = myTerms(userId);
  const make = (bank: BankStanding["bank"], list: TermRow[]): BankStanding => {
    const stats: TierStats = {};
    let asked = 0, known = 0;
    for (const t of list) {
      const r = latest.get(t.id);
      if (!r) continue;
      asked++;
      const s = (stats[r.tier] ??= { tested: 0, right: 0 });
      s.tested++;
      if (r.right) { s.right++; known++; }
    }
    return { bank, total: list.length, asked, known, stats, rank: rankFromStats(stats), untested: untested(stats) };
  };
  const banks = allBanks().map((b) => make({ id: b.id, slug: b.slug, name: b.name }, shared.filter((t) => t.bankId === b.id)));
  return { banks, mine: make({ id: null, slug: "mine", name: "My own terms" }, mine) };
}

/** The rank a person's career goal asks for, spread across the ladder of the role they aim at; null when they have no goal. */
export function goalNeed(userId: number): { role: string; level: number; rungs: number; rank: number; title: string } | null {
  const g = db.select().from(careerGoals).where(eq(careerGoals.userId, userId)).get();
  if (!g) return null;
  const rungs = db.select({ n: sql<number>`count(*)` }).from(careerLevels).where(eq(careerLevels.jobRole, g.targetRole)).get()?.n ?? 0;
  const level = db.select({ title: careerLevels.title }).from(careerLevels).where(and(eq(careerLevels.jobRole, g.targetRole), eq(careerLevels.level, g.targetLevel))).get();
  return { role: g.targetRole, level: g.targetLevel, rungs, rank: rankForRung(g.targetLevel, rungs || g.targetLevel), title: level?.title ?? g.targetRole };
}

/** Does this bank belong to a role? Banks with no role are for everyone. */
export const bankFitsRole = (roles: string, role: string) => {
  const list = roles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(role.trim().toLowerCase());
};

// ---- a person's own terms

export type TermInput = { term: string; meaning: string; tier: number; groupName: string };

export function parseTermInput(raw: { term: unknown; meaning: unknown; tier: unknown; groupName: unknown }): { error: string } | { ok: TermInput } {
  const term = String(raw.term ?? "").trim().replace(/\s+/g, " "), meaning = String(raw.meaning ?? "").trim().replace(/\s+/g, " ");
  const tier = Number(raw.tier), groupName = String(raw.groupName ?? "").trim().replace(/\s+/g, " ");
  if (term.length < 2 || term.length > 80) return { error: "The term must be 2 to 80 characters." };
  if (meaning.length < 8 || meaning.length > 300) return { error: "Say what it means in 8 to 300 characters." };
  if (!Number.isInteger(tier) || tier < 1 || tier > 5) return { error: "Choose a rank from Initiate to Titan." };
  if (groupName.length > 60) return { error: "The group name is too long." };
  if (meaning.toLowerCase().includes(term.toLowerCase())) return { error: "The meaning should not contain the term itself, or the question would give the answer away." };
  return { ok: { term, meaning, tier, groupName } };
}

/** Are these two terms the same word? Used to refuse a repeat inside a bank or a person's own list. */
export const sameTerm = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const termsByIds = (ids: number[]) => (ids.length ? db.select().from(terms).where(inArray(terms.id, ids)).all() : []);

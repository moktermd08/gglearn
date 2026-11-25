import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { careerLevels, db, termExams, termProgress, termStudyRoles, terms, users } from "@/lib/db";
import { allBanks, bankFitsRole, latestResults, sharedTerms, startCheck, type StartResult } from "@/lib/terms";
import { MIN_TIER_TESTED, TERM_PASS, nextReview, rankForRung, rankFromStats, studyState, type StudyState, type TierStats } from "@/lib/termsCore";

type Person = typeof users.$inferSelect;
type TermRow = typeof terms.$inferSelect;

const parseList = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
};
export const listOf = parseList;
export const roleSlug = (role: string) => encodeURIComponent(role);

// ---- roles and levels

export type RoleOption = { role: string; levels: { level: number; title: string }[]; hasTerms: boolean };

/** Every role that has a career ladder, with its levels, and whether any bank is made for it (as opposed to only the terms for everyone). */
export function roleOptions(): RoleOption[] {
  const rows = db.select().from(careerLevels).orderBy(asc(careerLevels.jobRole), asc(careerLevels.level)).all();
  const banks = allBanks();
  const byRole = new Map<string, RoleOption>();
  for (const r of rows) {
    const o = byRole.get(r.jobRole) ?? { role: r.jobRole, levels: [], hasTerms: banks.some((b) => b.roles.trim() !== "" && bankFitsRole(b.roles, r.jobRole)) };
    o.levels.push({ level: r.level, title: r.title });
    byRole.set(r.jobRole, o);
  }
  return [...byRole.values()];
}

const ACRONYMS = new Set(["cto", "ceo", "cfo", "cio", "coo", "cmo", "cpo", "ciso", "hr", "it", "ai", "bi", "pmo", "ml", "bi", "l&d"]);
/** "full stack developer" -> "Full Stack Developer", and "cto" -> "CTO". */
export const roleLabel = (role: string) => role.split(" ").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");

// ---- the list a role and level adds up to

export type RoleList = {
  role: string; level: number; title: string; rung: number; rungs: number;
  /** the highest rank of terms this level covers */
  ceiling: number;
  banks: { id: number; name: string; forRole: boolean }[];
  terms: TermRow[];
};

/**
 * The terms a role at a level must know: every bank made for the role, plus the banks for everyone, limited to the ranks the level reaches (the list grows as
 * the level does). Ordered so what is made for the role comes first, then rank, then the bank's own order. Null when the role has no ladder or the level is not on it.
 */
export function roleList(role: string, level: number): RoleList | null {
  const key = role.trim().toLowerCase();
  const ladder = db.select().from(careerLevels).where(eq(careerLevels.jobRole, key)).orderBy(asc(careerLevels.level)).all();
  const idx = ladder.findIndex((l) => l.level === level);
  if (idx < 0) return null;
  const ceiling = rankForRung(idx + 1, ladder.length);
  const fitting = allBanks().filter((b) => bankFitsRole(b.roles, key));
  const forRole = new Set(fitting.filter((b) => b.roles.trim() !== "").map((b) => b.id));
  const banks = [...fitting].sort((x, y) => Number(!forRole.has(x.id)) - Number(!forRole.has(y.id))); // stable: the made-for-role banks first, each group in its own order
  const order = new Map(banks.map((b, i) => [b.id, i]));
  const list = sharedTerms().filter((t) => t.bankId != null && order.has(t.bankId) && t.tier <= ceiling)
    .sort((a, b) => (order.get(a.bankId!)! - order.get(b.bankId!)!) || a.tier - b.tier || a.sortOrder - b.sortOrder || a.id - b.id);
  return {
    role: key, level, title: ladder[idx].title, rung: idx + 1, rungs: ladder.length, ceiling,
    banks: banks.map((b) => ({ id: b.id, name: b.name, forRole: forRole.has(b.id) })), terms: list,
  };
}

// ---- progress

export type Progress = { box: number; dueAt: number };

export function progressFor(userId: number, termIds: number[]): Map<number, Progress> {
  const out = new Map<number, Progress>();
  for (let i = 0; i < termIds.length; i += 400) {
    const rows = db.select().from(termProgress).where(and(eq(termProgress.userId, userId), inArray(termProgress.termId, termIds.slice(i, i + 400)))).all();
    for (const r of rows) out.set(r.termId, { box: r.box, dueAt: r.dueAt });
  }
  return out;
}

export type RoleSummary = {
  total: number; counts: Record<StudyState, number>; due: number;
  byRank: Record<number, { total: number; known: number }>;
  /** what the checks say: the rank the answers to this list support, and how many of its terms have been asked at all */
  tested: { rank: number; asked: number; stats: TierStats };
};

export function roleSummary(userId: number, list: RoleList, nowSec = Math.floor(Date.now() / 1000)): RoleSummary {
  const prog = progressFor(userId, list.terms.map((t) => t.id));
  const counts: Record<StudyState, number> = { new: 0, learning: 0, known: 0 };
  const byRank: RoleSummary["byRank"] = {};
  let due = 0;
  for (const t of list.terms) {
    const p = prog.get(t.id), st = studyState(p?.box);
    counts[st]++;
    (byRank[t.tier] ??= { total: 0, known: 0 }).total++;
    if (st === "known") byRank[t.tier].known++;
    if (p && p.dueAt <= nowSec) due++;
  }
  const latest = latestResults(userId), stats: TierStats = {};
  let asked = 0;
  for (const t of list.terms) {
    const r = latest.get(t.id);
    if (!r) continue;
    asked++;
    const s = (stats[r.tier] ??= { tested: 0, right: 0 });
    s.tested++;
    if (r.right) s.right++;
  }
  return { total: list.terms.length, counts, due, byRank, tested: { rank: rankFromStats(stats), asked, stats } };
}

export type StudyCard = { id: number; term: string; meaning: string; tier: number; group: string; facts: string[]; useWhen: string; mistakes: string[]; similar: string[]; fresh: boolean };

/** What to study next: terms that are due again first (soonest first), then terms never met, lowest rank first. */
export function studyQueue(userId: number, list: RoleList, limit = 10, nowSec = Math.floor(Date.now() / 1000)): StudyCard[] {
  const prog = progressFor(userId, list.terms.map((t) => t.id));
  const dueNow = list.terms.filter((t) => { const p = prog.get(t.id); return p && p.dueAt <= nowSec; }).sort((a, b) => prog.get(a.id)!.dueAt - prog.get(b.id)!.dueAt);
  const fresh = list.terms.filter((t) => !prog.has(t.id));
  const card = (t: TermRow, isNew: boolean): StudyCard => ({
    id: t.id, term: t.term, meaning: t.meaning, tier: t.tier, group: t.groupName,
    facts: parseList(t.facts), useWhen: t.useWhen, mistakes: parseList(t.mistakes), similar: parseList(t.similar), fresh: isNew,
  });
  return [...dueNow.map((t) => card(t, false)), ...fresh.map((t) => card(t, true))].slice(0, limit);
}

/** Records one answer in a study sitting: knew it, or did not. Only a term on a list the person can see can be recorded. */
export function recordStudy(userId: number, termId: number, knew: boolean, nowSec = Math.floor(Date.now() / 1000)): { error: string } | { ok: true } {
  const t = db.select({ id: terms.id, owner: terms.ownerUserId, status: terms.status }).from(terms).where(eq(terms.id, termId)).get();
  if (!t || t.status !== "active" || (t.owner != null && t.owner !== userId)) return { error: "That term is not available." };
  const cur = db.select().from(termProgress).where(and(eq(termProgress.userId, userId), eq(termProgress.termId, termId))).get();
  const n = nextReview(cur?.box ?? null, knew, nowSec);
  if (cur) db.update(termProgress).set({ box: n.box, dueAt: n.dueAt, seen: cur.seen + 1, lapses: cur.lapses + (n.lapse ? 1 : 0), updatedAt: nowSec }).where(eq(termProgress.id, cur.id)).run();
  else db.insert(termProgress).values({ userId, termId, box: n.box, dueAt: n.dueAt, seen: 1, lapses: 0, updatedAt: nowSec }).run();
  return { ok: true };
}

// ---- the roles a person is learning

export function saveStudyRole(userId: number, role: string, level: number): { error: string } | { ok: true } {
  const key = role.trim().toLowerCase();
  if (!roleList(key, level)) return { error: "Choose a role and a level on its ladder." };
  db.insert(termStudyRoles).values({ userId, role: key, level }).onConflictDoUpdate({ target: [termStudyRoles.userId, termStudyRoles.role], set: { level } }).run();
  return { ok: true };
}

export const removeStudyRole = (userId: number, role: string) =>
  db.delete(termStudyRoles).where(and(eq(termStudyRoles.userId, userId), eq(termStudyRoles.role, role.trim().toLowerCase()))).run();

export const myStudyRoles = (userId: number) =>
  db.select().from(termStudyRoles).where(eq(termStudyRoles.userId, userId)).orderBy(asc(termStudyRoles.createdAt), asc(termStudyRoles.id)).all();

// ---- checks made straight from a list

const CHECK_SIZE = 20;
export const EXAM_SIZE = 20;

/** Picks `n` terms spread across the groups (so one topic cannot take over), the ones least known or tested first, shuffled within that. */
function spread(list: TermRow[], n: number, userId: number): TermRow[] {
  const prog = progressFor(userId, list.map((t) => t.id)), latest = latestResults(userId);
  const score = (t: TermRow) => (latest.get(t.id)?.right ? 2 : 0) + (studyState(prog.get(t.id)?.box) === "known" ? 1 : 0) + Math.random();
  const groups = new Map<string, TermRow[]>();
  for (const t of list) groups.set(t.groupName, [...(groups.get(t.groupName) ?? []), t]);
  const queues = [...groups.values()].map((g) => g.sort((a, b) => score(a) - score(b))).sort(() => Math.random() - 0.5);
  const out: TermRow[] = [];
  for (let round = 0; out.length < n && queues.some((q) => q.length > round); round++) for (const q of queues) if (q[round] && out.length < n) out.push(q[round]);
  return out;
}

/** A 20-term sample of a role's list, tried at the highest rank the list reaches with enough terms to judge it. Terms not yet known or tested come first. */
export function startRoleCheck(user: Person, role: string, level: number): StartResult {
  const list = roleList(role, level);
  if (!list) return { error: "That role and level are not available." };
  let claim = list.ceiling;
  while (claim > 1 && list.terms.filter((t) => t.tier === claim).length < MIN_TIER_TESTED) claim--;
  const atClaim = spread(list.terms.filter((t) => t.tier === claim), Math.min(8, MIN_TIER_TESTED + 5), user.id);
  const rest = spread(list.terms.filter((t) => !atClaim.includes(t)), CHECK_SIZE - atClaim.length, user.id);
  return startCheck(user, claim, [...atClaim, ...rest].map((t) => t.id), { kind: "quick", role: list.role, level });
}

export type RankExam = { rank: number; atRank: number; eligible: number; best: { id: number; score: number; passed: boolean } | null };

/** The rank exams a role level offers: one for each rank up to the level's ceiling that has enough terms to be judged, with the person's best result so far. */
export function rankExams(userId: number, list: RoleList): RankExam[] {
  const done = db.select().from(termExams).where(and(eq(termExams.userId, userId), eq(termExams.kind, "premade"), eq(termExams.role, list.role), eq(termExams.level, list.level), isNotNull(termExams.finishedAt))).all();
  const out: RankExam[] = [];
  for (let rank = 1; rank <= list.ceiling; rank++) {
    const atRank = list.terms.filter((t) => t.tier === rank).length;
    if (atRank < MIN_TIER_TESTED) continue;
    const mine = done.filter((e) => e.claimedTier === rank).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    out.push({ rank, atRank, eligible: list.terms.filter((t) => t.tier <= rank).length, best: mine ? { id: mine.id, score: mine.score ?? 0, passed: (mine.score ?? 0) >= TERM_PASS } : null });
  }
  return out;
}

/**
 * A rank exam for a role level: `EXAM_SIZE` terms from the list's terms at that rank and below, about half at the rank itself, spread across the groups, the least known first.
 * The questions go as deep as the rank, so the Titan exam asks harder things about the same words than the Initiate exam does. Taken again, it asks different questions.
 */
export function startRankExam(user: Person, role: string, level: number, rank: number): StartResult {
  const list = roleList(role, level);
  if (!list) return { error: "That role and level are not available." };
  if (!Number.isInteger(rank) || rank < 1 || rank > list.ceiling) return { error: "This level has no exam at that rank." };
  const at = list.terms.filter((t) => t.tier === rank), below = list.terms.filter((t) => t.tier < rank);
  if (at.length < MIN_TIER_TESTED) return { error: "There are not enough terms at that rank to examine yet." };
  const nAt = Math.min(at.length, Math.max(MIN_TIER_TESTED, Math.round(EXAM_SIZE * (below.length ? 0.5 : 1))));
  const first = spread(at, nAt, user.id);
  const rest = below.length ? spread(below, EXAM_SIZE - first.length, user.id) : [];
  return startCheck(user, rank, [...first, ...rest].map((t) => t.id), { kind: "premade", role: list.role, level });
}

import type { TermLite } from "@/lib/termsCore";

/**
 * The question generator for terms. No database: it takes a term, the pool it can borrow wrong answers from, and the rank being tried, and makes one question.
 *
 * The same term is asked differently at each rank, so the question follows the depth being tested, not only the word:
 *   Initiate  recognise: pick the meaning, pick the term, or say whether a statement is true.
 *   Adept     tell apart: finish a sentence, or say which of two look-alike terms a statement fits.
 *   Expert    apply: which term fits a situation, or which statement about a term is true.
 *   Master    judge: which statement is NOT true, with the look-alike terms as the wrong answers to a situation.
 *   Titan     decide between close calls: how two look-alike terms differ, and the hardest versions of the above.
 * Everything is drawn at random each time (which form, which fact, which wrong answers, what order), and a term's recent forms and facts can be passed in to be avoided,
 * so a person who sits a check again meets different questions.
 */

export type Form = "term-from-meaning" | "meaning-from-term" | "true-false" | "cloze" | "contrast" | "scenario" | "true-statement" | "not-true" | "difference";
export type Question = { termId: number; tier: number; form: Form; key: string; prompt: string; options: string[]; correct: number };
type Rng = () => number;
export type Ctx = { pool: TermLite[]; byName: Map<string, TermLite> };

export const makeCtx = (pool: TermLite[]): Ctx => ({ pool, byName: new Map(pool.map((t) => [t.term.trim().toLowerCase(), t])) });

const OPTIONS = 4;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- what is known about a term

/** A term from a bank carries its meaning as "It ..." and its other facts as verb-first lines, so they can be turned into statements. A person's own term carries only free text. */
const styled = (t: TermLite) => t.source === "shared" && /^It\s/i.test(t.meaning);
const predicate = (m: string) => m.replace(/^It\s+/i, "").trim();
/** Things that are true of the term, as verb-first lines: the meaning first, then the facts. */
export const truths = (t: TermLite): string[] => (styled(t) ? [predicate(t.meaning), ...t.facts.filter((f) => !same(f, predicate(t.meaning)))] : []);
/** Believable lines that are false of the term. */
export const falsehoods = (t: TermLite): string[] => (styled(t) ? t.mistakes : []);
const stmt = (p: string) => `It ${p}`;

// A line that shares most of its content words with something already said about the other term is probably true of both: not safe to use as "true of this one only".
const STOP = new Set(["that", "with", "from", "when", "than", "them", "they", "this", "their", "which", "while", "have", "been", "into", "each", "over", "also"]);
const words = (p: string) => new Set(p.toLowerCase().split(/[^a-z0-9]+/).map((w) => w.replace(/(ing|ed|es|s)$/, "")).filter((w) => w.length >= 4 && !STOP.has(w)));
/** What share of this line's content words already turn up in the other lines. */
export function overlap(line: string, others: string[]): number {
  const mine = words(line), theirs = new Set(others.flatMap((o) => [...words(o)]));
  if (!mine.size) return 0;
  return [...mine].filter((w) => theirs.has(w)).length / mine.size;
}
const SHARED_WORDS = 0.25; // above this, two look-alike terms' lines are too alike to tell apart fairly

/** Could `other` be mistaken for `t`? Look-alikes (either way round), the same words and the same meaning never serve as its wrong answers. */
function confusable(t: TermLite, other: TermLite): boolean {
  return same(t.term, other.term) || t.similar.some((s) => same(s, other.term)) || other.similar.some((s) => same(s, t.term)) || same(t.meaning, other.meaning);
}

/** Wrong-answer terms: close ones first (the same group, then the nearest rank). With `hard`, the look-alikes come first, because telling those apart is the point. */
function wrongTerms(t: TermLite, ctx: Ctx, rng: Rng, n: number, opts: { hard?: boolean; sameSource?: boolean; key?: (o: TermLite) => string } = {}): TermLite[] {
  const key = opts.key ?? ((o: TermLite) => o.term);
  const lookalike = (o: TermLite) => t.similar.some((s) => same(s, o.term)) || o.similar.some((s) => same(s, t.term));
  let cands = ctx.pool.filter((o) => o.id !== t.id && !same(o.term, t.term) && !same(o.meaning, t.meaning));
  if (!opts.hard) cands = cands.filter((o) => !confusable(t, o));
  if (opts.sameSource) cands = cands.filter((o) => o.source === t.source);
  const score = (o: TermLite) => (opts.hard && lookalike(o) ? -20 : 0) + (o.group === t.group ? 0 : 10) + Math.abs(o.tier - t.tier) + rng() * 3;
  const seen = new Set([key(t).trim().toLowerCase()]);
  const out: TermLite[] = [];
  for (const o of [...cands].sort((a, b) => score(a) - score(b))) {
    const k = key(o).trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
    if (out.length === n) break;
  }
  return out;
}

/** Lines that are true of some other term (never this one, nor a look-alike of it), for use as false statements about this one. Terms in the same group come first, so they are believable. */
function borrowedTruths(t: TermLite, ctx: Ctx, rng: Rng, n: number, not: string[]): string[] {
  const mine = new Set([...truths(t), ...not].map((s) => s.toLowerCase()));
  const out: string[] = [];
  const near = (o: TermLite) => (o.group === t.group ? 0 : 10) + Math.abs(o.tier - t.tier) + rng() * 3;
  for (const o of ctx.pool.filter((o) => o.id !== t.id && styled(o) && !confusable(t, o)).sort((a, b) => near(a) - near(b))) {
    const line = shuffle(truths(o), rng)[0];
    if (line && !mine.has(line.toLowerCase()) && !out.some((x) => same(x, line)) && overlap(line, truths(t)) < 0.5) out.push(line);
    if (out.length === n) break;
  }
  return out;
}

/** Picks an index that has not been used for this term lately, if one can be found. */
function fresh(n: number, form: Form, tag: string, avoid: Set<string>, rng: Rng): number {
  const all = Array.from({ length: n }, (_, i) => i);
  const unused = all.filter((i) => !avoid.has(`${form}:${tag}${i}`));
  return (unused.length ? unused : all)[Math.floor(rng() * (unused.length || all.length))];
}

const finish = (t: TermLite, form: Form, key: string, prompt: string, options: string[], right: string, rng: Rng, fixed = false): Question => {
  const opts = fixed ? options : shuffle(options, rng);
  return { termId: t.id, tier: t.tier, form, key, prompt, options: opts, correct: opts.indexOf(right) };
};

// ---- the forms

type Builder = (t: TermLite, ctx: Ctx, rng: Rng, avoid: Set<string>, rank: number) => Question | null;

const termFromMeaning: Builder = (t, ctx, rng) => {
  const wrong = wrongTerms(t, ctx, rng, OPTIONS - 1);
  if (wrong.length < OPTIONS - 1) return null;
  return finish(t, "term-from-meaning", "", `Which term fits this meaning? “${t.meaning}”`, [t.term, ...wrong.map((o) => o.term)], t.term, rng);
};

const meaningFromTerm: Builder = (t, ctx, rng) => {
  const wrong = wrongTerms(t, ctx, rng, OPTIONS - 1, { sameSource: true, key: (o) => o.meaning });
  if (wrong.length < OPTIONS - 1) return null;
  return finish(t, "meaning-from-term", "", `What does “${t.term}” mean?`, [t.meaning, ...wrong.map((o) => o.meaning)], t.meaning, rng);
};

const trueFalse: Builder = (t, ctx, rng, avoid) => {
  const tr = truths(t);
  if (!tr.length) return null;
  const fa = falsehoods(t);
  const wantTrue = rng() < 0.5;
  if (wantTrue || (!fa.length && !borrowedTruths(t, ctx, rng, 1, []).length)) {
    const i = fresh(tr.length, "true-false", "t", avoid, rng);
    return finish(t, "true-false", `t${i}`, `True or false: ${t.term} ${tr[i]}.`, ["True", "False"], "True", rng, true);
  }
  if (fa.length) {
    const j = fresh(fa.length, "true-false", "f", avoid, rng);
    return finish(t, "true-false", `f${j}`, `True or false: ${t.term} ${fa[j]}.`, ["True", "False"], "False", rng, true);
  }
  const line = borrowedTruths(t, ctx, rng, 1, [])[0];
  return finish(t, "true-false", "b", `True or false: ${t.term} ${line}.`, ["True", "False"], "False", rng, true);
};

const cloze: Builder = (t, ctx, rng, avoid) => {
  const tr = truths(t);
  if (!tr.length) return null;
  const wrong = wrongTerms(t, ctx, rng, OPTIONS - 1);
  if (wrong.length < OPTIONS - 1) return null;
  const i = tr.length > 1 ? 1 + fresh(tr.length - 1, "cloze", "", avoid, rng) : 0; // prefer the facts over the meaning, which the first form already uses
  return finish(t, "cloze", String(i), `Which term completes this? “_____ ${tr[i]}.”`, [t.term, ...wrong.map((o) => o.term)], t.term, rng);
};

const lookalike = (t: TermLite, ctx: Ctx, rng: Rng): TermLite | null => {
  for (const name of shuffle(t.similar, rng)) {
    const o = ctx.byName.get(name.trim().toLowerCase());
    if (o && o.id !== t.id && styled(o) && styled(t)) return o;
  }
  return null;
};

const contrast: Builder = (t, ctx, rng, avoid) => {
  const other = lookalike(t, ctx, rng);
  if (!other) return null;
  const a = rng() < 0.5 ? t : other, b = a === t ? other : t; // the statement can be about either of the two
  const own = truths(a).filter((p) => !truths(b).some((q) => same(p, q)) && overlap(p, truths(b)) < SHARED_WORDS);
  if (!own.length) return null;
  const i = fresh(own.length, "contrast", `${a.id}:`, avoid, rng);
  const [first, second] = rng() < 0.5 ? [a, b] : [b, a];
  const opts = [first.term, second.term, "Both", "Neither"];
  return { termId: t.id, tier: t.tier, form: "contrast", key: `${a.id}:${i}`, prompt: `Between ${first.term} and ${second.term}, which ${own[i]}?`, options: opts, correct: opts.indexOf(a.term) };
};

const scenario: Builder = (t, ctx, rng, _avoid, rank) => {
  if (!t.useWhen) return null;
  const wrong = wrongTerms(t, ctx, rng, OPTIONS - 1, { hard: rank >= 4 });
  if (wrong.length < OPTIONS - 1) return null;
  return finish(t, "scenario", rank >= 4 ? "hard" : "", `Which term fits best when you ${t.useWhen}?`, [t.term, ...wrong.map((o) => o.term)], t.term, rng);
};

const trueStatement: Builder = (t, ctx, rng, avoid) => {
  const tr = truths(t);
  if (!tr.length) return null;
  const i = fresh(tr.length, "true-statement", "", avoid, rng);
  const wrong = [...shuffle(falsehoods(t), rng), ...borrowedTruths(t, ctx, rng, OPTIONS, falsehoods(t))].slice(0, OPTIONS - 1);
  if (wrong.length < OPTIONS - 1) return null;
  return finish(t, "true-statement", String(i), `Which statement about ${t.term} is true?`, [stmt(tr[i]), ...wrong.map(stmt)], stmt(tr[i]), rng);
};

const notTrue: Builder = (t, _ctx, rng, avoid) => {
  const tr = truths(t), fa = falsehoods(t);
  if (tr.length < 2 || !fa.length) return null; // with only two true lines it is a three-way question: the two that are true and the one that is not
  const j = fresh(fa.length, "not-true", "", avoid, rng);
  const right = shuffle(tr, rng).slice(0, OPTIONS - 1);
  return finish(t, "not-true", String(j), `Which statement about ${t.term} is NOT true?`, [stmt(fa[j]), ...right.map(stmt)], stmt(fa[j]), rng);
};

const difference: Builder = (t, ctx, rng, avoid) => {
  const other = lookalike(t, ctx, rng);
  if (!other) return null;
  const mine = truths(t).filter((p) => !truths(other).some((q) => same(p, q)) && overlap(p, truths(other)) < SHARED_WORDS);
  const theirs = truths(other).filter((p) => !truths(t).some((q) => same(p, q)) && overlap(p, truths(t)) < SHARED_WORDS);
  if (!mine.length || !theirs.length) return null;
  const i = fresh(mine.length, "difference", `${other.id}:`, avoid, rng);
  const px = mine[i], py = shuffle(theirs, rng)[0];
  const fx = shuffle([...falsehoods(t), ...borrowedTruths(t, ctx, rng, 1, [px, py])], rng)[0];
  const fy = shuffle([...falsehoods(other), ...borrowedTruths(other, ctx, rng, 1, [px, py])], rng)[0];
  if (!fx || !fy) return null;
  const right = `${t.term} ${px}, while ${other.term} ${py}`;
  const options = [right, `${other.term} ${px}, while ${t.term} ${py}`, `${t.term} ${fx}, while ${other.term} ${py}`, `${t.term} ${px}, while ${other.term} ${fy}`];
  if (new Set(options.map((o) => o.toLowerCase())).size < OPTIONS) return null;
  return finish(t, "difference", `${other.id}:${i}`, `How is ${t.term} different from ${other.term}?`, options, right, rng);
};

const BUILD: Record<Form, Builder> = {
  "term-from-meaning": termFromMeaning, "meaning-from-term": meaningFromTerm, "true-false": trueFalse, cloze, contrast, scenario, "true-statement": trueStatement, "not-true": notTrue, difference,
};

/** How likely each form is at each rank. A form a term has no material for is skipped and the next is tried. */
export const WEIGHTS: Record<number, [Form, number][]> = {
  1: [["term-from-meaning", 3], ["meaning-from-term", 3], ["true-false", 4]],
  2: [["cloze", 3], ["contrast", 3], ["true-false", 3], ["term-from-meaning", 1.5]],
  3: [["scenario", 3.5], ["true-statement", 3], ["contrast", 2], ["cloze", 1.5]],
  4: [["not-true", 3], ["scenario", 3], ["true-statement", 2], ["contrast", 2]],
  5: [["difference", 3], ["not-true", 2.5], ["scenario", 2.5], ["contrast", 1], ["true-statement", 1]],
};
const FALLBACKS: Form[] = ["true-statement", "term-from-meaning", "meaning-from-term"]; // forms with the least need of a term's extra material, tried last

/** A random order of the forms, the likelier ones tending to come first (weighted sampling without replacement). */
function weightedOrder(weights: [Form, number][], rng: Rng): Form[] {
  return weights.map(([f, w]) => ({ f, k: Math.pow(rng(), 1 / w) })).sort((a, b) => b.k - a.k).map((x) => x.f);
}

/**
 * One question about a term at a rank. `avoid` holds the "form:key" of questions this term has recently been asked, which are skipped when anything else can be made.
 * Null only when there are too few other terms to make wrong answers from.
 */
export function buildQuestion(t: TermLite, ctx: Ctx, rank: number, rng: Rng = Math.random, avoid: Set<string> = new Set()): Question | null {
  const weights = WEIGHTS[Math.min(5, Math.max(1, rank))];
  const order = [...weightedOrder(weights, rng), ...FALLBACKS.filter((f) => !weights.some(([w]) => w === f))];
  let spare: Question | null = null;
  for (const f of order) {
    const q = BUILD[f](t, ctx, rng, avoid, rank);
    if (!q) continue;
    if (!avoid.has(`${q.form}:${q.key}`)) return q;
    spare ??= q;
  }
  return spare;
}

/** A check over the terms someone picked, at the rank they are trying: a question each, in a shuffled order. */
export function buildCheck(picked: TermLite[], pool: TermLite[], rank: number, rng: Rng = Math.random, avoidByTerm: Map<number, Set<string>> = new Map()): Question[] {
  const ctx = makeCtx(pool);
  const out: Question[] = [];
  for (const t of shuffle(picked, rng)) {
    const q = buildQuestion(t, ctx, rank, rng, avoidByTerm.get(t.id) ?? new Set());
    if (q) out.push(q);
  }
  return out;
}

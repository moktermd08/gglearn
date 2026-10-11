/**
 * Expands a TrackSpec (concept cards + hand-written MCQs) into a large, leveled, deterministic question bank.
 * Difficulty comes from the card's tier, the question form (true/false is easier than "which is NOT true") and
 * how close the distractors are; questions are then ranked and cut into 20 equal levels.
 */
import { CALC, CALC_SETS } from "./calc";
import { makeRng, type Rng } from "./rng";
import type { Card, GenQ, TrackSpec } from "./types";

// generic numeric sets only suit tracks about models, retrieval and training, not tools like Cursor or MCP
const AUTO_CALC = new Set(["llm", "api", "rag", "vec", "ml", "tune"]);
export const LEVEL_COUNT = 20;
export const TARGET_PER_LEVEL = 120;
export const MIN_PER_LEVEL = 100;

const STOP = new Set("the a an and or of to in is are for on with that this it as be by at from its into than can not you your they their which when what used use using also each per via more most only any all one has have will".split(" "));
const toks = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 3 && !STOP.has(w)));
/** like toks, but folds plurals and common endings so "retrieves" and "retrieval" count as the same idea */
const stems = (s: string) => new Set([...toks(s)].map((w) => w.replace(/(ations?|ation|ings?|ing|ies|ied|ed|es|s|al|ly)$/, "")).filter((w) => w.length > 2));
const jac = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};
// keep code identifiers (tf.cast, fit_transform, nn.Module) exactly as written
const cap = (s: string) => (/^[a-z]+[._(\d]|^[a-z]+[A-Z]|^[a-z]+_/.test(s) ? s : s.charAt(0).toUpperCase() + s.slice(1));
const clean = (s: string) => s.trim().replace(/[.\s]+$/, "");
const sentence = (subject: string, pred: string) => `${cap(subject)} ${clean(pred)}.`;

type Prep = Card & { id: number; says: string[]; tk: Set<string>[]; label: string; subjectStems: Set<string>; useStems: Set<string> };

export function generate(spec: TrackSpec): { qs: GenQ[]; pool: number; warnings: string[] } {
  const r = makeRng(spec.slug);
  const warnings: string[] = [];
  const cards: Prep[] = spec.cards.map((c, id) => ({
    ...c, id, says: c.says.map(clean), tk: c.says.map((s) => stems(s)), label: spec.groups[c.group] ?? "",
    subjectStems: stems(c.subject), useStems: stems(c.use ?? ""),
  }));
  for (const c of cards) if (!c.label) warnings.push(`card "${c.subject}": unknown group "${c.group}"`);
  const byGroup = new Map<string, Prep[]>();
  for (const c of cards) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
  const groupKeys = [...byGroup.keys()];
  for (const [g, list] of byGroup) if (list.length < 6) warnings.push(`group "${g}" has only ${list.length} cards (distractors will borrow from other groups)`);

  const subjSet = new Set(cards.map((c) => c.subject.toLowerCase()));
  const related = (a: Prep, b: Prep) =>
    a.id === b.id ||
    (a.like ?? []).some((x) => x.toLowerCase() === b.subject.toLowerCase()) ||
    (b.like ?? []).some((x) => x.toLowerCase() === a.subject.toLowerCase());
  /** a predicate that is (nearly) already true of `c` cannot be used as a wrong answer for it */
  const clash = (c: Prep, pred: string) => {
    const t = stems(pred);
    if (c.says.some((s, i) => s === pred || jac(c.tk[i], t) >= 0.2)) return true;
    // a wrong answer that mentions the subject itself, or its use case, is probably about the same thing
    for (const w of c.subjectStems) if (t.has(w)) return true;
    return c.useStems.size > 0 && jac(c.useStems, t) >= 0.15;
  };
  /** nearest-first pool: same group, then the rest */
  const pool = (c: Prep) => {
    const same = r.shuffle(byGroup.get(c.group) ?? []).filter((x) => !related(c, x));
    // a group of 9+ has enough neighbours; borrowing from other groups is what makes distractors arguably true
    if (same.length >= 8) return same;
    return [...same, ...r.shuffle(cards.filter((x) => x.group !== c.group)).filter((x) => !related(c, x))];
  };

  /** n predicates from other cards that are false of c, mutually distinct */
  function falsePreds(c: Prep, n: number, avoid: string[] = []): { pred: string; from: Prep }[] | null {
    const out: { pred: string; from: Prep }[] = [];
    // wrong statements come from other groups first: siblings in the same group are the ones that turn out to be true too
    const donors = [...r.shuffle(cards.filter((x) => x.group !== c.group && !related(c, x))), ...pool(c).filter((x) => x.group === c.group)];
    for (const d of donors) {
      const cands = r.shuffle(d.says).filter((p) => !clash(c, p) && !avoid.includes(p) && out.every((o) => jac(toks(o.pred), toks(p)) < 0.5));
      if (cands.length) out.push({ pred: cands[0], from: d });
      if (out.length === n) return out;
    }
    return null;
  }
  /** n subjects (other than c) of which the predicate is not true */
  function otherSubjects(c: Prep, pred: string, n: number): Prep[] | null {
    const out: Prep[] = [];
    for (const d of pool(c)) {
      if (clash(d, pred) || out.some((o) => o.subject === d.subject)) continue;
      out.push(d);
      if (out.length === n) return out;
    }
    return null;
  }

  const qs: GenQ[] = [];
  const seen = new Set<string>();
  let cur: Prep | null = null;
  const add = (q: GenQ) => {
    if (seen.has(q.prompt)) return;
    if (cur) { q.subject = cur.subject; q.blurb = sentence(cur.subject, cur.says[0]); }
    if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) return;
    seen.add(q.prompt);
    qs.push(q);
  };
  const base = (c: Prep) => c.tier * 3;
  const j = () => r.next() * 0.9;
  const TF = ["True", "False"];

  for (const c of cards) {
    cur = c;
    const topic = cap(c.label);
    const S = c.subject;
    c.says.forEach((p, i) => {
      const why = sentence(S, p);
      // true / false (true statement)
      add({ prompt: `True or false: ${sentence(S, p)}`, options: TF, correct: 0, topic, hint: why, form: "tf", score: base(c) + j(), timeSec: 20, fixedOrder: true });
      // true / false (false statement: a misconception, or another card's predicate)
      const wrongs = [...(i === 0 ? c.not ?? [] : []).map(clean), ...(falsePreds(c, 1)?.map((x) => x.pred) ?? [])];
      for (const w of wrongs.slice(0, i === 0 ? Math.max(1, (c.not ?? []).length) : 1)) {
        add({ prompt: `True or false: ${sentence(S, w)}`, options: TF, correct: 1, topic, hint: `Actually, ${S} ${p}.`, form: "tf", score: base(c) + 0.5 + j(), timeSec: 20, fixedOrder: true });
      }
      // complete the statement / which description (two stems)
      const d1 = falsePreds(c, 3, (c.not ?? []).map(clean).slice(0, 0));
      if (d1) {
        const nots = (c.not ?? []).map(clean);
        const dd = i === 0 && nots.length ? [nots[0], ...d1.slice(0, 2).map((x) => x.pred)] : d1.map((x) => x.pred);
        // a different wording per predicate keeps every prompt unique without a visible counter
        const k = i % 5;
        add({ prompt: [`Complete the statement: “${cap(S)} …”`, `Finish this sentence: “${cap(S)} …”`, `Which ending is correct? “${cap(S)} …”`, `Pick the right continuation: “${cap(S)} …”`, `Fill in the rest: “${cap(S)} …”`][k],
          options: [p, ...dd], correct: 0, topic, hint: why, form: "defn", score: base(c) + 1 + j(), timeSec: 40 });
        const d2 = falsePreds(c, 3, dd);
        if (d2) add({ prompt: [`Which description of ${S} is accurate?`, `Which statement about ${S} is correct?`, `Which of these is true of ${S}?`, `What best describes ${S}?`, `Which option correctly characterises ${S}?`][k],
          options: [p, ...d2.map((x) => x.pred)], correct: 0, topic, hint: why, form: "defn", score: base(c) + 1.4 + j(), timeSec: 40 });
      }
      // which <group> ...? (two stems)
      const subs = otherSubjects(c, p, 3);
      if (subs) {
        add({ prompt: `Which ${c.label} ${p}?`, options: [S, ...subs.map((d) => d.subject)], correct: 0, topic, hint: why, form: "term", score: base(c) + 2 + j(), timeSec: 45 });
        const subs2 = otherSubjects(c, p, 6)?.slice(3);
        if (subs2 && subs2.length === 3) add({ prompt: `Name the ${c.label} that ${p}.`, options: [S, ...subs2.map((d) => d.subject)], correct: 0, topic, hint: why, form: "term", score: base(c) + 2.3 + j(), timeSec: 45 });
      }
      // two-way contrast
      const partner = pool(c).find((d) => d.group === c.group && !clash(d, p));
      if (partner) {
        const pair = r.shuffle([S, partner.subject]);
        add({ prompt: `Between ${S} and ${partner.subject}, which ${p}?`, options: [...pair, "Both", "Neither"], correct: pair.indexOf(S), topic, hint: why, form: "contrast", score: base(c) + 3.5 + j(), timeSec: 50, fixedOrder: true });
      }
    });

    // which is NOT true of S
    const own = r.shuffle(c.says);
    const outsider = falsePreds(c, 1);
    if (own.length >= 3 && outsider) {
      add({ prompt: `Which of these is NOT true of ${S}?`, options: [outsider[0].pred, ...own.slice(0, 3)], correct: 0, topic,
        hint: `${S} does not do that; ${outsider[0].from.subject} ${outsider[0].pred}.`, form: "except", score: base(c) + 3 + j(), timeSec: 50 });
    }
    // misconception
    if (c.not?.length && own.length >= 3) {
      add({ prompt: `Which statement about ${S} is incorrect?`, options: [clean(c.not[0]), ...own.slice(0, 3)], correct: 0, topic,
        hint: `That is a common misconception: ${S} ${c.says[0]}.`, form: "except", score: base(c) + 3.2 + j(), timeSec: 50 });
    }
    // scenario
    if (c.use) {
      const u = clean(c.use);
      const subs = otherSubjects(c, u, 3);
      if (subs) {
        add({ prompt: `Which ${c.label} fits best when you ${u}?`, options: [S, ...subs.map((d) => d.subject)], correct: 0, topic, hint: `${S} ${c.says[0]}.`, form: "scenario", score: base(c) + 2.5 + j(), timeSec: 50 });
        const subs2 = otherSubjects(c, u, 6)?.slice(3);
        if (subs2 && subs2.length === 3) add({ prompt: `You ${u}. Which ${c.label} should you reach for?`, options: [S, ...subs2.map((d) => d.subject)], correct: 0, topic, hint: `${S} ${c.says[0]}.`, form: "scenario", score: base(c) + 2.8 + j(), timeSec: 50 });
      }
    }
    // classification
    if (groupKeys.length >= 3) {
      const others = r.shuffle(groupKeys.filter((g) => g !== c.group)).slice(0, 3).map((g) => spec.groups[g]);
      const labels = [c.label, ...others];
      if (new Set(labels).size === labels.length) {
        add({ prompt: `What kind of thing is ${S}?`, options: labels.map(cap), correct: 0, topic, hint: `${S} is a ${c.label}.`, form: "kind", score: base(c) + 0.8 + j(), timeSec: 30 });
      }
    }
  }

  cur = null;
  // hand-written
  for (const [i, q] of (spec.qa ?? []).entries()) {
    add({ prompt: q.q, code: q.code, options: [q.right, ...q.wrong], correct: 0, topic: cap(q.topic ?? "Applied"), hint: q.why, form: "qa", score: q.tier * 3 + 2 + j(), timeSec: q.code ? 75 : 55 });
    void i;
  }

  // parametric
  const set = new Set<string>(spec.calc ?? []);
  for (const [prefix, ids] of Object.entries(CALC_SETS)) if (AUTO_CALC.has(prefix) && spec.slug.startsWith(prefix + "-")) ids.forEach((x) => set.add(x));
  const ids = [...set].filter((x) => CALC[x]);
  if (ids.length) {
    const quota = Math.min(200, Math.round(ids.length * 24));
    let made = 0, guard = 0;
    while (made < quota && guard++ < quota * 12) {
      const id = ids[guard % ids.length];
      const c = CALC[id](r);
      const before = qs.length;
      const opts = [c.right, ...c.wrong].slice(0, 4);
      if (opts.length < 4) continue;
      add({ prompt: c.prompt, options: opts, correct: 0, topic: "Calculations", hint: c.why, form: "calc", score: c.diff * 3 + 1.5 + j(), timeSec: 90 });
      if (qs.length > before) made++;
    }
  }

  // even out the bank, then rank and cut into levels
  const cap_ = LEVEL_COUNT * TARGET_PER_LEVEL;
  let kept = qs;
  if (qs.length > cap_) {
    const keep = qs.filter((q) => q.form === "qa");
    kept = [...keep, ...r.shuffle(qs.filter((q) => q.form !== "qa")).slice(0, cap_ - keep.length)];
  }
  kept.sort((a, b) => a.score - b.score);
  return { qs: kept, pool: qs.length, warnings };
}

/** level (1..20) of the i-th question of n, easiest first */
export const levelOf = (i: number, n: number) => 1 + Math.min(LEVEL_COUNT - 1, Math.floor((i / n) * LEVEL_COUNT));

export function shuffled(q: GenQ, r: Rng): { options: { key: string; text: string }[]; answer: string } {
  const idx = q.options.map((_, i) => i);
  const order = q.fixedOrder ? idx : r.shuffle(idx);
  const keys = "abcd";
  return { options: order.map((o, k) => ({ key: keys[k], text: q.options[o] })), answer: keys[order.indexOf(q.correct)] };
}

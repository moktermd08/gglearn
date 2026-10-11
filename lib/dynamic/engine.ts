import { rng, type Rng } from "./rng";
import type { Draft, Family, Generated } from "./types";
import { FAMILIES } from "./families";
import { primaryTag, tagsFor } from "./tags";

export function familiesFor(slug: string, level: number): Family[] {
  const tags = new Set(tagsFor(slug));
  return FAMILIES.filter((f) => f.tags.some((t) => tags.has(t)) && level >= f.levels[0] && level <= f.levels[1]);
}

/** Turns a draft into a keyed multiple-choice question, or null when it can't offer four distinct options. */
export function finalize(r: Rng, family: string, d: Draft): Generated | null {
  const seen = new Set([d.correct.trim()]);
  const wrong: string[] = [];
  for (const w of d.wrong) {
    const k = w.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k); wrong.push(w);
  }
  // numeric answers (optionally with a unit) can always be padded with neighbouring values
  const m = /^(-?\d+(?:\.\d+)?)(\D*)$/.exec(d.correct.trim());
  if (m && wrong.length < 3) {
    const base = Number(m[1]), unit = m[2], decimals = (m[1].split(".")[1] ?? "").length;
    const step = Math.max(1, Math.round(Math.abs(base) / 10));
    for (const delta of r.shuffle([1, -1, 2, -2, 3, -3, 5, -5, 10])) {
      if (wrong.length >= 3) break;
      const v = base + delta * step, text = `${decimals ? v.toFixed(decimals) : v}${unit}`, k = text.trim();
      if (v < 0 && base >= 0) continue;
      if (!seen.has(k)) { seen.add(k); wrong.push(text); }
    }
  }
  if (wrong.length < 3) return null;
  const opts = r.shuffle([d.correct, ...wrong.slice(0, 3)]);
  const options = opts.map((text, i) => ({ key: "abcd"[i], text }));
  return {
    family, prompt: d.prompt, code: d.code ?? null, options,
    answer: options.find((o) => o.text === d.correct)!.key, topic: d.topic, hint: d.hint ?? null,
  };
}

/** The identity of a question for "has this learner seen it": level + prompt, the same key the database enforces. */
export const keyOf = (level: number, prompt: string) => `${level}|${prompt}`;

/**
 * Draws `count` questions for a track level that are not in `seen`. Families are visited in a shuffled round robin so a
 * level mixes topics. Each candidate gets its own sub-seed, so the same `seed` reproduces the same set.
 */
export function generate(slug: string, level: number, count: number, seen: ReadonlySet<string>, seed: string): Generated[] {
  const fams = familiesFor(slug, level);
  if (!fams.length) return [];
  const own = primaryTag(slug), maxPer = Math.max(2, Math.ceil(count * 0.4));
  const used = new Map<string, number>();
  const out: Generated[] = [], taken = new Set<string>();
  const order = rng(`${seed}:order`);
  // families carrying the track's own subject appear twice in each cycle, so they are drawn about twice as often
  const cycle = () => order.shuffle(fams.flatMap((f) => (own && f.tags.includes(own) ? [f, f] : [f])));
  let queue: Family[] = [];
  for (let i = 0; out.length < count && i < count * 40; i++) {
    if (!queue.length) queue = cycle();
    const fam = queue.pop()!;
    if ((used.get(fam.id) ?? 0) >= maxPer && fams.length > 1) continue;
    const r = rng(`${seed}:${i}`);
    let g: Generated | null = null;
    try { g = finalize(r, fam.id, fam.make(r, level)); } catch { g = null; }
    if (!g) continue;
    const k = keyOf(level, g.prompt);
    if (seen.has(k) || taken.has(k)) continue;
    taken.add(k); out.push(g); used.set(fam.id, (used.get(fam.id) ?? 0) + 1);
  }
  // if the per-family cap left us short (few families), top up without it
  for (let i = count * 40; out.length < count && i < count * 80; i++) {
    const fam = order.pick(fams), r = rng(`${seed}:${i}`);
    let g: Generated | null = null;
    try { g = finalize(r, fam.id, fam.make(r, level)); } catch { g = null; }
    if (!g) continue;
    const k = keyOf(level, g.prompt);
    if (seen.has(k) || taken.has(k)) continue;
    taken.add(k); out.push(g);
  }
  return out;
}

/** How many distinct prompts a family can produce at a level (sampled). This is what coverage counts as capacity. */
export function distinctPrompts(fam: Family, level: number, samples = 400): number {
  const keys = new Set<string>();
  for (let i = 0; i < samples; i++) {
    const r = rng(`cap:${fam.id}:${level}:${i}`);
    try { const g = finalize(r, fam.id, fam.make(r, level)); if (g) keys.add(g.prompt); } catch { /* counted as nothing */ }
  }
  return keys.size;
}

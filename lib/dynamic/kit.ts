import type { Rng } from "./rng";

/** Level 1..20 -> difficulty tier 0..3. */
export const tier = (level: number) => Math.min(3, Math.floor((level - 1) / 5));

/** Distinct numeric look-alikes around `n` (off by a little, doubled, halved when big enough), never `n` and never negative for a non-negative `n`. */
export function nearNums(r: Rng, n: number, count = 3, step = 1): number[] {
  const pool = new Set<number>();
  const cands = [n + step, n - step, n + 2 * step, n - 2 * step, n + 3 * step, n - 3 * step];
  if (Math.abs(n) >= 6) cands.push(n * 2, Math.round(n / 2));
  if (Math.abs(n) >= 40) cands.push(Math.round(n * 1.1), Math.round(n * 0.9));
  for (const c of r.shuffle(cands)) if (c !== n && Number.isFinite(c) && !(n >= 0 && c < 0)) pool.add(c);
  for (let k = 4; pool.size < count; k++) for (const c of [n + k * step, n - k * step]) if (c !== n && !(n >= 0 && c < 0)) pool.add(c);
  return [...pool].slice(0, count);
}

/** Plausible wrong strings for a string answer: reversed, re-cased, trimmed or rotated copies of it. */
export function variants(s: string): string[] {
  const out = new Set<string>([[...s].reverse().join(""), s.toUpperCase(), s.toLowerCase()]);
  if (s.length > 1) { out.add(s.slice(1)); out.add(s.slice(0, -1)); out.add(s.slice(1) + s[0]); out.add(s[s.length - 1] + s.slice(0, -1)); }
  if (s) { out.add(s + s[s.length - 1]); out.add(s[0].toUpperCase() + s.slice(1)); }
  if (/^[a-z]$/i.test(s)) for (const d of [-2, -1, 1, 2]) { const c = s.charCodeAt(0) + d, lo = s === s.toLowerCase() ? 97 : 65; if (c >= lo && c < lo + 26) out.add(String.fromCharCode(c)); }
  out.delete(s);
  return [...out];
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
/** Trim float noise: 0.30000000000000004 -> "0.3". */
export const num = (n: number, d = 4) => String(round(n, d));

export const WORDS = ["apple", "river", "stone", "cloud", "ember", "tiger", "maple", "orbit", "pixel", "quartz", "delta", "harbor", "violet", "falcon", "cobalt", "meadow", "nectar", "lantern", "summit", "willow", "copper", "breeze", "anchor", "saffron", "ripple", "thistle", "mosaic", "glacier", "tundra", "velvet"];
export const NAMES = ["Ava", "Noah", "Mia", "Liam", "Zoe", "Omar", "Priya", "Leo", "Sana", "Ben", "Iris", "Kai", "Nora", "Raj", "Tess", "Yuki", "Hugo", "Lena", "Mateo", "Dara"];
export const NOUNS = ["order", "invoice", "customer", "product", "ticket", "article", "comment", "project", "account", "report", "booking", "device", "coupon", "review", "shipment", "task", "member", "payment", "session", "message"];
export const IDENTS = ["total", "count", "score", "items", "value", "price", "size", "limit", "index", "result", "step", "level", "width", "delta", "stock", "rate"];

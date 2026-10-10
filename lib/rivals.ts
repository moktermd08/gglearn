import { MAX_LEVEL, XP_PER_LEVEL } from "@/lib/levels";

const NAMES = [
  ["Byte", "a cheerful robot who never skips a day"], ["Nova", "a comet-fast prodigy"],
  ["Ziggy", "a clever fox with a stopwatch"], ["Bolt", "a tireless sprinter"],
  ["Echo", "a mimic who copies your pace"], ["Rex", "a competitive little dragon"],
  ["Pixel", "a glitchy but brilliant sprite"], ["Orbit", "a space cadet on a mission"],
] as const;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export type Rival = { name: string; tagline: string; hue: number; pace: number };

/** Every track gets a stable rival. Pace is XP per day; a steady human learner can stay level with it. */
export function rivalFor(trackSlug: string): Rival {
  const h = hash(trackSlug);
  const [name, tagline] = NAMES[h % NAMES.length];
  return { name, tagline, hue: (h >> 3) % 360, pace: 55 + (h % 4) * 5 };
}

/** The rival trains every day with a small deterministic wobble, so the race stays tense. */
export function rivalProgress(rival: Rival, trackSlug: string, startedAt: number, nowSec = Math.floor(Date.now() / 1000)) {
  const days = Math.max(0, Math.floor((nowSec - startedAt) / 86400));
  let xp = 0;
  for (let d = 0; d < days; d++) xp += Math.round(rival.pace * (0.7 + 0.6 * ((hash(`${trackSlug}:${d}`) % 100) / 100)));
  xp += Math.round(rival.pace * 0.5); // a head start on day one
  const level = Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL));
  return { xp, level, days };
}

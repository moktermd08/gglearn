import { XP_PER_LEVEL } from "@/lib/levels";

/**
 * Bot opponents are SIMULATED. They do not study and they are not real people. Each follows a fixed,
 * published daily XP schedule, so the contest is transparent and a finished result never changes.
 * Pace is XP per day on the same scale humans use (150 XP = one level).
 */
export const BOT_TIERS = {
  casual: { label: "Casual", pace: 45, blurb: "about one level every 3 days" },
  steady: { label: "Steady", pace: 75, blurb: "about one level every 2 days" },
  fierce: { label: "Fierce", pace: 120, blurb: "about one level a day" },
} as const;
export type BotTier = keyof typeof BOT_TIERS;

export const BOT_STYLES = {
  steady: { label: "Steady", blurb: "Trains at a similar pace every day." },
  sprinter: { label: "Sprinter", blurb: "Fast start, then fades as the contest goes on." },
  crammer: { label: "Crammer", blurb: "Quiet for most of the contest, then a big push at the end." },
  weekender: { label: "Weekender", blurb: "Mostly rests on weekdays, trains hard on Saturday and Sunday." },
  perfectionist: { label: "Perfectionist", blurb: "A little slower, but never misses a day." },
} as const;
export type BotStyle = keyof typeof BOT_STYLES;
const STYLE_KEYS = Object.keys(BOT_STYLES) as BotStyle[];

const NAMES = [
  "Ada", "Biscuit", "Cobalt", "Dot", "Ember", "Fig", "Gizmo", "Hex", "Indigo", "Juniper", "Kiwi", "Lumen",
  "Mochi", "Nimbus", "Olive", "Pepper", "Quill", "Rune", "Sprocket", "Tango", "Umber", "Vesper", "Waffle", "Yarrow", "Zephyr",
] as const;

export const SPECIES = ["boxbot", "roundbot", "owl", "fox", "cat", "alien", "ghost", "dragon"] as const;

const TAGLINES: Record<BotStyle, string[]> = {
  steady: ["shows up every single day", "slow and sure"],
  sprinter: ["goes out fast and hopes to hold on", "all gas, no brakes"],
  crammer: ["leaves it all to the final stretch", "fashionably last-minute"],
  weekender: ["saves the grind for the weekend", "weekday lurker, weekend warrior"],
  perfectionist: ["double-checks everything", "never skips a day"],
};

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export type BotPersona = { name: string; tagline: string; style: BotStyle; pace: number; seed: string };

/** Distinct personas for one contest: no two bots share a name, a style (while styles last) or a look. */
export function makeBots(competitionSeed: string, tiers: BotTier[]): BotPersona[] {
  const usedNames = new Set<string>(), usedStyles = new Set<BotStyle>();
  return tiers.map((tier, i) => {
    const seed = `${competitionSeed}:${i}`, h = hash(seed);
    let name = NAMES[h % NAMES.length];
    for (let k = 1; usedNames.has(name); k++) name = NAMES[(h + k * 7) % NAMES.length];
    usedNames.add(name);
    const free = STYLE_KEYS.filter((s) => !usedStyles.has(s));
    const pool = free.length ? free : STYLE_KEYS;
    const style = pool[(h >>> 5) % pool.length];
    usedStyles.add(style);
    const t = TAGLINES[style];
    return { name, tagline: t[(h >>> 9) % t.length], style, pace: BOT_TIERS[tier].pace, seed };
  });
}

export type BotSpec = { style: BotStyle; pace: number; seed: string };
const DAY = 86400;

/** XP the bot earns on day `d` (0-based) of a contest that lasts `totalDays`. */
function dayXp(b: BotSpec, startsAt: number, d: number, totalDays: number) {
  const noise = (hash(`${b.seed}:${d}`) % 100) / 100; // 0..0.99, fixed for this bot and day
  const progress = d / Math.max(1, totalDays);
  const dow = new Date((startsAt + d * DAY) * 1000).getUTCDay();
  let f: number;
  switch (b.style) {
    case "sprinter": f = (1.9 - 1.5 * progress) * (0.9 + 0.2 * noise); break;
    case "crammer": f = (progress < 0.7 ? 0.4 : 2.2) * (0.9 + 0.2 * noise); break;
    case "weekender": f = (dow === 0 || dow === 6 ? 2.7 : 0.4) * (0.9 + 0.2 * noise); break;
    case "perfectionist": f = 0.9; break;
    default: f = 0.85 + 0.3 * noise;
  }
  return b.pace * f;
}

/** Total simulated XP at time `atSec`. */
export function botXpAt(b: BotSpec, startsAt: number, endsAt: number, atSec: number): number {
  const totalDays = Math.max(1, Math.ceil((endsAt - startsAt) / DAY));
  const elapsed = Math.max(0, Math.min(atSec, endsAt) - startsAt);
  const full = Math.floor(elapsed / DAY);
  let xp = 0;
  for (let d = 0; d < full; d++) xp += dayXp(b, startsAt, d, totalDays);
  xp += ((elapsed % DAY) / DAY) * dayXp(b, startsAt, full, totalDays);
  return Math.round(xp);
}

/** When the bot's simulated XP first reaches `levels` levels, or null if it never does before `endsAt`. */
export function botReachedAt(b: BotSpec, startsAt: number, endsAt: number, levels: number): number | null {
  const need = levels * XP_PER_LEVEL, totalDays = Math.max(1, Math.ceil((endsAt - startsAt) / DAY));
  let acc = 0;
  for (let d = 0; d < totalDays; d++) {
    const x = dayXp(b, startsAt, d, totalDays);
    if (acc + x >= need) {
      const t = startsAt + d * DAY + Math.round(((need - acc) / x) * DAY);
      return t <= endsAt ? t : null;
    }
    acc += x;
  }
  return null;
}

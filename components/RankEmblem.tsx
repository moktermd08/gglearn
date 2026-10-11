import type { ComponentType, SVGProps } from "react";
import { Award, BookOpen, Brain, Castle, Compass, Crown, Dumbbell, Flame, Footprints, Gem, Hammer, Key, Microscope, Rocket, ShieldCheck, Sprout, Star, Target, Wand2, Wrench } from "lucide-react";
import { TIERS, tierOf } from "@/lib/levels";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

/** One icon per level, in the order of LEVELS: a sprout for Novice up to a crown for Titan. */
export const LEVEL_ICONS: Icon[] = [
  Sprout, Hammer, BookOpen, Footprints, Dumbbell, // 1 Novice, 2 Apprentice, 3 Learner, 4 Beginner, 5 Trainee
  Wrench, Compass, Key, Target, Award, // 6 Practitioner, 7 Competent, 8 Capable, 9 Skilled, 10 Proficient
  Rocket, Microscope, Brain, ShieldCheck, Star, // 11 Advanced, 12 Specialist, 13 Expert, 14 Veteran, 15 Master
  Gem, Wand2, Flame, Castle, Crown, // 16 Elite, 17 Virtuoso, 18 Legend, 19 Grandmaster, 20 Titan
];

/**
 * Shield badge for a level: its own icon, its number in a chip, and its rank's colour. Done levels are solid with a tick,
 * the current level glows, "preview" is the full-colour look for people who have not started, and locked levels keep their colour
 * (faded) with a small lock, so the whole climb reads as a path rather than a row of padlocks.
 */
export function RankEmblem({ level, state = "done", size = 56 }: { level: number; state?: "done" | "current" | "locked" | "preview"; size?: number }) {
  const hue = TIERS[tierOf(level)].hue;
  const locked = state === "locked";
  const Icon = LEVEL_ICONS[Math.min(Math.max(level, 1), LEVEL_ICONS.length) - 1];
  const id = `re-${level}-${state}`;
  const top = locked ? `hsl(${hue} 38% 90%)` : `hsl(${hue} 85% 62%)`, bottom = locked ? `hsl(${hue} 30% 80%)` : `hsl(${hue} 80% 38%)`;
  const edge = locked ? `hsl(${hue} 30% 68%)` : `hsl(${hue} 95% 80%)`;
  const ink = locked ? `hsl(${hue} 30% 52%)` : "#fff";
  return (
    <svg viewBox="0 0 60 70" width={size} height={size * 70 / 60} className={state === "current" ? "pulse-glow" : ""} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
      <path d="M30 3 L56 13 V36 Q56 58 30 67 Q4 58 4 36 V13Z" fill={`url(#${id})`} stroke={edge} strokeWidth="3" />
      {!locked && <path d="M30 9 L50 17 V36 Q50 52 30 61Z" fill="#fff" opacity=".14" />}
      <Icon x={16.5} y={14} width={27} height={27} color={ink} strokeWidth={2} />
      <g transform="translate(30 53)"><circle r="8.5" fill={locked ? "#fff" : "#fff"} fillOpacity={locked ? 0.85 : 0.95} stroke={edge} strokeWidth="1.2" />
        <text y="4" textAnchor="middle" fontSize={level > 9 ? 10 : 11} fontWeight="800" fill={locked ? `hsl(${hue} 30% 42%)` : `hsl(${hue} 75% 38%)`}>{level}</text></g>
      {locked && (
        <g transform="translate(40 14)"><circle cx="9" cy="9" r="8" fill="#fff" stroke={edge} strokeWidth="1.5" />
          <rect x="5.5" y="9" width="7" height="5.5" rx="1.5" fill={ink} /><path d="M7 9V7.3a2 2 0 0 1 4 0V9" fill="none" stroke={ink} strokeWidth="1.4" /></g>
      )}
      {state === "done" && (
        <g transform="translate(40 14)"><circle cx="9" cy="9" r="8" fill="#10b981" stroke="#fff" strokeWidth="1.5" /><path d="M5 9.5l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
      )}
    </svg>
  );
}

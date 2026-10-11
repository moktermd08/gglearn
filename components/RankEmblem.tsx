import { TIERS, tierOf } from "@/lib/levels";

/**
 * Shield badge for a level, always in its rank's colour. Done levels are solid with a tick, the current level glows,
 * "preview" is the full-colour look for people who have not started yet, and locked levels keep their colour (faded) with the number visible, so the whole climb reads as a path rather than a row of padlocks.
 */
export function RankEmblem({ level, state = "done", size = 56 }: { level: number; state?: "done" | "current" | "locked" | "preview"; size?: number }) {
  const hue = TIERS[tierOf(level)].hue;
  const locked = state === "locked";
  const id = `re-${level}-${state}`;
  const top = locked ? `hsl(${hue} 38% 90%)` : `hsl(${hue} 85% 62%)`, bottom = locked ? `hsl(${hue} 30% 80%)` : `hsl(${hue} 80% 38%)`;
  const edge = locked ? `hsl(${hue} 30% 68%)` : `hsl(${hue} 95% 80%)`;
  return (
    <svg viewBox="0 0 60 70" width={size} height={size * 70 / 60} className={state === "current" ? "pulse-glow" : ""} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
      <path d="M30 3 L56 13 V36 Q56 58 30 67 Q4 58 4 36 V13Z" fill={`url(#${id})`} stroke={edge} strokeWidth="3" />
      {!locked && <path d="M30 9 L50 17 V36 Q50 52 30 61Z" fill="#fff" opacity=".14" />}
      {!locked && <path d="M12 20 L30 12 L48 20" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />}
      <text x="30" y="43" textAnchor="middle" fontSize="24" fontWeight="800" fill={locked ? `hsl(${hue} 30% 52%)` : "#fff"}>{level}</text>
      {locked && (
        <g transform="translate(40 46)"><circle cx="9" cy="9" r="9" fill="#fff" stroke={edge} strokeWidth="1.5" />
          <rect x="5" y="9" width="8" height="6" rx="1.5" fill={`hsl(${hue} 30% 52%)`} /><path d="M6.5 9V7a2.5 2.5 0 0 1 5 0v2" fill="none" stroke={`hsl(${hue} 30% 52%)`} strokeWidth="1.5" /></g>
      )}
      {state === "done" && (
        <g transform="translate(40 46)"><circle cx="9" cy="9" r="9" fill="#10b981" stroke="#fff" strokeWidth="1.5" /><path d="M5 9.5l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
      )}
    </svg>
  );
}

import { TIERS, tierOf } from "@/lib/levels";

/** Shield badge for a level. `state` greys out locked levels and glows the current one. */
export function RankEmblem({ level, state = "done", size = 56 }: { level: number; state?: "done" | "current" | "locked"; size?: number }) {
  const hue = TIERS[tierOf(level)].hue;
  const fill = state === "locked" ? "#334155" : `hsl(${hue} 75% 50%)`;
  const edge = state === "locked" ? "#475569" : `hsl(${hue} 90% 75%)`;
  return (
    <svg viewBox="0 0 60 70" width={size} height={size * 70 / 60} className={state === "current" ? "pulse-glow" : ""} aria-hidden>
      <path d="M30 3 L56 13 V36 Q56 58 30 67 Q4 58 4 36 V13Z" fill={fill} stroke={edge} strokeWidth="3" />
      {state !== "locked" && <path d="M30 9 L50 17 V36 Q50 52 30 61Z" fill="#fff" opacity=".12" />}
      <text x="30" y="43" textAnchor="middle" fontSize="24" fontWeight="800" fill={state === "locked" ? "#94a3b8" : "#fff"}>
        {state === "locked" ? "🔒" : level}
      </text>
    </svg>
  );
}

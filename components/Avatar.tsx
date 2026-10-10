import { TIERS, tierOf } from "@/lib/levels";

type Props = { kind: "human" | "rival"; level: number; hue?: number; size?: number; className?: string };

/** Hand-drawn SVG fighter. The same body evolves through five ranks: scarf, armour, cape, crown + aura. */
export function Avatar({ kind, level, hue, size = 96, className = "" }: Props) {
  const tier = tierOf(level);
  const c = hue ?? TIERS[tier].hue;
  const main = `hsl(${c} 80% 58%)`, dark = `hsl(${c} 70% 32%)`, light = `hsl(${c} 90% 78%)`;
  const human = kind === "human";
  return (
    <svg viewBox="0 0 120 140" width={size} height={size * 140 / 120} className={className} role="img"
      aria-label={`${human ? "You" : "Rival"} at ${TIERS[tier].name} rank`}>
      <defs>
        <radialGradient id={`aura${kind}${tier}`} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor={light} stopOpacity=".55" /><stop offset="100%" stopColor={light} stopOpacity="0" />
        </radialGradient>
      </defs>
      {tier >= 2 && <circle cx="60" cy="72" r="62" fill={`url(#aura${kind}${tier})`} className="aura" />}
      {tier >= 4 && (
        <g fill={light} opacity=".85" className="aura">
          <path d="M18 70 Q0 40 10 12 Q30 30 44 62Z" /><path d="M102 70 Q120 40 110 12 Q90 30 76 62Z" />
        </g>
      )}
      {tier >= 3 && <path d="M32 74 Q60 140 88 74 L96 132 Q60 142 24 132Z" fill={dark} opacity=".9" />}
      {/* body */}
      <path d="M32 138 Q32 92 60 90 Q88 92 88 138Z" fill={human ? main : "#475569"} />
      {tier >= 2 && (<><ellipse cx="34" cy="98" rx="11" ry="8" fill={light} stroke={dark} strokeWidth="2" /><ellipse cx="86" cy="98" rx="11" ry="8" fill={light} stroke={dark} strokeWidth="2" /></>)}
      {tier >= 1 && <path d="M44 92 L60 112 L76 92 L72 88 L60 100 L48 88Z" fill={light} />}
      {tier === 0 && <circle cx="60" cy="108" r="5" fill={light} />}
      {/* head */}
      {human ? (
        <>
          <circle cx="60" cy="56" r="28" fill="#f2c6a0" />
          <path d="M31 54 Q32 24 60 24 Q88 24 89 54 Q78 38 60 40 Q42 38 31 54Z" fill={dark} />
          <circle cx="49" cy="58" r="3.5" fill="#1c1917" className="blink" /><circle cx="71" cy="58" r="3.5" fill="#1c1917" className="blink" />
          <path d="M50 70 Q60 78 70 70" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="60" y1="22" x2="60" y2="8" stroke="#94a3b8" strokeWidth="3" /><circle cx="60" cy="7" r="5" fill={main} className="aura" />
          <rect x="32" y="26" width="56" height="52" rx="16" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
          <rect x="39" y="42" width="42" height="20" rx="8" fill="#0f172a" />
          <circle cx="51" cy="52" r="5" fill={main} className="blink" /><circle cx="69" cy="52" r="5" fill={main} className="blink" />
          <rect x="48" y="68" width="24" height="4" rx="2" fill="#64748b" />
        </>
      )}
      {tier >= 4 && <path d="M38 32 L44 12 L52 26 L60 6 L68 26 L76 12 L82 32Z" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />}
    </svg>
  );
}

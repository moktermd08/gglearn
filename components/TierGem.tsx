import { TIERS } from "@/lib/leagueRules";

/** A league tier drawn as a faceted gem in the tier's colour. No image files: it is a few shapes. */
export function TierGem({ tier, size = 56, className = "" }: { tier: number; size?: number; className?: string }) {
  const h = TIERS[Math.min(Math.max(tier, 0), TIERS.length - 1)].hue;
  const light = `hsl(${h} 85% 72%)`, mid = `hsl(${h} 75% 55%)`, dark = `hsl(${h} 70% 38%)`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={`${TIERS[tier]?.name ?? "Bronze"} league`}>
      <polygon points="32,4 56,22 32,60 8,22" fill={mid} />
      <polygon points="32,4 56,22 32,22" fill={light} />
      <polygon points="32,4 8,22 32,22" fill={`hsl(${h} 80% 62%)`} />
      <polygon points="8,22 32,60 32,22" fill={dark} />
      <polygon points="56,22 32,60 32,22" fill={`hsl(${h} 72% 45%)`} />
      <polygon points="32,4 56,22 8,22" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

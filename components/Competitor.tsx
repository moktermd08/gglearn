import { SPECIES, hash } from "@/lib/bots";

type Props = {
  isBot: boolean;
  seed: string; // stable per competitor so the look never changes
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
};

/**
 * One face per competitor. People show their own photo when they chose to upload one, otherwise a
 * generated face (varied skin, hair, features). Bots get one of eight clearly non-human designs in their own colours.
 */
export function Competitor({ isBot, seed, name, photoUrl, size = 64, className = "" }: Props) {
  const box = { width: size, height: size };
  if (!isBot && photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- served by our own guarded route; sizes are tiny
    return <img src={photoUrl} alt={name} {...box} className={`rounded-full object-cover ring-2 ring-white/30 ${className}`} />;
  }
  return (
    <svg viewBox="0 0 100 100" {...box} className={className} role="img" aria-label={isBot ? `${name}, a bot` : name}>
      {isBot ? <Bot seed={seed} /> : <Person seed={seed} />}
    </svg>
  );
}

const SKIN = ["#f6d5b8", "#ebbb93", "#d29a6a", "#b57a4c", "#8a5632", "#5d3a22"];
const HAIR = ["#17110d", "#3a2718", "#6f4423", "#b98a4a", "#9b3b25", "#a8adb5"];
const SHIRT = [200, 152, 28, 280, 350, 45, 175, 320];

function Person({ seed }: { seed: string }) {
  const h = hash(seed), pick = <T,>(a: readonly T[], shift: number) => a[(h >>> shift) % a.length];
  const skin = pick(SKIN, 0), hair = pick(HAIR, 3), shirt = `hsl(${pick(SHIRT, 6)} 55% 45%)`;
  const style = (h >>> 9) % 6, eyes = (h >>> 12) % 3, mouth = (h >>> 14) % 3, glasses = (h >>> 16) % 4 === 0, brow = (h >>> 18) % 2;
  const wide = 1 + ((h >>> 20) % 3) * 0.04;
  return (
    <>
      <rect width="100" height="100" rx="50" fill={`hsl(${(h >>> 4) % 360} 35% 24%)`} />
      <clipPath id={`c${h}`}><circle cx="50" cy="50" r="50" /></clipPath>
      <g clipPath={`url(#c${h})`}>
        {/* back hair */}
        {style === 1 && <path d="M24 46 Q22 18 50 16 Q78 18 76 46 L80 84 L20 84Z" fill={hair} />}
        {style === 4 && <circle cx="50" cy="14" r="10" fill={hair} />}
        {/* shoulders and neck */}
        <path d="M8 100 Q10 74 36 70 L64 70 Q90 74 92 100Z" fill={shirt} />
        <rect x="42" y="58" width="16" height="16" rx="6" fill={skin} />
        {/* head */}
        <ellipse cx="29" cy="48" rx="4" ry="6" fill={skin} /><ellipse cx="71" cy="48" rx="4" ry="6" fill={skin} />
        <ellipse cx="50" cy="45" rx={21 * wide} ry="25" fill={skin} />
        {/* front hair */}
        {style === 0 && <path d="M29 42 Q28 18 50 18 Q72 18 71 42 Q62 28 50 30 Q38 28 29 42Z" fill={hair} />}
        {style === 1 && <path d="M28 44 Q30 20 50 20 Q70 20 72 44 Q60 30 50 31 Q40 30 28 44Z" fill={hair} />}
        {style === 2 && <path d="M30 40 Q34 24 50 24 Q66 24 70 40 Q62 34 50 34 Q38 34 30 40Z" fill={hair} opacity=".0" />}
        {style === 3 && <g fill={hair}>{[32, 41, 50, 59, 68].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 24 : 27} r="9" />)}</g>}
        {style === 4 && <path d="M29 42 Q29 20 50 20 Q71 20 71 42 Q60 30 50 31 Q40 30 29 42Z" fill={hair} />}
        {style === 5 && <path d="M28 46 Q26 16 52 18 Q74 20 72 44 Q66 28 46 30 Q34 32 28 46Z" fill={hair} />}
        {/* face */}
        {eyes === 0 && <><circle cx="41" cy="46" r="2.8" fill="#1c1917" /><circle cx="59" cy="46" r="2.8" fill="#1c1917" /></>}
        {eyes === 1 && <><ellipse cx="41" cy="46" rx="3.6" ry="2.2" fill="#1c1917" /><ellipse cx="59" cy="46" rx="3.6" ry="2.2" fill="#1c1917" /></>}
        {eyes === 2 && <><path d="M37 46 Q41 42 45 46" stroke="#1c1917" strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M55 46 Q59 42 63 46" stroke="#1c1917" strokeWidth="2.4" fill="none" strokeLinecap="round" /></>}
        <path d={brow ? "M36 39 L46 38 M54 38 L64 39" : "M36 38 Q41 35 46 38 M54 38 Q59 35 64 38"} stroke={hair} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M50 48 Q52 54 49 56" stroke="rgba(0,0,0,.25)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {mouth === 0 && <path d="M43 62 Q50 68 57 62" stroke="#7c2d12" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
        {mouth === 1 && <path d="M44 63 L56 63" stroke="#7c2d12" strokeWidth="2.4" strokeLinecap="round" />}
        {mouth === 2 && <path d="M42 61 Q50 72 58 61Z" fill="#7c2d12" />}
        {glasses && <g stroke="#111827" strokeWidth="1.8" fill="rgba(255,255,255,.12)"><circle cx="41" cy="46" r="7" /><circle cx="59" cy="46" r="7" /><path d="M48 46 L52 46" /></g>}
      </g>
    </>
  );
}

function Bot({ seed }: { seed: string }) {
  const h = hash(seed), hue = h % 360, hue2 = (hue + 40 + ((h >>> 8) % 80)) % 360;
  const body = `hsl(${hue} 70% 55%)`, dark = `hsl(${hue} 60% 30%)`, light = `hsl(${hue} 85% 80%)`, accent = `hsl(${hue2} 90% 62%)`;
  const species = SPECIES[(h >>> 4) % SPECIES.length];
  const eye = (cx: number, cy: number, r = 5) => <><circle cx={cx} cy={cy} r={r} fill="#fff" /><circle cx={cx} cy={cy} r={r * 0.5} fill="#0f172a" className="blink" /></>;
  return (
    <>
      <rect width="100" height="100" rx="50" fill={`hsl(${hue} 30% 18%)`} />
      <clipPath id={`b${h}`}><circle cx="50" cy="50" r="50" /></clipPath>
      <g clipPath={`url(#b${h})`}>
        {species === "boxbot" && <>
          <line x1="50" y1="22" x2="50" y2="10" stroke="#94a3b8" strokeWidth="3" /><circle cx="50" cy="9" r="4.5" fill={accent} />
          <rect x="24" y="24" width="52" height="50" rx="9" fill="#cbd5e1" stroke={dark} strokeWidth="2.5" />
          <rect x="31" y="36" width="38" height="18" rx="5" fill="#0f172a" /><circle cx="42" cy="45" r="4.5" fill={accent} className="blink" /><circle cx="58" cy="45" r="4.5" fill={accent} className="blink" />
          <rect x="38" y="62" width="24" height="4" rx="2" fill={dark} /><rect x="14" y="40" width="8" height="16" rx="3" fill={body} /><rect x="78" y="40" width="8" height="16" rx="3" fill={body} />
        </>}
        {species === "roundbot" && <>
          <circle cx="24" cy="24" r="6" fill={accent} /><circle cx="76" cy="24" r="6" fill={accent} /><path d="M26 28 L36 38M74 28 L64 38" stroke="#94a3b8" strokeWidth="3" />
          <circle cx="50" cy="54" r="30" fill={body} stroke={dark} strokeWidth="2.5" />
          <ellipse cx="50" cy="52" rx="22" ry="16" fill="#0f172a" /><circle cx="41" cy="52" r="5" fill={light} className="blink" /><circle cx="59" cy="52" r="5" fill={light} className="blink" />
          <path d="M42 64 Q50 70 58 64" stroke={light} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>}
        {species === "owl" && <>
          <path d="M24 26 L34 38 L24 44Z M76 26 L66 38 L76 44Z" fill={dark} />
          <ellipse cx="50" cy="56" rx="30" ry="32" fill={body} /><ellipse cx="50" cy="66" rx="18" ry="20" fill={light} opacity=".7" />
          {eye(38, 46, 10)}{eye(62, 46, 10)}<path d="M45 56 L50 66 L55 56Z" fill="#f59e0b" />
          <path d="M34 78 Q42 72 50 78 Q58 72 66 78" stroke={dark} strokeWidth="2" fill="none" />
        </>}
        {species === "fox" && <>
          <path d="M18 18 L40 38 L22 50Z M82 18 L60 38 L78 50Z" fill={body} stroke={dark} strokeWidth="2" /><path d="M24 26 L36 38 L26 44Z M76 26 L64 38 L74 44Z" fill={light} />
          <path d="M16 46 Q50 28 84 46 L66 82 Q50 94 34 82Z" fill={body} stroke={dark} strokeWidth="2.5" />
          <path d="M34 62 Q50 56 66 62 L58 82 Q50 88 42 82Z" fill="#fff" opacity=".9" />
          {eye(38, 52, 4.5)}{eye(62, 52, 4.5)}<ellipse cx="50" cy="72" rx="5" ry="3.6" fill="#0f172a" />
        </>}
        {species === "cat" && <>
          <path d="M20 14 L38 34 L18 46Z M80 14 L62 34 L82 46Z" fill={body} stroke={dark} strokeWidth="2" />
          <ellipse cx="50" cy="58" rx="32" ry="28" fill={body} stroke={dark} strokeWidth="2.5" />
          <ellipse cx="40" cy="52" rx="5" ry="6.5" fill="#fef9c3" /><ellipse cx="60" cy="52" rx="5" ry="6.5" fill="#fef9c3" />
          <ellipse cx="40" cy="52" rx="1.8" ry="5.5" fill="#0f172a" className="blink" /><ellipse cx="60" cy="52" rx="1.8" ry="5.5" fill="#0f172a" className="blink" />
          <path d="M47 63 L53 63 L50 67Z" fill={accent} /><path d="M14 62 L34 64 M14 70 L34 68 M86 62 L66 64 M86 70 L66 68" stroke={light} strokeWidth="1.6" />
        </>}
        {species === "alien" && <>
          <line x1="38" y1="24" x2="30" y2="8" stroke={dark} strokeWidth="2.5" /><line x1="62" y1="24" x2="70" y2="8" stroke={dark} strokeWidth="2.5" />
          <circle cx="30" cy="8" r="4" fill={accent} /><circle cx="70" cy="8" r="4" fill={accent} />
          <path d="M18 44 Q18 18 50 18 Q82 18 82 44 Q82 76 50 92 Q18 76 18 44Z" fill={body} stroke={dark} strokeWidth="2.5" />
          <ellipse cx="36" cy="50" rx="9" ry="13" fill="#0f172a" transform="rotate(-18 36 50)" /><ellipse cx="64" cy="50" rx="9" ry="13" fill="#0f172a" transform="rotate(18 64 50)" />
          <circle cx="38" cy="46" r="3" fill={light} className="blink" /><circle cx="62" cy="46" r="3" fill={light} className="blink" /><path d="M44 74 Q50 77 56 74" stroke={dark} strokeWidth="2" fill="none" />
        </>}
        {species === "ghost" && <>
          <path d="M22 88 L22 46 Q22 14 50 14 Q78 14 78 46 L78 88 L66 78 L58 88 L50 78 L42 88 L34 78Z" fill="#f1f5f9" stroke={dark} strokeWidth="2.5" />
          <ellipse cx="40" cy="44" rx="5" ry="7" fill={dark} className="blink" /><ellipse cx="60" cy="44" rx="5" ry="7" fill={dark} className="blink" />
          <ellipse cx="50" cy="60" rx="5" ry="6" fill={dark} opacity=".8" /><circle cx="32" cy="56" r="4.5" fill={accent} opacity=".5" /><circle cx="68" cy="56" r="4.5" fill={accent} opacity=".5" />
        </>}
        {species === "dragon" && <>
          <path d="M26 30 L18 8 L38 22Z M74 30 L82 8 L62 22Z" fill={accent} stroke={dark} strokeWidth="2" />
          <path d="M18 54 Q18 24 50 24 Q82 24 82 54 Q82 82 50 86 Q18 82 18 54Z" fill={body} stroke={dark} strokeWidth="2.5" />
          <ellipse cx="50" cy="68" rx="20" ry="13" fill={light} /><circle cx="43" cy="66" r="2.2" fill={dark} /><circle cx="57" cy="66" r="2.2" fill={dark} />
          {eye(36, 46, 5)}{eye(64, 46, 5)}<path d="M26 40 L34 36M74 40 L66 36" stroke={dark} strokeWidth="2.5" strokeLinecap="round" />
        </>}
      </g>
    </>
  );
}

/** Circular score / progress ring. */
export function Ring({ pct, size = 120, label, sub, color = "#38bdf8" }: { pct: number; size?: number; label: string; sub?: string; color?: string }) {
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(148,163,184,.2)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} className="ring-draw" style={{ ["--c" as string]: c }} />
      </svg>
      <div className="text-center leading-tight"><div className="text-2xl font-extrabold">{label}</div>{sub && <div className="text-[11px] text-slate-400">{sub}</div>}</div>
    </div>
  );
}

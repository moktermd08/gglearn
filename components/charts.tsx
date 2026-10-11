import { useId } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";

/**
 * Small, dependency-free SVG charts shared by every page. All server-renderable: no client JS, no network.
 * Colours are hex so they don't depend on the remapped Tailwind palette.
 */
type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export const PALETTE = { indigo: "#4f46e5", violet: "#9333ea", sky: "#0ea5e9", emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e", slate: "#94a3b8", pink: "#ec4899" };

/** Gradient banner that opens a page: icon tile, title, subtitle, and an actions slot. */
export function PageHero({ Icon, title, sub, tone = "indigo", children }: { Icon: Icon; title: string; sub?: ReactNode; tone?: keyof typeof PALETTE; children?: ReactNode }) {
  const c = PALETTE[tone];
  return (
    <header className="card pop relative overflow-hidden p-6" style={{ background: `linear-gradient(120deg, ${c}1f, #ffffff 55%)` }}>
      <svg className="pointer-events-none absolute -right-6 -top-10 h-56 w-56 opacity-70" viewBox="0 0 200 200" aria-hidden>
        <circle cx="130" cy="70" r="90" fill="none" stroke={c} strokeOpacity=".12" strokeWidth="1.5" />
        <circle cx="130" cy="70" r="62" fill="none" stroke={c} strokeOpacity=".16" strokeWidth="1.5" strokeDasharray="4 6" className="march" />
        <circle cx="130" cy="70" r="34" fill={c} fillOpacity=".08" />
      </svg>
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${c}, ${c}aa)`, boxShadow: `0 10px 24px -10px ${c}` }}><Icon size={28} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {sub && <p className="mt-0.5 max-w-2xl text-sm text-slate-400">{sub}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

/** Illustrated empty state, so a page with no data still looks designed. */
export function EmptyState({ Icon, title, children, tone = "indigo" }: { Icon: Icon; title: string; children?: ReactNode; tone?: keyof typeof PALETTE }) {
  const c = PALETTE[tone];
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center" style={{ background: `radial-gradient(circle at 50% 0%, ${c}14, #fff 65%)` }}>
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="aura absolute inset-0 rounded-full" style={{ background: `${c}18` }} />
        <span className="absolute inset-3 rounded-full border border-dashed" style={{ borderColor: `${c}66` }} />
        <Icon size={30} className="bob relative" style={{ color: c }} />
      </div>
      <div className="font-bold">{title}</div>
      {children && <div className="max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  );
}

/** Stat tile with an optional trend sparkline. */
export function StatTile({ Icon, label, value, color = PALETTE.sky, spark, i = 0 }: { Icon: Icon; label: string; value: ReactNode; color?: string; spark?: number[]; i?: number }) {
  return (
    <div className="card rise relative overflow-hidden p-4" style={{ "--i": i } as React.CSSProperties}>
      <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1a`, color }}><Icon size={20} /></div>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold leading-none">{value}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
        </div>
      </div>
      {spark && spark.length > 1 && <Sparkline data={spark} color={color} className="pointer-events-none absolute bottom-0 right-0 h-10 w-24 opacity-70" />}
    </div>
  );
}

export function Sparkline({ data, color = PALETTE.indigo, className = "" }: { data: number[]; color?: string; className?: string }) {
  const id = useId();
  const max = Math.max(1, ...data), step = 100 / (data.length - 1);
  const pts = data.map((v, i) => [i * step, 28 - (v / max) * 24] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L100 30 L0 30Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Area chart with gridlines and a few axis labels. */
export function AreaChart({ data, color = PALETTE.indigo, height = 160, unit = "" }: { data: { label: string; value: number }[]; color?: string; height?: number; unit?: string }) {
  const id = useId();
  const W = 600, H = 150, pl = 30, pb = 18, pt = 8;
  const max = Math.max(4, ...data.map((d) => d.value)), nice = Math.ceil(max / 4) * 4;
  const x = (i: number) => pl + (i / Math.max(1, data.length - 1)) * (W - pl - 6);
  const y = (v: number) => pt + (1 - v / nice) * (H - pt - pb);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const ticks = [0, nice / 2, nice];
  const labelAt = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ height }} className="w-full" role="img" aria-label="Chart">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity=".02" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}><line x1={pl} x2={W - 6} y1={y(t)} y2={y(t)} stroke="#14161f" strokeOpacity=".08" strokeDasharray="3 4" />
          <text x={pl - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#6f7788">{t}{unit}</text></g>
      ))}
      <path d={`${line} L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)}Z`} fill={`url(#${id})`} className="rise" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => d.value > 0 && <circle key={i} cx={x(i)} cy={y(d.value)} r="2.6" fill="#fff" stroke={color} strokeWidth="1.6"><title>{`${d.label}: ${d.value}${unit}`}</title></circle>)}
      {labelAt.map((i) => <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="9" fill="#6f7788">{data[i]?.label}</text>)}
    </svg>
  );
}

/** GitHub-style calendar heatmap. `days` is oldest to newest and should be a whole number of weeks, ending today. */
export function Heatmap({ days, color = PALETTE.emerald }: { days: { day: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const cell = 12, gap = 3;
  return (
    <svg viewBox={`0 0 ${weeks.length * (cell + gap)} ${7 * (cell + gap)}`} style={{ maxWidth: weeks.length * 20 }} className="w-full" role="img" aria-label="Activity over the last weeks">
      {weeks.map((w, wi) => w.map((d, di) => (
        <rect key={d.day} x={wi * (cell + gap)} y={di * (cell + gap)} width={cell} height={cell} rx="3"
          fill={d.value ? color : "#14161f"} fillOpacity={d.value ? 0.25 + 0.75 * (d.value / max) : 0.06}><title>{`${d.day}: ${d.value} XP`}</title></rect>
      )))}
    </svg>
  );
}

/** Donut with a centre label and a legend. */
export function Donut({ parts, size = 132, center, sub }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: ReactNode; sub?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 46, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="-rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#14161f" strokeOpacity=".07" strokeWidth="14" />
          {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
            const len = (p.value / total) * c, el = (
              <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-off} className="ring-draw" style={{ ["--c" as string]: c }}><title>{`${p.label}: ${p.value}`}</title></circle>);
            off += len; return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center leading-tight"><div><div className="text-2xl font-extrabold">{center ?? total.toLocaleString("en-GB")}</div>{sub && <div className="text-[10px] uppercase tracking-wider text-slate-400">{sub}</div>}</div></div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><span className="text-slate-300">{p.label}</span><b className="ml-1">{p.value.toLocaleString("en-GB")}</b>{total > 0 && <span className="text-xs text-slate-500">{Math.round((p.value / total) * 100)}%</span>}</li>
        ))}
      </ul>
    </div>
  );
}

/** Radar of 3+ axes, each 0..1. */
export function Radar({ axes, color = PALETTE.indigo, size = 240 }: { axes: { label: string; value: number }[]; color?: string; size?: number }) {
  const n = axes.length, cx = 110, cy = 105, R = 70;
  const pt = (i: number, f: number) => [cx + Math.sin((i / n) * 2 * Math.PI) * R * f, cy - Math.cos((i / n) * 2 * Math.PI) * R * f] as const;
  const ring = (f: number) => axes.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const shape = axes.map((a, i) => pt(i, Math.max(0.04, Math.min(1, a.value))).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox="0 0 220 210" width={size} height={size * 210 / 220} role="img" aria-label="Skill radar">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="#14161f" strokeOpacity=".1" />)}
      {axes.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="#14161f" strokeOpacity=".08" />)}
      <polygon points={shape} fill={color} fillOpacity=".22" stroke={color} strokeWidth="2" strokeLinejoin="round" className="rise" />
      {axes.map((a, i) => { const [x, y] = pt(i, 1.2), [px, py] = pt(i, Math.max(0.04, a.value)); return (
        <g key={a.label}><circle cx={px} cy={py} r="2.8" fill={color} /><text x={x} y={y + 3} textAnchor={x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle"} fontSize="9" fill="#5b6375">{a.label.length > 16 ? a.label.slice(0, 15) + "…" : a.label}</text></g>);
      })}
    </svg>
  );
}

/** One thick segmented bar with a legend: good for status splits. */
export function StackBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-black/5" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => <i key={p.label} className="grow block h-full" style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.label} <b className="text-slate-200">{p.value}</b></li>)}
      </ul>
    </div>
  );
}

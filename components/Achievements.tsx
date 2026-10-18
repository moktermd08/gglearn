import Link from "next/link";
import { ArrowRight, Flame, Lock, Snowflake, Sparkles } from "lucide-react";
import { MAX_PLAYER_LEVEL, type BadgeTier, type BadgeView, type Progression } from "@/lib/progression";

const TIER: Record<BadgeTier, { ring: string; bg: string; label: string }> = {
  bronze: { ring: "ring-orange-400/50", bg: "bg-orange-400/15", label: "Bronze" },
  silver: { ring: "ring-slate-400/60", bg: "bg-slate-400/15", label: "Silver" },
  gold: { ring: "ring-yellow-400/60", bg: "bg-yellow-400/20", label: "Gold" },
  legend: { ring: "ring-fuchsia-400/60", bg: "bg-fuchsia-400/15", label: "Legend" },
};
const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function PlayerLevelCard({ p, compact = false }: { p: Progression["player"]; compact?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[#fff] shadow-lg" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }} aria-label={`Player level ${p.level}`}>
        <div className="text-center leading-none"><div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Level</div><div className="text-2xl font-extrabold">{p.level}</div></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-lg font-extrabold">{p.title}</span><span className="inline-flex items-center gap-1 text-xs text-sky-300"><Sparkles size={12} />{p.xp.toLocaleString("en-GB")} XP</span></div>
        <div className="bar mt-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.pct * 100)} aria-label="Progress to the next player level"><i style={{ width: `${p.pct * 100}%` }} /></div>
        {!compact && <p className="mt-1 text-xs text-slate-400">{p.maxed ? `Level ${MAX_PLAYER_LEVEL}: the top of the ladder.` : `${(p.need - p.into).toLocaleString("en-GB")} XP to level ${p.level + 1}`}</p>}
      </div>
    </div>
  );
}

export function StreakCard({ s, freezes }: { s: Progression["streak"]; freezes?: number }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Flame size={34} className={s.current > 0 ? "pulse-glow text-orange-500" : "text-slate-400"} fill={s.current > 0 ? "#f97316" : "none"} />
        <div><div className="text-2xl font-extrabold leading-none">{s.current} <span className="text-sm font-bold text-slate-400">day{s.current === 1 ? "" : "s"}</span></div><div className="mt-0.5 text-xs text-slate-400">Longest: {s.longest}</div></div>
      </div>
      <div className="mt-3 flex gap-1.5" aria-label="Last 7 days">
        {s.week.map((d) => <span key={d.day} title={d.day} className={`grid h-7 flex-1 place-items-center rounded-lg text-[10px] font-bold ${d.frozen ? "bg-sky-500/20 text-sky-500" : d.active ? "bg-orange-500/20 text-orange-500" : "bg-black/[.05] text-slate-400"}`} aria-label={d.frozen ? `${d.day}, covered by a streak freeze` : d.day}>{new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}</span>)}
      </div>
      {freezes !== undefined && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-600" title="A streak freeze covers a day you miss, automatically. You get one for your first activity and another for every 7 days in a row. You can hold 2.">
          <Snowflake size={13} aria-hidden /><b>{freezes} streak freeze{freezes === 1 ? "" : "s"}</b>{freezes === 0 ? "Earn one with a 7-day streak." : "Ready to cover a missed day."}
        </p>
      )}
      <p className={`mt-2 text-xs ${s.atRisk ? "font-bold text-orange-500" : "text-slate-400"}`}>
        {s.atRisk ? `Do one quest or exam today to keep your ${s.current}-day streak alive.` : s.activeToday ? "Done for today. See you tomorrow." : "Do a quest or an exam today to start a streak."}
      </p>
    </div>
  );
}

export function BadgeTile({ b, fresh = false }: { b: BadgeView; fresh?: boolean }) {
  const t = TIER[b.tier];
  return (
    <div title={`${b.name}: ${b.desc}${b.earnedAt ? ` · earned ${date(b.earnedAt)}` : ""}`} className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl p-1 text-center ${b.earned ? `${fresh ? "pop " : ""}${t.bg} ring-1 ${t.ring}` : "bg-black/[.04] opacity-55 grayscale"}`}>
      {!b.earned && <Lock size={10} className="absolute right-1.5 top-1.5 text-slate-400" />}
      <div className="text-2xl" aria-hidden>{b.icon}</div>
      <div className="mt-0.5 px-0.5 text-[9px] font-bold leading-tight">{b.name}</div>
      <span className="sr-only">{b.earned ? "Earned" : `${Math.round(b.pct * 100)} percent`}: {b.desc}</span>
    </div>
  );
}

/** Compact badge wall: the badges you hold first, then the ones closest to done. */
export function BadgeWall({ p, max = 12 }: { p: Progression; max?: number }) {
  const sorted = [...p.badges].sort((a, b) => Number(b.earned) - Number(a.earned) || b.pct - a.pct);
  const next = p.badges.filter((x) => !x.earned).sort((a, b) => b.pct - a.pct)[0];
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">{sorted.slice(0, max).map((b) => <BadgeTile key={b.key} b={b} />)}</div>
      {next && <p className="mt-3 text-[11px] text-slate-400">Next: <b>{next.name}</b>, {next.desc.toLowerCase()} ({Math.min(next.value, next.target).toLocaleString("en-GB")}/{next.target.toLocaleString("en-GB")})</p>}
      <Link href="/achievements" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-300">All {p.badges.length} badges<ArrowRight size={12} /></Link>
    </div>
  );
}

export { TIER, date as badgeDate };

import Link from "next/link";
import { Activity as ActivityIcon, CalendarDays, ThumbsDown, ThumbsUp } from "lucide-react";
import type { PlanItem } from "@/lib/plan";
import type { Activity, Insight, Insights } from "@/lib/planInsights";

export type When = "all" | "today" | "week" | "month";
export const WHENS: { key: When; label: string }[] = [{ key: "all", label: "Everything" }, { key: "today", label: "Today" }, { key: "week", label: "This week" }, { key: "month", label: "This month" }];

function Pick({ Icon, title, tone, rows, empty }: { Icon: typeof ThumbsUp; title: string; tone: string; rows: Insight[]; empty: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-bold"><span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}><Icon size={14} /></span>{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-slate-400">{empty}</p> : (
        <ul className="space-y-1.5">{rows.map((r) => (
          <li key={r.title}><Link href={r.href} className="block rounded-xl border border-black/10 p-2.5 transition hover:bg-black/[.03]"><div className="truncate text-sm font-semibold">{r.title}</div><div className="text-[11px] text-slate-400">{r.detail}</div></Link></li>
        ))}</ul>
      )}
    </div>
  );
}

/** The one-line read of a plan, then where someone is strong and where the gaps are. */
export function StrengthsWeaknesses({ ins }: { ins: Insights }) {
  return (
    <section className="card space-y-4 p-5" aria-label="Strengths and weaknesses">
      <p className="text-sm font-semibold">{ins.summary || "Nothing here yet."}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Pick Icon={ThumbsUp} title="Key strengths" tone="bg-emerald-500/15 text-emerald-300" rows={ins.strengths} empty="Nothing yet. Pass your first level and your strengths show here." />
        <Pick Icon={ThumbsDown} title="Key weaknesses" tone="bg-amber-500/15 text-amber-300" rows={ins.weaknesses} empty="No gaps: everything is on the way or done." />
      </div>
    </section>
  );
}

function Mini({ i }: { i: PlanItem }) {
  return <li><Link href={i.href} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm transition hover:bg-black/[.03]"><span className="min-w-0 truncate font-semibold">{i.title}</span><span className="text-[11px] text-slate-400">{i.have} of {i.need} {i.unit} · {i.cadence}</span></Link></li>;
}

function Pace({ label, done, needed }: { label: string; done: number; needed: number | null }) {
  const pct = needed ? Math.min(100, (done / needed) * 100) : done > 0 ? 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-semibold">{done}{needed ? ` of about ${Math.ceil(needed)}` : ""}</span></div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: needed && done < needed * 0.5 ? "#f59e0b" : "#10b981" }} /></span>
    </div>
  );
}

/** Today, this week or this month, picked with a link so the page needs no client code. `base` is the plan the links keep. */
export function TimeTabs({ ins, when, base }: { ins: Insights; when: When; base: string }) {
  const href = (w: When) => `/plan?${base ? `${base}&` : ""}when=${w}`.replace(/when=all$/, "").replace(/[?&]$/, "");
  return (
    <section className="card space-y-4 p-5" aria-label="By time">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><CalendarDays size={17} /></span>When</h2>
        <nav aria-label="Time view" className="flex flex-wrap gap-1.5 text-xs">
          {WHENS.map((w) => <Link key={w.key} href={href(w.key)} className={`rounded-full border px-3 py-1 font-semibold ${when === w.key ? "border-sky-400 bg-sky-500/10 text-sky-300" : "border-black/10 text-slate-400"}`}>{w.label}</Link>)}
        </nav>
      </div>

      {when === "all" && <p className="text-sm text-slate-400">Pick Today, This week or This month to see just what falls in that time. The full plan is below.</p>}

      {when === "today" && (
        <div className="space-y-3">
          <p className="text-sm">{ins.today.studied ? <b className="text-emerald-300">You have studied today. Well done.</b> : <b className="text-amber-300">Nothing done yet today.</b>} <span className="text-slate-400">A quest or an exam keeps your streak alive.</span></p>
          {ins.today.items.length > 0 ? <><p className="text-xs text-slate-400">Do these first</p><ul className="space-y-1.5">{ins.today.items.map((i) => <Mini key={i.key} i={i} />)}</ul></> : <p className="text-sm text-slate-400">Nothing urgent in this plan.</p>}
        </div>
      )}

      {when === "week" && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Pace label="Levels passed in the last 7 days" done={ins.week.levels} needed={ins.week.levelsNeeded} />
            <Pace label="Days active in the last 7 days" done={ins.week.days.active} needed={ins.week.days.target} />
          </div>
          {ins.week.due.length > 0 ? <><p className="text-xs text-slate-400">Due this week, or already late</p><ul className="space-y-1.5">{ins.week.due.map((i) => <Mini key={i.key} i={i} />)}</ul></> : <p className="text-sm text-slate-400">Nothing due in the next 7 days.</p>}
        </div>
      )}

      {when === "month" && (
        <div className="space-y-3">
          <Pace label="Levels passed in the last 4 weeks" done={ins.month.levels} needed={ins.month.levelsNeeded} />
          {ins.month.due.length > 0 ? <><p className="text-xs text-slate-400">Due in the next 30 days, or already late</p><ul className="space-y-1.5">{ins.month.due.map((i) => <Mini key={i.key} i={i} />)}</ul></> : <p className="text-sm text-slate-400">Nothing due in the next 30 days.</p>}
        </div>
      )}
    </section>
  );
}

/** What was just done, newest first, so progress reads as a story and not only a count. */
export function RecentActivity({ rows }: { rows: Activity[] }) {
  return (
    <section className="card space-y-3 p-5" aria-label="Recent activity">
      <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><ActivityIcon size={17} /></span>What you have done lately <span className="text-xs font-normal text-slate-400">last 30 days</span></h2>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Nothing yet. Take an exam or log an item and it shows here.</p> : (
        <ul className="space-y-1.5">{rows.map((r, n) => (
          <li key={`${r.at}-${n}`}><Link href={r.href} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition hover:bg-black/[.03]"><span className="min-w-0 truncate">{r.text}</span><span className="text-[11px] text-slate-400">{r.ago}</span></Link></li>
        ))}</ul>
      )}
    </section>
  );
}

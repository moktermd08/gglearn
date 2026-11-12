import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { type Plan } from "@/lib/plan";

/** A short summary of the person's plan with the one thing to do first, linking to the full page. Takes a plan the page has already worked out. */
export function PlanGlance({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  const overdue = plan.items.filter((i) => i.status === "overdue").length, behind = plan.items.filter((i) => i.status === "behind").length;
  const first = plan.focus[0];
  const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
  return (
    <section aria-label="My plan" className={`card ${compact ? "p-4" : "p-5"} ${overdue ? "border-rose-400/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400"><ClipboardList size={17} /></span>My plan</h2>
        <Link href="/plan" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 underline">See everything <ArrowRight size={12} /></Link>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></span>
        <span className="shrink-0 text-xs text-slate-400">{plan.done} of {plan.total} done</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        {overdue > 0 && <b className="text-rose-300">{overdue} overdue. </b>}
        {behind > 0 && <b className="text-amber-300">{behind} behind. </b>}
        {plan.week.activeDays} of the last 7 days active (aim for {plan.week.target}).
      </p>
      {first && <p className="mt-2 text-sm">Do first: <Link href={first.href} className="font-semibold underline">{first.title}</Link> <span className="text-slate-400">· {first.cadence}</span></p>}
    </section>
  );
}

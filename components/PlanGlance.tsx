import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { type PlanSet, needsMost } from "@/lib/plan";

/** A short summary of all of a person's plans with the one thing to do first, linking to the full page. Takes plans the page has already worked out. */
export function PlanGlance({ set, compact = false }: { set: PlanSet; compact?: boolean }) {
  const plan = set.all, many = set.cards.length > 2;
  const overdue = plan.items.filter((i) => i.status === "overdue").length, behind = plan.items.filter((i) => i.status === "behind").length;
  const worst = needsMost(set.cards), first = worst?.plan.focus[0] ?? plan.focus[0];
  const pct = Math.round(plan.progress * 100);
  return (
    <section aria-label="My plan" className={`card ${compact ? "p-4" : "p-5"} ${overdue ? "border-rose-400/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400"><ClipboardList size={17} /></span>My plan{many ? "s" : ""}</h2>
        <Link href="/plan" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 underline">See everything <ArrowRight size={12} /></Link>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></span>
        <span className="shrink-0 text-xs text-slate-400">{pct}% complete{many ? ` across ${set.cards.length} plans` : ""}</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        {overdue > 0 && <b className="text-rose-300">{overdue} overdue. </b>}
        {behind > 0 && <b className="text-amber-300">{behind} behind. </b>}
        {plan.week.activeDays} of the last 7 days active (aim for {plan.week.target}).
      </p>
      {worst && many && <p className="mt-1 text-sm text-slate-400">Needs you most: <Link href={`/plan?plan=${worst.key}`} className="font-semibold text-slate-200 underline">{worst.name}</Link></p>}
      {!plan.goal && <p className="mt-1 text-sm text-slate-400">No career goal yet. <Link href="/goal" className="font-semibold text-slate-200 underline">Set one</Link> to get dates and a weekly pace.</p>}
      {first && <p className="mt-2 text-sm">Do first: <Link href={first.href} className="font-semibold underline">{first.title}</Link> <span className="text-slate-400">· {first.cadence}</span></p>}
    </section>
  );
}

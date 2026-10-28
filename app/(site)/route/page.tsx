import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Compass, Flag, TriangleAlert } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { TARGETS, assessmentFor, resolveAreas, resultsFor } from "@/lib/route";
import { dateAt } from "@/lib/roadmap";
import { routeSummary } from "@/lib/routePlan";
import { startedRoleTargets } from "@/lib/routeRole";
import { readiness } from "@/lib/routeScore";

export const metadata = { title: "My route — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS = {
  done: { text: "Every step is done", cls: "bg-emerald-500/15 text-emerald-300" },
  "on-track": { text: "On track", cls: "bg-emerald-500/15 text-emerald-300" },
  behind: { text: "A little behind", cls: "bg-amber-500/15 text-amber-300" },
  over: { text: "Timeframe ended", cls: "bg-rose-500/15 text-rose-300" },
} as const;

export default async function RouteIndex() {
  const me = await currentUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Compass} tone="emerald" title="My route into a new job" sub="Pick the job you are aiming for. We check where you stand, build a plan with dates, and keep track of how you are getting on." />
      <ul className="grid gap-4">
        {[...(me ? startedRoleTargets(me.id) : []), ...TARGETS].map((t) => {
          const s = me ? routeSummary(me, t) : null;
          const a = me ? assessmentFor(me.id, t.slug) : null;
          const head = (<><h2 className="text-lg font-extrabold">{t.title}</h2><p className="text-sm text-slate-400">{t.summary}</p></>);

          if (!s) return (
            <li key={t.slug} className="card space-y-3 p-5">{head}
              <p className="text-sm font-semibold">Not started</p>
              <Link href={`/route/${t.slug}`} className="btn w-fit">Check where I stand<ArrowRight size={16} /></Link>
            </li>
          );
          if (s.state === "checking") return (
            <li key={t.slug} className="card space-y-3 p-5">{head}
              <p className="text-sm font-semibold">Check in progress</p>
              <Link href={`/route/${t.slug}`} className="btn w-fit">Carry on<ArrowRight size={16} /></Link>
            </li>
          );
          if (s.state === "checked") {
            const pct = Math.round(readiness(resultsFor(a!, resolveAreas(t, me!)).filter((r) => r.placed !== null).map((r) => ({ key: r.key, placed: r.placed!, target: r.target }))) * 100);
            return (
              <li key={t.slug} className="card space-y-3 p-5">{head}
                <p className="text-sm font-semibold">Checked: {pct}% of the way there. Next, turn it into a plan with dates.</p>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/route/${t.slug}/plan`} className="btn"><CalendarClock size={16} />Build my plan<ArrowRight size={16} /></Link>
                  <Link href={`/route/${t.slug}`} className="btn btn-ghost">See my results</Link>
                </div>
              </li>
            );
          }

          const { view, progress: p } = s as Required<typeof s>;
          const st = STATUS[p.status];
          const readyWeek = view.plan.readyWeek;
          return (
            <li key={t.slug} className="card space-y-4 p-5">
              {head}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${st.cls}`}>{p.status === "behind" ? <TriangleAlert size={12} className="mr-1 inline" aria-hidden /> : <CheckCircle2 size={12} className="mr-1 inline" aria-hidden />}{st.text}</span>
                <span className="text-sm text-slate-400">{p.stepsDone} of {p.stepsTotal} steps done</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Your progress</span><span>{Math.round(p.doneShare * 100)}%</span></div>
                  <div className="bar" role="img" aria-label={`${Math.round(p.doneShare * 100)} percent of the plan done`}><i style={{ width: `${p.doneShare * 100}%` }} /></div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Time used, from {date(view.row.startsOn)}</span><span>Finish line {date(view.row.endsOn)}</span></div>
                  <div className="bar" role="img" aria-label={`${Math.round(p.timeShare * 100)} percent of your timeframe has passed`}><i style={{ width: `${p.timeShare * 100}%`, background: "#94a3b8" }} /></div>
                </div>
                {view.plan.items.length > 0 && <p className="text-xs text-slate-400">{view.weeksNow >= readyWeek ? "You have reached the point to start applying." : `Ready to apply from ${date(dateAt(view.row.startsOn, readyWeek))}.`}</p>}
              </div>
              {p.status === "behind" && (
                <p className="flex items-start gap-2 text-sm text-amber-300"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />You are about {Math.round(p.weeksLate)} weeks behind. That happens: open your plan to re-plan from today.</p>
              )}
              {p.status === "over" && <p className="text-sm text-amber-300">The finish line you chose has passed. Open your plan to choose a new timeframe.</p>}
              {p.focus.length > 0 && p.status !== "done" && (
                <section aria-label="This month" className="space-y-2">
                  <h3 className="font-extrabold">What to do now</h3>
                  <ul className="space-y-2">
                    {p.focus.map((i) => (
                      <li key={i.kind + i.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 p-3 text-sm">
                        <span className="min-w-0 flex-[1_1_14rem]"><b>{i.label}</b><span className="block text-xs text-slate-400">By {date(dateAt(view.row.startsOn, i.endWeek))} · about {Number.isInteger(i.hours) ? i.hours : i.hours.toFixed(1)} hours</span></span>
                        {i.kind === "learn"
                          ? <Link href={`/tracks/${i.trackSlug}`} className="inline-flex items-center gap-1 font-semibold text-indigo-300 underline"><BookOpen size={14} aria-hidden />Learn this</Link>
                          : <Link href={`/route/${t.slug}/plan`} className="inline-flex items-center gap-1 font-semibold text-indigo-300 underline"><Flag size={14} aria-hidden />Open the step</Link>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href={`/route/${t.slug}/plan`} className="btn"><CalendarClock size={16} />Open my plan<ArrowRight size={16} /></Link>
                <Link href={`/route/${t.slug}`} className="btn btn-ghost">Where I stand</Link>
              </div>
            </li>
          );
        })}
      </ul>
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Aiming for a different role or level?</h2>
        <p className="text-sm text-slate-400">Pick any role gglearn has a career ladder for, in any sector, and the level you want to reach. We check where you stand and plan the learning, step by step, with dates.</p>
        <Link href="/route/role" className="btn w-fit">Choose a role<ArrowRight size={16} /></Link>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, Circle, Flag, Info, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { assessmentFor, targetBySlug } from "@/lib/route";
import { dateAt } from "@/lib/roadmap";
import { planFor, viewPlan, type ItemState } from "@/lib/routePlan";
import { makePlan, replanRoute, toggleTask } from "../../actions";

export const metadata = { title: "My plan — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const hours = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
const monthsLabel = (n: number) => `${n} ${n === 1 ? "month" : "months"}`;

export default async function RoutePlan({ params }: { params: Promise<{ target: string }> }) {
  const me = await requireUser();
  const slug = (await params).target;
  const target = targetBySlug(slug);
  if (!target) notFound();
  const a = assessmentFor(me.id, slug);
  if (!a || a.status !== "complete") redirect(`/route/${slug}`);

  if (!planFor(a.id)) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={CalendarClock} tone="indigo" title="Your plan" sub={target.title} />
        <section className="card space-y-3 p-5">
          <p className="text-sm text-slate-300">We will turn what you found into a step-by-step plan: what to learn, in what order, with dates, to fit {a.horizonMonths} {a.horizonMonths === 1 ? "month" : "months"} at {a.hoursPerWeek} {a.hoursPerWeek === 1 ? "hour" : "hours"} a week.</p>
          <form action={makePlan.bind(null, slug)}><button className="btn"><CalendarClock size={16} />Build my plan<ArrowRight size={16} /></button></form>
        </section>
      </div>
    );
  }

  const v = viewPlan(me, target, a)!;
  const { plan, row } = v;
  const readyOn = dateAt(row.startsOn, plan.readyWeek);
  const stages = (target.stages ?? [{ n: 1, label: "Your plan", blurb: "" }]).map((s) => ({ ...s, items: v.items.filter((i) => i.stage === s.n) })).filter((s) => s.items.length);
  const orphan = v.items.filter((i) => !(target.stages ?? []).some((s) => s.n === i.stage));
  if (orphan.length && target.stages) stages.push({ n: 99, label: "Also", blurb: "", items: orphan });
  const doneCount = v.items.filter((i) => i.done).length;
  const tone = { comfortable: "text-emerald-300", tight: "text-amber-300", "too-tight": "text-rose-300" }[plan.verdict];

  const itemRow = (i: ItemState) => (
    <li key={i.kind + i.key} className="card space-y-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {i.kind === "learn"
            ? (i.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" aria-label="Done" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-400" aria-label="Not done yet" />)
            : null}
          <div className="min-w-0">
            <h4 className={`font-extrabold ${i.done ? "text-slate-400 line-through" : ""}`}>{i.label}</h4>
            <p className="text-xs text-slate-400">{date(dateAt(row.startsOn, i.startWeek))} to {date(dateAt(row.startsOn, i.endWeek))} · about {hours(i.hours)} {i.hours === 1 ? "hour" : "hours"}</p>
          </div>
        </div>
        {i.kind === "action" && (
          <form action={toggleTask.bind(null, slug, i.key, !i.done)}>
            <button className="btn btn-ghost !px-3 !py-1.5 text-sm" aria-pressed={i.done}>{i.done ? <><Check size={14} />Done. Undo</> : "Mark done"}</button>
          </form>
        )}
      </div>
      {i.kind === "action" && <p className="text-sm text-slate-400">{i.detail}</p>}
      {i.kind === "learn" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-slate-400">Level {i.current ?? i.fromLevel} now. Aim for level {i.toLevel}{i.toLevel < i.targetLevel ? ` (the job asks for ${i.targetLevel})` : ""}.</span>
          {!i.done && <Link href={`/tracks/${i.trackSlug}`} className="inline-flex items-center gap-1 font-semibold text-indigo-300 underline"><BookOpen size={14} aria-hidden />Learn this<ArrowRight size={14} aria-hidden /></Link>}
        </div>
      )}
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={CalendarClock} tone="indigo" title="Your plan" sub={`${target.title}: ${doneCount} of ${v.items.length} steps done`} />

      <section className="card grid gap-4 p-5 sm:grid-cols-3" aria-label="Key dates">
        <div><div className="text-xs uppercase tracking-widest text-slate-400">Started</div><div className="text-lg font-extrabold">{date(row.startsOn)}</div></div>
        <div><div className="text-xs uppercase tracking-widest text-slate-400">Ready to apply</div><div className="text-lg font-extrabold">{plan.items.length ? date(readyOn) : "Now"}</div></div>
        <div><div className="text-xs uppercase tracking-widest text-slate-400">Finish line</div><div className="text-lg font-extrabold">{date(row.endsOn)}</div></div>
      </section>

      <section className="card space-y-2 p-5" aria-label="Does it fit">
        {plan.verdict === "comfortable" && <p className={`flex items-start gap-2 font-semibold ${tone}`}><CheckCircle2 size={18} className="mt-0.5 shrink-0" />This fits your timeframe with room to spare.</p>}
        {plan.verdict === "tight" && <p className={`flex items-start gap-2 font-semibold ${tone}`}><TriangleAlert size={18} className="mt-0.5 shrink-0" />This fits, but with little room. Missing a few weeks will put you behind.</p>}
        {plan.verdict === "too-tight" && <p role="alert" className={`flex items-start gap-2 font-semibold ${tone}`}><TriangleAlert size={18} className="mt-0.5 shrink-0" />This timeframe is too short to learn everything at {plan.hoursPerWeek} {plan.hoursPerWeek === 1 ? "hour" : "hours"} a week. The plan keeps what matters most first.</p>}
        <p className="text-sm text-slate-400">
          {plan.items.length > 0 && <>About {hours(plan.plannedHours)} hours of work at {plan.hoursPerWeek} hours a week, leaving the last {Math.max(1, Math.round(plan.applyWeeks))} {Math.round(plan.applyWeeks) <= 1 ? "week" : "weeks"} for applying. </>}
          {plan.verdict === "comfortable" && plan.items.length > 0 && <>You could start applying from {date(readyOn)}.</>}
        </p>
        {plan.advice && (
          <p className="text-sm text-slate-300"><Info size={16} className="mr-1.5 inline text-sky-300" aria-hidden />To fit everything you could give yourself about {monthsLabel(plan.advice.months)} at {plan.hoursPerWeek} hours a week, or find about {plan.advice.hoursPerWeek} hours a week for the {monthsLabel(a.horizonMonths)} you chose. <Link href={`/route/${slug}?retake=1`} className="underline">Change my timeframe</Link></p>
        )}
      </section>

      {v.over && (
        <p role="alert" className="card flex items-start gap-2 p-4 text-sm text-amber-300"><TriangleAlert size={18} className="mt-0.5 shrink-0" />The finish line you chose has passed. <Link href={`/route/${slug}?retake=1`} className="underline">Choose a new timeframe</Link> to carry on.</p>
      )}
      {v.behind && !v.over && (
        <section role="alert" className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-amber-300">
          <span className="flex min-w-0 flex-[1_1_16rem] items-start gap-2"><TriangleAlert size={18} className="mt-0.5 shrink-0" />You are about {Math.round(v.weeksLate)} weeks behind. That happens. Re-plan from today and we will fit what is left before your finish line.</span>
          <form action={replanRoute.bind(null, slug)}><button className="btn"><RefreshCw size={16} />Re-plan from today</button></form>
        </section>
      )}

      {plan.doneActions.length > 0 && (
        <p className="text-sm text-slate-400"><Check size={14} className="mr-1 inline text-emerald-300" aria-hidden />Already done: {(target.actions ?? []).filter((x) => plan.doneActions.includes(x.key)).map((x) => x.label).join("; ")}.</p>
      )}

      {stages.map((s) => (
        <section key={s.n} className="space-y-3" aria-label={s.label}>
          <div>
            <h2 className="text-xl font-extrabold">{s.label}</h2>
            <p className="text-sm text-slate-400">{date(dateAt(row.startsOn, Math.min(...s.items.map((i) => i.startWeek))))} to {date(dateAt(row.startsOn, Math.max(...s.items.map((i) => i.endWeek))))}{s.blurb ? `. ${s.blurb}` : ""}</p>
          </div>
          <ul className="space-y-3">{s.items.map(itemRow)}</ul>
        </section>
      ))}

      {target.apply && (
        <section className="card space-y-1 p-5" aria-label={target.apply.label}>
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Flag size={18} className="text-indigo-300" aria-hidden />{target.apply.label}</h2>
          <p className="text-xs text-slate-400">{date(readyOn)} to {date(row.endsOn)}</p>
          <p className="text-sm text-slate-300">{target.apply.detail}</p>
          <p className="text-sm text-slate-400">Being ready means you can put in strong applications. Whether you are offered a job depends on the vacancies and the other people applying, so keep going after a no.</p>
        </section>
      )}

      {plan.deferred.length > 0 && (
        <section className="card space-y-2 p-5" aria-label="With more time">
          <h2 className="text-xl font-extrabold">With more time</h2>
          <p className="text-sm text-slate-400">These did not fit your timeframe. They are not dropped: add them when you can, or give yourself longer.</p>
          <ul className="space-y-1 text-sm">
            {plan.deferred.map((d) => (
              <li key={d.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>{d.label}{d.kind === "learn" ? `: ${d.levels} ${d.levels === 1 ? "level" : "levels"}, about ${hours(d.hours)} hours` : `: about ${hours(d.hours)} hours`}</span>
                {d.trackSlug && <Link href={`/tracks/${d.trackSlug}`} className="inline-flex items-center gap-1 font-semibold text-indigo-300 underline"><BookOpen size={14} aria-hidden />Learn this</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form action={replanRoute.bind(null, slug)}><button className="btn btn-ghost"><RefreshCw size={16} />Re-plan from today</button></form>
        <Link href={`/route/${slug}`} className="btn btn-ghost">Back to where I stand</Link>
        <Link href={`/route/${slug}?retake=1`} className="btn btn-ghost"><RotateCcw size={16} />Check again or change my timeframe</Link>
      </div>
    </div>
  );
}

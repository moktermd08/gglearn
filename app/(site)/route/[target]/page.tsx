import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, Compass, Info, RotateCcw, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { targetFor } from "@/lib/careerTarget";
import { PageHero } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { UNPAID, ROUTE_BATCH, areaRows, assessmentFor, batchQuestions, currentArea, resolveAreas, resultsFor } from "@/lib/route";
import { STATUS_LABEL, areaStatus, byGap, levelsToClimb, notes, readiness, type AreaStatus } from "@/lib/routeScore";
import { planFor } from "@/lib/routePlan";
import { answerRoute, skipRoute } from "../actions";
import RouteForm from "./form";

export const metadata = { title: "My route — gglearn" };

const BADGE: Record<AreaStatus, string> = {
  ready: "bg-emerald-500/15 text-emerald-300", nearly: "bg-sky-500/15 text-sky-300", building: "bg-amber-500/15 text-amber-300", start: "bg-rose-500/15 text-rose-300",
};

export default async function RouteTarget({ params, searchParams }: { params: Promise<{ target: string }>; searchParams: Promise<{ retake?: string }> }) {
  const me = await requireUser();
  const slug = (await params).target;
  const target = targetFor(slug, me);
  if (!target) notFound();
  const a = assessmentFor(me.id, slug);
  const retake = !!(await searchParams).retake;
  const areas = resolveAreas(target, me);

  if (!a || retake) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={Compass} tone="emerald" title={target.title} sub={target.summary} />
        <section className="card space-y-2 p-5 text-sm text-slate-300" aria-label="What happens next">
          <p>First a few questions about you, then a short check in each of {areas.filter((x) => x.available).length || target.areas.length} areas. It takes about 20 to 30 minutes and you can stop and carry on later. Skip any area you know nothing about: that is fine and gives you a clear starting point.</p>
        </section>
        <RouteForm slug={slug} unpaid={UNPAID} jobTitle={target.short} career={slug.startsWith("career~")} defaults={a ? { horizonMonths: a.horizonMonths, hoursPerWeek: a.hoursPerWeek, answers: a.answers } : null} />
      </div>
    );
  }

  const rows = areaRows(a.id);
  const checkable = areas.filter((x) => rows.some((r) => r.areaKey === x.key));

  if (a.status === "in_progress") {
    const cur = currentArea(areas, rows);
    const batch = cur?.row.pending?.length ? batchQuestions(cur.row.pending) : [];
    const doneCount = checkable.filter((x) => rows.find((r) => r.areaKey === x.key)?.placed !== null).length;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={Compass} tone="emerald" title="Checking where you stand" sub={`${target.title}: ${doneCount} of ${checkable.length} areas done. You can stop at any point and carry on later.`} />
        <ol className="card flex flex-wrap gap-2 p-4 text-sm" aria-label="Areas">
          {checkable.map((x) => {
            const placed = rows.find((r) => r.areaKey === x.key)?.placed;
            const now = cur?.area.key === x.key;
            return (
              <li key={x.key} className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${placed !== null && placed !== undefined ? "bg-emerald-500/15 text-emerald-300" : now ? "bg-indigo-500/15 font-semibold text-indigo-300" : "bg-black/[.06] text-slate-400"}`} aria-current={now ? "step" : undefined}>
                {placed !== null && placed !== undefined && <Check size={14} aria-hidden />}{x.label}
              </li>
            );
          })}
        </ol>
        {cur && batch.length > 0 ? (
          <>
            <div className="card space-y-1 p-4">
              <h2 className="text-xl font-extrabold">{cur.area.label}</h2>
              <p className="text-sm text-slate-400">{cur.area.why} Answer {ROUTE_BATCH} questions. Leave one blank if you do not know it: guessing can place you too high.</p>
            </div>
            <form action={answerRoute.bind(null, slug)} className="space-y-4">
              {batch.map((q, i) => (
                <fieldset key={q.id} className="card rise space-y-3 p-4" style={{ "--i": i } as React.CSSProperties}>
                  <legend className="sr-only">Question {i + 1}</legend>
                  <div className="whitespace-pre-line font-medium">{i + 1}. {q.prompt}</div>
                  {q.code && <pre tabIndex={0} aria-label="Code" className="overflow-x-auto rounded bg-black/5 p-2 text-sm">{q.code}</pre>}
                  <div className="grid gap-2">
                    {q.options?.map((o) => (
                      <label key={o.key} className="group flex cursor-pointer items-start gap-3 rounded-xl border-2 border-black/10 p-3 transition hover:border-black/30 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300">
                        <input type="radio" name={`q${q.id}`} value={o.key} className="sr-only" />
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[.06] font-mono text-sm font-bold transition group-has-[:checked]:bg-indigo-500 group-has-[:checked]:text-[#fff]">{o.key.toUpperCase()}</span>
                        <span className="pt-0.5">{o.text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn"><Check size={16} />Submit answers</button>
                <button formAction={skipRoute.bind(null, slug)} className="btn btn-ghost">I know nothing about this yet: skip it</button>
              </div>
            </form>
          </>
        ) : (
          <p role="alert" className="card flex items-start gap-2 p-4 text-amber-300"><TriangleAlert size={18} className="mt-0.5 shrink-0" />There is nothing to ask right now. <Link href={`/route/${slug}?retake=1`} className="underline">Start the check again</Link>.</p>
        )}
      </div>
    );
  }

  // complete
  const results = resultsFor(a, areas);
  const scored = results.filter((r): r is typeof r & { placed: number } => r.placed !== null);
  const pct = Math.round(readiness(scored.map((r) => ({ key: r.key, placed: r.placed, target: r.target }))) * 100);
  const ordered = byGap(scored.map((r) => ({ ...r })));
  const toClimb = levelsToClimb(scored.map((r) => ({ key: r.key, placed: r.placed, target: r.target })));
  const missing = results.filter((r) => r.placed === null);
  const observations = notes(a.answers);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Compass} tone="emerald" title="Where you stand today" sub={target.title} />
      <section className="card flex flex-wrap items-center gap-5 p-5" aria-label="Overall">
        <Ring pct={pct / 100} size={120} label={`${pct}%`} sub="of the way" color="#10b981" />
        <div className="min-w-0 flex-[1_1_16rem] space-y-1">
          <p className="text-lg font-extrabold">{toClimb === 0 ? "You meet the bar in every area we checked." : `${toClimb} ${toClimb === 1 ? "level" : "levels"} still to climb across ${ordered.filter((r) => r.placed < r.target).length} ${ordered.filter((r) => r.placed < r.target).length === 1 ? "area" : "areas"}.`}</p>
          <p className="text-sm text-slate-400">You gave yourself {a.horizonMonths} {a.horizonMonths === 1 ? "month" : "months"} at {a.hoursPerWeek} {a.hoursPerWeek === 1 ? "hour" : "hours"} a week. This shows where you are now, not what you can learn.</p>
        </div>
      </section>

      {observations.length > 0 && (
        <ul className="space-y-2" aria-label="Things to know">
          {observations.map((n) => (
            <li key={n.text} role={n.tone === "warn" ? "alert" : undefined} className={`card flex items-start gap-2 p-4 text-sm ${n.tone === "warn" ? "text-amber-300" : "text-slate-300"}`}>
              {n.tone === "warn" ? <TriangleAlert size={18} className="mt-0.5 shrink-0" /> : <Info size={18} className="mt-0.5 shrink-0 text-sky-300" />}{n.text}
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3" aria-label="Areas, biggest gap first">
        <h2 className="text-xl font-extrabold">What to learn first</h2>
        <ul className="space-y-3">
          {ordered.map((r) => {
            const st = areaStatus(r.placed, r.target);
            return (
              <li key={r.key} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold">{r.label}</h3>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${BADGE[st]}`}>{st === "ready" && <CheckCircle2 size={12} className="mr-1 inline" aria-hidden />}{STATUS_LABEL[st]}</span>
                </div>
                <p className="text-sm text-slate-400">{r.why}</p>
                <div className="bar" role="img" aria-label={`Level ${r.placed} of the ${r.target} this job asks for`}><i style={{ width: `${Math.min(100, (r.placed / r.target) * 100)}%` }} /></div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-400">Level {r.placed} of {r.target} needed</span>
                  {r.placed < r.target && <Link href={`/tracks/${r.trackSlug}`} className="inline-flex items-center gap-1 font-semibold text-indigo-300 underline"><BookOpen size={14} aria-hidden />Learn this<ArrowRight size={14} aria-hidden /></Link>}
                </div>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <p className="card p-4 text-sm text-slate-400"><Info size={16} className="mr-1.5 inline text-sky-300" aria-hidden />Not checked yet because the learning is not available here yet: {missing.map((m) => m.label).join(", ")}.</p>
        )}
        {scored.length === 0 && <p className="card p-4 text-sm text-slate-400">The learning for this job is not available on this site yet, so there is nothing to check.</p>}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/route/${slug}/plan`} className="btn"><CalendarClock size={16} />{planFor(a.id) ? "See my plan" : "Build my plan"}<ArrowRight size={16} /></Link>
        <Link href={`/route/${slug}?retake=1`} className="btn btn-ghost"><RotateCcw size={16} />Check again or change my timeframe</Link>
      </div>
    </div>
  );
}

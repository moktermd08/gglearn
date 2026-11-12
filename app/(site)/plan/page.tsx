import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, Flag, Flame, Plus, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { PlanItemForm } from "@/components/PlanItemForm";
import { PlanCreateForm } from "@/components/PlanCreateForm";
import { dateBounds, targetsFor } from "@/lib/journey";
import { MAX_PLANS } from "@/lib/planSets";
import { addMyItemAction, addMyPlanAction, logItemAction, removeItemAction, removePlanAction } from "./actions";
import { RecentActivity, StrengthsWeaknesses, TimeTabs, type When } from "@/components/PlanInsights";
import { insightsFor, recentActivityFor } from "@/lib/planInsights";
import { lateTracksOf, planSetFor, type PlanCard, type PlanItem, type PlanSource, type PlanStatus } from "@/lib/plan";

export const metadata = { title: "My plans — gglearn" };

const STATUS: Record<PlanStatus, { label: string; cls: string; bar: string }> = {
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-300", bar: "#10b981" },
  overdue: { label: "Overdue", cls: "bg-rose-500/15 text-rose-300", bar: "#f43f5e" },
  behind: { label: "Behind", cls: "bg-amber-500/15 text-amber-300", bar: "#f59e0b" },
  "on-track": { label: "On track", cls: "bg-emerald-500/15 text-emerald-300", bar: "#10b981" },
  open: { label: "To do", cls: "bg-sky-500/15 text-sky-300", bar: "#6366f1" },
};
const SOURCE: Record<PlanSource, string> = { required: "Required learning", goal: "Your career ladder and goal", doctor: "From the Career doctor", manual: "Set by your manager, and your own", habit: "Your habit" };
const ORDER: PlanSource[] = ["required", "goal", "doctor", "manual", "habit"];

/** The worst status in a plan, for its overview card. */
function cardStatus(c: PlanCard): { label: string; cls: string } {
  const n = (s: PlanStatus) => c.plan.items.filter((i) => i.status === s).length;
  if (n("overdue")) return { label: `${n("overdue")} overdue`, cls: STATUS.overdue.cls };
  if (n("behind")) return { label: `${n("behind")} behind`, cls: STATUS.behind.cls };
  if (c.plan.total === 0 || c.plan.items.every((i) => i.status === "done" || i.source === "habit") && c.plan.items.some((i) => i.source !== "habit")) return c.plan.total === 0 ? { label: "Empty", cls: "bg-black/5 text-slate-300" } : STATUS.done;
  return STATUS["on-track"];
}

function Row({ i }: { i: PlanItem }) {
  const s = STATUS[i.status];
  return (
    <li>
      <Link href={i.href} className="block rounded-2xl border border-black/10 p-3 transition hover:bg-black/[.03]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{i.title}</div>
            <div className="text-[11px] text-slate-400">{i.why}</div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${s.cls}`}>{s.label}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${i.need ? (i.have / i.need) * 100 : 0}%`, background: s.bar }} /></span>
          <span className="shrink-0 text-[11px] text-slate-400">{i.have} of {i.need} {i.unit}</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">{i.cadence}</div>
      </Link>
    </li>
  );
}

function ManualRow({ i }: { i: PlanItem }) {
  const s = STATUS[i.status], m = i.manual!;
  return (
    <li className="rounded-2xl border border-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><div className="truncate font-semibold">{i.title}</div><div className="text-[11px] text-slate-400">{i.why}</div></div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${s.cls}`}>{s.label}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${i.need ? (i.have / i.need) * 100 : 0}%`, background: s.bar }} /></span>
        <span className="shrink-0 text-[11px] text-slate-400">{i.have} of {i.need} {i.unit}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span>{i.cadence}</span>
        {i.status !== "done" && <form action={logItemAction}><input type="hidden" name="id" value={m.id} /><button className="btn !px-3 !py-1 text-xs">I did this</button></form>}
        {m.mine && <form action={removeItemAction}><input type="hidden" name="id" value={m.id} /><button className="underline">Remove</button></form>}
      </div>
    </li>
  );
}

export default async function Plan({ searchParams }: { searchParams: Promise<{ plan?: string; when?: string }> }) {
  const user = await requireUser();
  const { plan: wanted, when: whenRaw } = await searchParams;
  const set = planSetFor(user);
  const sel = set.cards.find((c) => c.key === wanted) ?? null; // no choice: the overview of every plan
  const all = set.all;
  const when: When = whenRaw === "today" || whenRaw === "week" || whenRaw === "month" ? whenRaw : "all";
  const ins = insightsFor(user, sel ? sel.plan : all, undefined, lateTracksOf(set.cards));
  const recent = recentActivityFor(user);
  const base = sel ? `plan=${sel.key}` : "";
  const extras = set.cards.filter((c) => c.kind === "extra").length;
  const pct = all.progress;
  const g = (sel ?? set.cards[1]).plan.goal;
  const targets = targetsFor(user), { tomorrow } = dateBounds();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={ClipboardList} tone="indigo" title={sel ? sel.name : "My plans"} sub={sel ? sel.blurb : "Everything you have to do across your plans, how often, and how you are doing. It updates itself from your exams and activity."} />

      {/* the plans, side by side: always shown, so switching is one tap */}
      <nav aria-label="Plans" className="flex flex-wrap gap-2 text-sm">
        <Link href="/plan" className={`rounded-full border px-3 py-1 font-semibold ${!sel ? "border-indigo-400 bg-indigo-500/10 text-indigo-300" : "border-black/10 text-slate-400"}`}>All plans</Link>
        {set.cards.map((c) => <Link key={c.key} href={`/plan?plan=${c.key}`} className={`rounded-full border px-3 py-1 font-semibold ${sel?.key === c.key ? "border-indigo-400 bg-indigo-500/10 text-indigo-300" : "border-black/10 text-slate-400"}`}>{c.name}</Link>)}
      </nav>

      {!sel && (
        <>
          <section className="card flex flex-wrap items-center gap-5 p-5" aria-label="Overall">
            <Ring pct={pct} label={`${Math.round(pct * 100)}%`} sub="complete" size={104} color="#6366f1" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-lg font-bold">{all.done} of {all.total} things finished across {set.cards.length} plans</p>
              <p className="text-xs text-slate-400">The ring counts partial progress, so 3 of 5 levels is 60% of that item. A subject that is in two plans counts once.</p>
              <p className="flex items-center gap-1 text-xs text-slate-400"><Flame size={13} />{all.week.activeDays} of the last 7 days active (aim for {all.week.target})</p>
            </div>
          </section>

          <StrengthsWeaknesses ins={ins} />
          <TimeTabs ins={ins} when={when} base={base} />

          <section aria-label="Every plan" className="grid gap-3 sm:grid-cols-2">
            {set.cards.map((c) => {
              const st = cardStatus(c), p = c.plan, first = p.focus[0], done = p.progress;
              return (
                <Link key={c.key} href={`/plan?plan=${c.key}`} className="card block space-y-2 p-4 transition hover:border-indigo-400/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="truncate font-bold">{c.name}</div><div className="truncate text-[11px] text-slate-400">{c.blurb}</div></div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full bg-indigo-500" style={{ width: `${done * 100}%` }} /></span>
                    <span className="shrink-0 text-xs text-slate-400">{p.done} of {p.total}</span>
                  </div>
                  {first ? <p className="truncate text-xs text-slate-400">Do first: <b className="text-slate-300">{first.title}</b> · {first.cadence}</p> : <p className="text-xs text-slate-400">{p.total ? "Nothing left to do." : "Nothing in it yet."}</p>}
                </Link>
              );
            })}
          </section>

          <RecentActivity rows={recent} />

          <section className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400"><Plus size={17} /></span>Start another plan <span className="text-xs font-normal text-slate-400">{extras} of {MAX_PLANS}</span></h2>
            {extras >= MAX_PLANS
              ? <p className="text-sm text-slate-400">That is the most plans you can have. Remove one to make room.</p>
              : <PlanCreateForm action={addMyPlanAction} targets={targets} tomorrow={tomorrow} />}
          </section>
        </>
      )}

      {sel && (
        <>
          <section className="card flex flex-wrap items-center gap-5 p-5" aria-label="This plan">
            <Ring pct={sel.plan.progress} label={`${Math.round(sel.plan.progress * 100)}%`} sub="complete" size={104} color="#6366f1" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-lg font-bold">{sel.plan.done} of {sel.plan.total} things finished</p>
              {g && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1"><Flag size={13} />{g.title}</span>
                  {g.targetDate && <span className="inline-flex items-center gap-1"><CalendarCheck size={13} />by {new Date(g.targetDate * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                </p>
              )}
              {g && g.perWeekNeeded > 0 && <p className="text-xs text-slate-400">To stay on this date you need about <b className="text-slate-300">{g.perWeekNeeded.toFixed(1)}</b> level{g.perWeekNeeded === 1 ? "" : "s"} a week. Over the last four weeks you passed <b className="text-slate-300">{g.perWeekNow.toFixed(1)}</b> a week.</p>}
              {!g && sel.kind === "main" && <p className="text-xs text-slate-400">No goal yet, so these come from the Career doctor and have no dates.</p>}
              {!g && sel.kind === "main" && <Link href="/goal" className="btn mt-1 inline-flex">Set my career goal<ArrowRight size={15} /></Link>}
            </div>
          </section>

          <StrengthsWeaknesses ins={ins} />
          <TimeTabs ins={ins} when={when} base={base} />

          {when === "all" && sel.plan.focus.length > 0 && (
            <section className="card space-y-3 p-5" aria-label="Focus">
              <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Target size={17} /></span>Focus first</h2>
              <ul className="space-y-2">{sel.plan.focus.map((i) => (i.manual ? <ManualRow key={i.key} i={i} /> : <Row key={i.key} i={i} />))}</ul>
            </section>
          )}

          {ORDER.map((src) => {
            const rows = sel.plan.items.filter((i) => i.source === src);
            if (!rows.length || when !== "all") return null;
            const done = rows.filter((i) => i.status === "done").length;
            return (
              <section key={src} className="card space-y-3 p-5" aria-label={SOURCE[src]}>
                <h2 className="flex items-center justify-between gap-2 text-lg font-bold">
                  <span className="flex items-center gap-2.5">{rows.some((i) => i.status === "overdue") ? <AlertTriangle size={17} className="text-rose-400" /> : done === rows.length ? <CheckCircle2 size={17} className="text-emerald-400" /> : <ArrowRight size={17} className="text-indigo-400" />}{SOURCE[src]}</span>
                  <span className="text-xs font-normal text-slate-400">{done} of {rows.length} done</span>
                </h2>
                <ul className="space-y-2">{rows.map((i) => (i.manual ? <ManualRow key={i.key} i={i} /> : <Row key={i.key} i={i} />))}</ul>
              </section>
            );
          })}

          <RecentActivity rows={recent} />

          {sel.kind !== "required" && (
            <section className="card space-y-3 p-5">
              <h2 className="text-lg font-bold">Add something to {sel.name}</h2>
              <p className="text-sm text-slate-400">For things the app cannot measure itself, like shadowing a release or a monthly 1:1.</p>
              <PlanItemForm action={addMyItemAction} hidden={{ planId: sel.kind === "main" ? "main" : sel.id! }} />
            </section>
          )}
          {sel.kind === "required" && <p className="text-xs text-slate-500">Required learning is set by your company and cannot be edited here. Anything else you want to track goes in your <Link href="/plan?plan=main" className="underline">main plan</Link> or <Link href="/plan" className="underline">another plan</Link>.</p>}

          {sel.kind === "extra" && sel.mine && (
            <form action={removePlanAction} className="text-sm"><input type="hidden" name="id" value={sel.id!} /><button className="text-slate-400 underline">Remove this plan and its own items</button></form>
          )}
        </>
      )}
    </div>
  );
}

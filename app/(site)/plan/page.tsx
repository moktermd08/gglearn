import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, Flag, Flame, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { PlanItemForm } from "@/components/PlanItemForm";
import { addMyItemAction, logItemAction, removeItemAction } from "./actions";
import { planFor, type PlanItem, type PlanSource, type PlanStatus } from "@/lib/plan";

export const metadata = { title: "My plan — gglearn" };

const STATUS: Record<PlanStatus, { label: string; cls: string; bar: string }> = {
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-300", bar: "#10b981" },
  overdue: { label: "Overdue", cls: "bg-rose-500/15 text-rose-300", bar: "#f43f5e" },
  behind: { label: "Behind", cls: "bg-amber-500/15 text-amber-300", bar: "#f59e0b" },
  "on-track": { label: "On track", cls: "bg-emerald-500/15 text-emerald-300", bar: "#10b981" },
  open: { label: "To do", cls: "bg-sky-500/15 text-sky-300", bar: "#6366f1" },
};
const SOURCE: Record<PlanSource, string> = { required: "Required learning", goal: "Your career ladder and goal", doctor: "From the Career doctor", manual: "Set by your manager, and your own", habit: "Your habit" };
const ORDER: PlanSource[] = ["required", "goal", "doctor", "manual", "habit"];

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

export default async function Plan() {
  const user = await requireUser();
  const p = planFor(user);
  const pct = p.total ? p.done / p.total : 0;
  const g = p.goal;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={ClipboardList} tone="indigo" title="My plan" sub="Everything you have to do, how often, and how you are doing. It updates itself from your exams and activity." />

      <section className="card flex flex-wrap items-center gap-5 p-5" aria-label="Overall">
        <Ring pct={pct} label={`${Math.round(pct * 100)}%`} sub="done" size={104} color="#6366f1" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-lg font-bold">{p.done} of {p.total} things done</p>
          {g && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1"><Flag size={13} />{g.title}</span>
              {g.targetDate && <span className="inline-flex items-center gap-1"><CalendarCheck size={13} />by {new Date(g.targetDate * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
            </p>
          )}
          {g && g.perWeekNeeded > 0 && <p className="text-xs text-slate-400">To stay on your goal date you need about <b className="text-slate-300">{g.perWeekNeeded.toFixed(1)}</b> level{g.perWeekNeeded === 1 ? "" : "s"} a week. Over the last four weeks you passed <b className="text-slate-300">{g.perWeekNow.toFixed(1)}</b> a week.</p>}
          {!g && <p className="text-xs text-slate-400">You have no goal set. <Link href="/goal" className="underline">Set one</Link> and this plan gets dates and a weekly pace.</p>}
          <p className="flex items-center gap-1 text-xs text-slate-400"><Flame size={13} />{p.week.activeDays} of the last 7 days active (aim for {p.week.target})</p>
        </div>
      </section>

      {p.focus.length > 0 && (
        <section className="card space-y-3 p-5" aria-label="Focus">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Target size={17} /></span>Focus first</h2>
          <ul className="space-y-2">{p.focus.map((i) => <Row key={i.key} i={i} />)}</ul>
        </section>
      )}

      {ORDER.map((src) => {
        const rows = p.items.filter((i) => i.source === src);
        if (!rows.length && src !== "manual") return null;
        const done = rows.filter((i) => i.status === "done").length;
        return (
          <section key={src} className="card space-y-3 p-5" aria-label={SOURCE[src]}>
            <h2 className="flex items-center justify-between gap-2 text-lg font-bold">
              <span className="flex items-center gap-2.5">{rows.some((i) => i.status === "overdue") ? <AlertTriangle size={17} className="text-rose-400" /> : done === rows.length ? <CheckCircle2 size={17} className="text-emerald-400" /> : <ArrowRight size={17} className="text-indigo-400" />}{SOURCE[src]}</span>
              <span className="text-xs font-normal text-slate-400">{done} of {rows.length} done</span>
            </h2>
            {src === "manual" && rows.length === 0 && <p className="text-sm text-slate-400">Nothing here yet. Add something the app cannot measure itself, like shadowing a release or a monthly 1:1.</p>}
            <ul className="space-y-2">{rows.map((i) => (i.manual ? <ManualRow key={i.key} i={i} /> : <Row key={i.key} i={i} />))}</ul>
            {src === "manual" && <details className="text-sm"><summary className="cursor-pointer text-sky-300 underline">Add one of your own</summary><div className="mt-3"><PlanItemForm action={addMyItemAction} /></div></details>}
          </section>
        );
      })}
    </div>
  );
}

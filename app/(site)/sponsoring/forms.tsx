"use client";
import { useActionState, useTransition } from "react";
import { Check, Link2, UserMinus } from "lucide-react";
import { ShareBar } from "@/components/ShareBar";
import { becomeSponsor, makeGoalLink, stopSponsoring, type SponsorState } from "./actions";

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";

export function GoalForm({ topics }: { topics: { id: number; name: string }[] }) {
  const [state, run, pending] = useActionState<SponsorState, FormData>(makeGoalLink, null);
  return (
    <div className="space-y-3">
      <form action={run} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="block min-w-48 flex-1 font-semibold">Topic
          <select name="trackId" required defaultValue="" className={`${input} mt-1 font-normal`}><option value="" disabled>Choose a topic…</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="block font-semibold">Reach level<input name="level" type="number" min={1} max={20} defaultValue={5} className={`${input} mt-1 w-24 font-normal`} /></label>
        <button disabled={pending} className="btn disabled:opacity-50"><Link2 size={16} />{pending ? "Making it…" : "Get a link to share"}</button>
        {state?.error && <p role="alert" className="w-full text-rose-500">{state.error}</p>}
      </form>
      {state?.link && (<div className="space-y-2">
        <label className="block text-sm text-slate-400">Share this with someone who would back you<input readOnly value={state.link} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
        <ShareBar url={state.link} text="Will you back me on gglearn? Press one button and you will see when I reach my goal." />
      </div>)}
    </div>
  );
}

export function BackButton({ code }: { code: string }) {
  const [state, run, pending] = useActionState<SponsorState, FormData>(async () => becomeSponsor(code), null);
  return (
    <form action={run} className="space-y-2">
      <button disabled={pending} className="btn disabled:opacity-50"><Check size={16} />{pending ? "One moment…" : "Yes, back this goal"}</button>
      {state?.error && <p role="alert" className="text-sm text-rose-500">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function StopSponsor({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await stopSponsoring(id); })} className="inline-flex items-center gap-1 text-xs text-slate-400 underline disabled:opacity-50"><UserMinus size={12} />Stop</button>;
}

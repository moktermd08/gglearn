"use client";
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from "react";
import type { SetupState } from "@/lib/setup";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

/** Add a plan item: what, how many, once or every week, and an optional date. Used by a person for themself and by a manager for someone they run. */
export function PlanItemForm({ action, hidden, button = "Add to my plan", plans }: {
  action: (prev: SetupState, fd: FormData) => Promise<SetupState>; hidden?: Record<string, string | number>; button?: string;
  /** when given, a "Which plan" choice: the main plan and these */
  plans?: { id: string; name: string }[];
}) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.done) ref.current?.reset(); }, [state]);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); };
  return (
    <form ref={ref} onSubmit={submit} className="grid gap-3 text-sm">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {plans && <label className="grid gap-1">Which plan<select name="planId" defaultValue="main" className={input}>{plans.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
      <label className="grid gap-1">What<input name="title" required maxLength={120} placeholder="e.g. Shadow a production release" className={input} /></label>
      <label className="grid gap-1">Note (optional)<input name="note" maxLength={400} placeholder="Why it matters, or what good looks like" className={input} /></label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">How often
          <select name="period" defaultValue="once" className={input}><option value="once">In total</option><option value="weekly">Every week</option></select>
        </label>
        <label className="grid gap-1">How many<input name="need" type="number" min={1} max={20} defaultValue={1} className={`${input} w-20`} /></label>
        <label className="grid gap-1">By (once only)<input name="due" type="date" className={input} /></label>
        <button className="btn">{button}</button>
      </div>
      {state?.error && <p role="alert" className="text-rose-300">{state.error}</p>}
      {state?.done && <p role="status" className="text-emerald-300">{state.done}</p>}
    </form>
  );
}

"use client";
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from "react";
import type { SetupState } from "@/lib/setup";
import type { Target } from "@/lib/journey";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

/** Make a plan: a name, and optionally a role, level and date to aim for (its progress is then worked out like the main goal's). */
export function PlanCreateForm({ action, targets, hidden, button = "Create plan", tomorrow }: {
  action: (prev: SetupState, fd: FormData) => Promise<SetupState>; targets: Target[]; hidden?: Record<string, string | number>; button?: string;
  /** the earliest date, yyyy-mm-dd */
  tomorrow: string;
}) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.done) ref.current?.reset(); }, [state]);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); };
  return (
    <form ref={ref} onSubmit={submit} className="grid gap-3 text-sm">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="grid gap-1">Name<input name="name" required maxLength={60} placeholder="e.g. Move into data engineering" className={input} /></label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Aim for a role (optional)
          <select name="target" defaultValue="" className={`${input} min-w-56`}>
            <option value="">No target, just a list</option>
            {targets.map((t) => <optgroup key={t.role} label={t.label}>{t.levels.map((l) => <option key={l.level} value={`${t.role}|${l.level}`}>{l.title}</option>)}</optgroup>)}
          </select>
        </label>
        <label className="grid gap-1">by<input name="date" type="date" min={tomorrow} className={input} /></label>
        <button className="btn">{button}</button>
      </div>
      {state?.error && <p role="alert" className="text-rose-300">{state.error}</p>}
      {state?.done && <p role="status" className="text-emerald-300">{state.done}</p>}
    </form>
  );
}

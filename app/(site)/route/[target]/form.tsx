"use client";
import { startTransition, useActionState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { saveRoute, type RouteState } from "../actions";
import { HORIZON_MAX, HORIZON_MIN, HOURS_MAX, HOURS_MIN } from "@/lib/routeScore";
import type { RouteAnswers } from "@/lib/db/schema";

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";
const EDUCATION = [["none", "No formal qualifications"], ["school", "School qualifications (GCSEs or similar)"], ["college", "College, A levels or an apprenticeship"], ["degree", "A degree or higher"]] as const;
const PAID = [["none", "None"], ["some", "A little, or a long time ago"], ["lots", "Quite a lot"]] as const;
const RIGHTS = [["yes", "Yes"], ["unsure", "I am not sure"], ["no", "No"]] as const;
const SCALE = ["1 Not confident", "2", "3", "4", "5 Very confident"];

export default function RouteForm({ slug, unpaid, defaults, jobTitle, rightToWork }: { slug: string; rightToWork: { ask: string; why: string } | null; unpaid: { key: string; label: string }[]; defaults: { horizonMonths: number; hoursPerWeek: number; answers: RouteAnswers } | null; jobTitle: string }) {
  const [state, run, pending] = useActionState<RouteState, FormData>(saveRoute.bind(null, slug), null);
  const d = defaults?.answers;
  const radios = (name: string, options: readonly (readonly [string, string])[], current?: string) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(([v, label]) => (
        <label key={v} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-black/10 p-3 transition hover:border-black/30 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300">
          <input type="radio" name={name} value={v} required defaultChecked={current === v} className="h-4 w-4" />{label}
        </label>
      ))}
    </div>
  );
  const scale = (name: string, current?: number) => (
    <div className="grid grid-cols-5 gap-2 text-center text-sm">
      {SCALE.map((label, i) => (
        <label key={label} className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-black/10 p-2 transition hover:border-black/30 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300">
          <input type="radio" name={name} value={i + 1} required defaultChecked={current === i + 1} className="h-4 w-4" /><span>{label}</span>
        </label>
      ))}
    </div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="space-y-6">
      <fieldset className="card space-y-3 p-5">
        <legend className="text-lg font-extrabold">How long do you want to give yourself?</legend>
        <p className="text-sm text-slate-400">Pick the time that fits your life. It can be a month or several years. You can change it later.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">Months until you want to be ready to apply
            <input name="horizonMonths" type="number" inputMode="numeric" min={HORIZON_MIN} max={HORIZON_MAX} required defaultValue={defaults?.horizonMonths ?? 9} className={input} />
            <span className="block text-xs font-normal text-slate-400">{HORIZON_MIN} to {HORIZON_MAX} months</span>
          </label>
          <label className="space-y-1 text-sm font-semibold">Hours a week you can set aside
            <input name="hoursPerWeek" type="number" inputMode="numeric" min={HOURS_MIN} max={HOURS_MAX} required defaultValue={defaults?.hoursPerWeek ?? 6} className={input} />
            <span className="block text-xs font-normal text-slate-400">Be realistic: {HOURS_MIN} to {HOURS_MAX} hours</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="card space-y-3 p-5"><legend className="text-lg font-extrabold">Your education</legend>{radios("education", EDUCATION, d?.education)}</fieldset>

      <fieldset className="card space-y-3 p-5"><legend className="text-lg font-extrabold">Paid work you have done</legend>
        {radios("paidWork", PAID, d?.paidWork)}
        <label className="block space-y-1 text-sm font-semibold">Years since you last had a paid job (0 if you are working now)
          <input name="yearsOut" type="number" inputMode="numeric" min={0} max={50} required defaultValue={d?.yearsOut ?? 0} className={`${input} sm:max-w-40`} />
        </label>
      </fieldset>

      <fieldset className="card space-y-3 p-5"><legend className="text-lg font-extrabold">Unpaid experience</legend>
        <p className="text-sm text-slate-400">Tick anything that applies. This counts as real evidence when you apply.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {unpaid.map((u) => (
            <label key={u.key} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-black/10 p-3 transition hover:border-black/30 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300">
              <input type="checkbox" name="unpaid" value={u.key} defaultChecked={d?.unpaid.includes(u.key)} className="h-4 w-4" />{u.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="card space-y-3 p-5"><legend className="text-lg font-extrabold">How confident are you using a computer?</legend>{scale("digital", d?.digital)}</fieldset>
      <fieldset className="card space-y-3 p-5"><legend className="text-lg font-extrabold">How confident are you writing about yourself?</legend>{scale("writing", d?.writing)}</fieldset>

      {rightToWork && (
        <fieldset className="card space-y-3 p-5"><legend className="text-lg font-extrabold">{rightToWork.ask}</legend>
          <p className="text-sm text-slate-400">{rightToWork.why}</p>
          {radios("workRights", RIGHTS, d?.workRights)}
        </fieldset>
      )}

      {state?.error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      <button disabled={pending} className="btn !py-3 text-base disabled:opacity-50">{pending ? "One moment…" : <>Check where I stand for {jobTitle}<ArrowRight size={16} /></>}</button>
    </form>
  );
}

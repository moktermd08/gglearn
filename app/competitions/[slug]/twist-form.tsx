"use client";
import { startTransition, useActionState } from "react";
import { Shuffle, TriangleAlert } from "lucide-react";
import { declineTwistAction, submitTwistAction, type TwistState } from "../actions";

type Props = {
  twistId: number; level: number; attemptsLeft: number; note: string;
  base: { prompt: string; code: string | null; options: { key: string; text: string }[]; answer: string };
  limits: { promptMax: number; optionMax: number; codeMax: number };
};

/** The drawn racer's editor: the original question, pre-filled, to reword or to pass on. */
export default function TwistForm({ twistId, level, attemptsLeft, note, base, limits }: Props) {
  const [state, run, pending] = useActionState<TwistState, FormData>(submitTwistAction.bind(null, twistId), null);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2 text-sm";
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="space-y-3">
        <div><label className="block text-sm font-semibold" htmlFor={`p${twistId}`}>Question</label>
          <textarea id={`p${twistId}`} name="prompt" required rows={3} maxLength={limits.promptMax} defaultValue={base.prompt} className={input} /></div>
        {base.code !== null && (
          <div><label className="block text-sm font-semibold" htmlFor={`c${twistId}`}>Code (optional)</label>
            <textarea id={`c${twistId}`} name="code" rows={4} maxLength={limits.codeMax} defaultValue={base.code} className={`${input} font-mono`} /></div>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Options, and which one is correct</legend>
          {base.options.map((o) => (
            <div key={o.key} className="flex items-center gap-2">
              <input type="radio" name="answer" value={o.key} defaultChecked={o.key === base.answer} required aria-label={`Option ${o.key.toUpperCase()} is correct`} />
              <span className="w-5 font-mono font-bold">{o.key.toUpperCase()}</span>
              <input name="option" required maxLength={limits.optionMax} defaultValue={o.text} aria-label={`Option ${o.key.toUpperCase()}`} className={input} />
            </div>
          ))}
        </fieldset>
        <p className="text-xs text-slate-400">Same subject, same number of options, exactly one right answer, no links. Make it harder through knowledge, not through tricks in the wording.
          {attemptsLeft < 3 && ` ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`}</p>
        {(state?.error || note) && !state?.message && <p role="alert" className="flex items-start gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{state?.error ?? `Last referee note: ${note}`}</p>}
        {state?.message && <p role="status" className="text-sm text-emerald-300">{state.message}</p>}
        <button disabled={pending || !!state?.message} className="btn disabled:opacity-50">{pending ? "Checking with the referee…" : <>Send my twist for level {level}<Shuffle size={16} /></>}</button>
      </form>
      <form action={declineTwistAction.bind(null, twistId)}><button className="text-sm text-slate-400 underline">Pass: keep level {level} as it is</button></form>
    </div>
  );
}

"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { TasterField } from "@/lib/careerTaster";
import { submitTaster } from "../actions";

export default function Form({ fields }: { fields: TasterField[] }) {
  const [state, action, pending] = useActionState(submitTaster, null);

  if (state?.results) {
    const placed = state.results.filter((r) => r.placed);
    return (
      <div className="space-y-4">
        <section className="card space-y-3 p-5" aria-live="polite">
          <h2 className="text-xl font-bold">{placed.length ? `${placed.length} of ${state.results.length} fields look promising` : "No field cleared the bar this time"}</h2>
          <ul className="space-y-2">
            {state.results.map((r) => (
              <li key={r.name} className="flex items-center gap-3 text-sm">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${r.placed ? "bg-emerald-500/20 text-emerald-700" : "bg-black/5 text-slate-500"}`}>{r.placed ? <Check size={15} /> : <X size={15} />}</span>
                <span className="font-semibold">{r.family}</span><span className="text-slate-600">{r.name}: {r.right} of {r.of}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">A missed field is not a verdict: three questions is a small sample. The ones you cleared now count in your reading.</p>
        </section>
        <Link href="/doctor" className="btn btn-primary inline-block">See my Career doctor</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {fields.map((f) => (
        <section key={f.trackId} className="card space-y-4 p-5">
          <input type="hidden" name="field" value={`${f.trackId}|${f.questions.map((q) => q.id).join(",")}|${f.family}|${f.name}`} />
          <h2 className="text-lg font-bold">{f.family}<span className="ml-2 text-sm font-normal text-slate-500">{f.name}</span></h2>
          {f.questions.map((q, n) => (
            <fieldset key={q.id} className="space-y-2">
              <legend className="text-sm font-semibold">{n + 1}. {q.prompt}</legend>
              {q.code && <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 text-xs"><code>{q.code}</code></pre>}
              {q.options.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-black/10 p-2 text-sm hover:border-black/30">
                  <input type="radio" name={`q${q.id}`} value={o.key} className="mt-0.5" />
                  <span>{o.text}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </section>
      ))}
      {state?.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Marking…" : "Mark my taster"}</button>
    </form>
  );
}

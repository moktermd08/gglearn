"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Flag, Lightbulb, ListChecks, PenLine, Tag } from "lucide-react";
import { Avatar } from "@/components/Avatar";

export type QuizQ = { id: number; prompt: string; code?: string | null; type: "mcq" | "open" | "scenario"; options?: { key: string; text: string }[] | null; topic?: string | null };

const KIND = {
  mcq: { label: "Multiple choice", Icon: ListChecks, cls: "bg-sky-500/15 text-sky-300" },
  open: { label: "Written answer", Icon: PenLine, cls: "bg-violet-500/15 text-violet-300" },
  scenario: { label: "Scenario", Icon: Lightbulb, cls: "bg-amber-500/15 text-amber-300" },
} as const;

/** One question at a time with a progress bar. Answers are posted together; grading stays on the server. */
export function Quiz({ questions, action, level, rivalHue, rivalName }: {
  questions: QuizQ[]; action: (fd: FormData) => void | Promise<void>; level: number; rivalHue: number; rivalName: string;
}) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, string>>({});
  const q = questions[i], last = i === questions.length - 1;
  const done = (id: number) => !!ans[id]?.trim();
  const answered = questions.filter((x) => done(x.id)).length;
  const kind = KIND[q.type];
  return (
    <form action={action} className="mx-auto max-w-2xl space-y-5">
      {questions.map((x) => <input key={x.id} type="hidden" name={`q${x.id}`} value={ans[x.id] ?? ""} />)}
      <div className="flex items-center gap-3">
        <Avatar kind="human" level={level} size={44} />
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-400"><span>Question {i + 1} of {questions.length}</span><span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" />{answered} answered</span></div>
          <div className="bar mt-1"><i style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
        </div>
        <Avatar kind="rival" level={level} hue={rivalHue} size={44} className="opacity-70" />
      </div>

      <nav aria-label="Question navigator" className="flex flex-wrap justify-center gap-1.5">
        {questions.map((x, n) => (
          <button type="button" key={x.id} onClick={() => setI(n)} aria-label={`Go to question ${n + 1}`} aria-current={n === i}
            className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition ${n === i ? "scale-110 bg-indigo-500 text-[#fff] ring-2 ring-indigo-300/60" : done(x.id) ? "bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40" : "bg-white/10 text-slate-400 hover:bg-white/20"}`}>
            {done(x.id) && n !== i ? <Check size={14} /> : n + 1}
          </button>
        ))}
      </nav>
      <p className="text-center text-xs text-slate-500">{rivalName} is watching. No pressure.</p>

      <div key={q.id} className="card slide-in space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${kind.cls}`}><kind.Icon size={13} />{kind.label}</span>
          {q.topic && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-slate-300"><Tag size={12} />{q.topic}</span>}
        </div>
        <div className="text-lg font-semibold">{q.prompt}</div>
        {q.code && <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 text-sm text-emerald-200">{q.code}</pre>}
        {q.type === "mcq" ? (
          <div className="grid gap-2">
            {q.options?.map((o, n) => {
              const on = ans[q.id] === o.key;
              return (
                <button type="button" key={o.key} onClick={() => setAns({ ...ans, [q.id]: o.key })} style={{ "--i": n } as React.CSSProperties}
                  className={`rise flex items-start gap-3 rounded-xl border p-3 text-left transition ${on ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 hover:border-white/30 hover:bg-white/5"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold transition ${on ? "bg-indigo-500 text-[#fff]" : "bg-white/10"}`}>{o.key.toUpperCase()}</span>
                  <span className="flex-1">{o.text}</span>
                  {on && <Check size={18} className="spin-in mt-0.5 shrink-0 text-indigo-300" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <textarea rows={5} maxLength={4000} value={ans[q.id] ?? ""} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })}
              placeholder="Write your answer" className="w-full rounded-xl border border-white/15 bg-[#fff] p-3 focus:border-indigo-400 focus:outline-none" />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>Graded against the reference answer.</span>
              <span>{(ans[q.id] ?? "").length} / 4000</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="btn btn-ghost disabled:opacity-30"><ArrowLeft size={16} />Back</button>
        {last ? <button className="btn">Submit exam <Flag size={16} /></button> : <button type="button" onClick={() => setI(i + 1)} className="btn">Next<ArrowRight size={16} /></button>}
      </div>
    </form>
  );
}

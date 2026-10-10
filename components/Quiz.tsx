"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";

export type QuizQ = { id: number; prompt: string; code?: string | null; type: "mcq" | "open" | "scenario"; options?: { key: string; text: string }[] | null };

/** One question at a time with a progress bar. Answers are posted together; grading stays on the server. */
export function Quiz({ questions, action, level, rivalHue, rivalName }: {
  questions: QuizQ[]; action: (fd: FormData) => void | Promise<void>; level: number; rivalHue: number; rivalName: string;
}) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<number, string>>({});
  const q = questions[i], last = i === questions.length - 1;
  const answered = Object.values(ans).filter((v) => v.trim()).length;
  return (
    <form action={action} className="mx-auto max-w-2xl space-y-5">
      {questions.map((x) => <input key={x.id} type="hidden" name={`q${x.id}`} value={ans[x.id] ?? ""} />)}
      <div className="flex items-center gap-3">
        <Avatar kind="human" level={level} size={44} />
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-400"><span>Question {i + 1} of {questions.length}</span><span>{answered} answered</span></div>
          <div className="bar mt-1"><i style={{ width: `${((i + 1) / questions.length) * 100}%` }} /></div>
        </div>
        <Avatar kind="rival" level={level} hue={rivalHue} size={44} className="opacity-70" />
      </div>
      <p className="text-center text-xs text-slate-500">{rivalName} is watching. No pressure.</p>

      <div key={q.id} className="card slide-in space-y-4 p-6">
        <div className="text-lg font-semibold">{q.prompt}</div>
        {q.code && <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-sm text-emerald-200">{q.code}</pre>}
        {q.type === "mcq" ? (
          <div className="grid gap-2">
            {q.options?.map((o) => {
              const on = ans[q.id] === o.key;
              return (
                <button type="button" key={o.key} onClick={() => setAns({ ...ans, [q.id]: o.key })}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${on ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 hover:border-white/30 hover:bg-white/5"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${on ? "bg-indigo-500 text-white" : "bg-white/10"}`}>{o.key.toUpperCase()}</span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <textarea rows={5} maxLength={4000} value={ans[q.id] ?? ""} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })}
            placeholder="Write your answer" className="w-full rounded-xl border border-white/15 bg-black/30 p-3" />
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="btn btn-ghost disabled:opacity-30">← Back</button>
        {last ? <button className="btn">Submit exam 🏁</button> : <button type="button" onClick={() => setI(i + 1)} className="btn">Next →</button>}
      </div>
    </form>
  );
}

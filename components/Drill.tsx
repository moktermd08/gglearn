"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { drillCheck, finishDrill } from "@/app/actions";
import { Confetti } from "@/components/Confetti";
import type { QuizQ } from "@/components/Quiz";

/** Five instant-feedback questions: pick, see right/wrong at once, move on. */
export function Drill({ trackId, back, questions }: { trackId: number; back: string; questions: QuizQ[] }) {
  const [i, setI] = useState(0), [score, setScore] = useState(0), [res, setRes] = useState<{ key: string; correct: boolean; answer: string; hint: string | null } | null>(null);
  const [xp, setXp] = useState<number | null>(null), [pending, start] = useTransition();
  if (xp !== null || i >= questions.length) {
    return (
      <div className="card pop mx-auto max-w-md space-y-3 p-8 text-center">
        <Confetti count={score >= 4 ? 80 : 30} />
        <div className="text-5xl">{score >= 4 ? "🔥" : "💪"}</div>
        <h1 className="text-2xl font-extrabold">{score} / {questions.length} correct</h1>
        <p className="text-slate-300">{xp ? `+${xp} XP added to your quest log.` : "Drill quest already done today."}</p>
        <Link href={back} className="btn">Back to the climb</Link>
      </div>
    );
  }
  const q = questions[i];
  const pick = (key: string) => { if (res || pending) return; start(async () => { const r = await drillCheck(q.id, key); if (!r) return; setRes({ key, ...r }); if (r.correct) setScore((s) => s + 1); }); };
  const next = () => {
    if (i === questions.length - 1) start(async () => { setXp(await finishDrill(trackId)); });
    else { setRes(null); setI(i + 1); }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-400"><span>⚡ Quick drill</span><span>{i + 1}/{questions.length} · {score} correct</span></div>
      <div className="bar"><i style={{ width: `${(i / questions.length) * 100}%` }} /></div>
      <div key={q.id} className="card slide-in space-y-4 p-6">
        <div className="text-lg font-semibold">{q.prompt}</div>
        {q.code && <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-sm text-emerald-200">{q.code}</pre>}
        <div className="grid gap-2">
          {q.options?.map((o) => {
            const chosen = res?.key === o.key, right = res && o.key === res.answer;
            return (
              <button key={o.key} onClick={() => pick(o.key)} disabled={!!res}
                className={`rounded-xl border p-3 text-left transition ${right ? "border-emerald-400 bg-emerald-500/20" : chosen ? "border-rose-400 bg-rose-500/20" : "border-white/10 hover:bg-white/5"}`}>
                <span className="mr-2 font-mono font-bold">{o.key.toUpperCase()}</span>{o.text} {right && "✅"}{chosen && !right && "❌"}
              </button>
            );
          })}
        </div>
        {res && (
          <div className="slide-in space-y-2">
            <p className={`font-bold ${res.correct ? "text-emerald-300" : "text-rose-300"}`}>{res.correct ? "Correct! +1" : "Not quite."} {res.hint && !res.correct && <span className="font-normal text-slate-300">Hint: {res.hint}</span>}</p>
            <button onClick={next} className="btn">{i === questions.length - 1 ? "Finish" : "Next"} →</button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Flame, Lightbulb, Sparkles, Tag, X, Zap } from "lucide-react";
import { drillCheck, finishDrill } from "@/app/actions";
import { Confetti } from "@/components/Confetti";
import { Ring } from "@/components/Ring";
import type { QuizQ } from "@/components/Quiz";

/** Five instant-feedback questions: pick, see right/wrong at once, move on. */
export function Drill({ trackId, back, questions }: { trackId: number; back: string; questions: QuizQ[] }) {
  const [i, setI] = useState(0), [results, setResults] = useState<boolean[]>([]), [res, setRes] = useState<{ key: string; correct: boolean; answer: string; hint: string | null } | null>(null);
  const [xp, setXp] = useState<number | null>(null), [pending, start] = useTransition();
  const score = results.filter(Boolean).length;
  const streak = (() => { let s = 0; for (let n = results.length - 1; n >= 0 && results[n]; n--) s++; return s; })();
  const dots = (
    <div className="flex justify-center gap-2" aria-label="Drill results">
      {questions.map((_, n) => {
        const r = results[n];
        return (
          <span key={n} className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${r === undefined ? (n === i ? "bg-indigo-500/30 ring-2 ring-indigo-400" : "bg-white/10 text-slate-500") : r ? "pop bg-emerald-500 text-white" : "pop bg-rose-500 text-white"}`}>
            {r === undefined ? n + 1 : r ? <Check size={14} /> : <X size={14} />}
          </span>
        );
      })}
    </div>
  );
  if (xp !== null || i >= questions.length) {
    const pct = questions.length ? score / questions.length : 0;
    return (
      <div className="card pop mx-auto max-w-md space-y-4 p-8 text-center">
        <Confetti count={score >= 4 ? 80 : 30} />
        <Ring pct={pct} label={`${score}/${questions.length}`} sub="correct" size={140} color={pct >= 0.8 ? "#34d399" : pct >= 0.5 ? "#fbbf24" : "#fb7185"} />
        {dots}
        <h1 className="flex items-center justify-center gap-2 text-2xl font-extrabold">{score >= 4 ? <><Flame className="text-orange-400" />On fire!</> : <><Zap className="text-amber-300" />Keep climbing</>}</h1>
        <p className="flex items-center justify-center gap-1.5 text-slate-300"><Sparkles size={16} className="text-amber-300" />{xp ? `+${xp} XP added to your quest log.` : "Drill quest already done today."}</p>
        <Link href={back} className="btn">Back to the climb<ArrowRight size={16} /></Link>
      </div>
    );
  }
  const q = questions[i];
  const pick = (key: string) => { if (res || pending) return; start(async () => { const r = await drillCheck(q.id, key); if (!r) return; setRes({ key, ...r }); setResults((x) => [...x, r.correct]); }); };
  const next = () => {
    if (i === questions.length - 1) start(async () => { setXp(await finishDrill(trackId)); });
    else { setRes(null); setI(i + 1); }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span className="flex items-center gap-1.5 font-semibold text-amber-300"><Zap size={16} />Quick drill</span>
        <span className="flex items-center gap-3">
          {streak >= 2 && <span className="pop flex items-center gap-1 font-bold text-orange-400"><Flame size={15} />{streak} streak</span>}
          <span>{i + 1}/{questions.length} · {score} correct</span>
        </span>
      </div>
      <div className="bar"><i style={{ width: `${(results.length / questions.length) * 100}%` }} /></div>
      {dots}
      <div key={q.id} className={`card slide-in space-y-4 p-6 ${res && !res.correct ? "shake" : ""}`}>
        {q.topic && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300"><Tag size={12} />{q.topic}</span>}
        <div className="text-lg font-semibold">{q.prompt}</div>
        {q.code && <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-sm text-emerald-200">{q.code}</pre>}
        <div className="grid gap-2">
          {q.options?.map((o) => {
            const chosen = res?.key === o.key, right = res && o.key === res.answer;
            return (
              <button key={o.key} onClick={() => pick(o.key)} disabled={!!res}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${right ? "ping-once border-emerald-400 bg-emerald-500/20" : chosen ? "border-rose-400 bg-rose-500/20" : res ? "border-white/5 opacity-50" : "border-white/10 hover:bg-white/5"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${right ? "bg-emerald-500 text-white" : chosen ? "bg-rose-500 text-white" : "bg-white/10"}`}>{o.key.toUpperCase()}</span>
                <span className="flex-1">{o.text}</span>
                {right && <Check size={20} className="spin-in text-emerald-300" />}
                {chosen && !right && <X size={20} className="spin-in text-rose-300" />}
              </button>
            );
          })}
        </div>
        {res && (
          <div className="slide-in space-y-3">
            <p className={`flex items-center gap-2 font-bold ${res.correct ? "text-emerald-300" : "text-rose-300"}`}>
              {res.correct ? <><Check size={18} />Correct! +1</> : <><X size={18} />Not quite.</>}
            </p>
            {res.hint && !res.correct && <p className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-slate-200"><Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-300" /><span>{res.hint}</span></p>}
            <button onClick={next} className="btn">{i === questions.length - 1 ? "Finish" : "Next"}<ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

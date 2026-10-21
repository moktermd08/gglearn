"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Flame, Loader2, RotateCcw, Rocket, Trophy, X } from "lucide-react";
import { Confetti } from "@/components/Confetti";
import { checkTrialAnswer, finishTrialAction } from "../actions";

type Q = { id: number; prompt: string; code: string | null; options: { key: string; text: string }[] };
type Result = { picked: string; correct: boolean; answer: string };

export default function Runner({ slug, topic, questions, signedIn }: { slug: string; topic: string; questions: Q[]; signedIn: boolean }) {
  const [i, setI] = useState(0), [results, setResults] = useState<Result[]>([]), [err, setErr] = useState<string | null>(null);
  const [earned, setEarned] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const q = questions[i], shown = results[i], done = results.length === questions.length && i >= questions.length;
  const score = results.filter((r) => r.correct).length;

  const pick = (key: string) => {
    if (shown || pending) return;
    setErr(null);
    start(async () => {
      const r = await checkTrialAnswer(q.id, key);
      if ("error" in r) { setErr(r.error); return; }
      setResults((all) => { const next = [...all]; next[i] = { picked: key, correct: r.correct, answer: r.answer }; return next; });
    });
  };

  if (done) {
    const line = score === questions.length ? "Perfect. You clearly know this." : score >= 2 ? "Nicely done." : "A good start: this is exactly what the levels are for.";
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {score >= 2 && <Confetti count={50} />}
        <div className="card pop space-y-4 p-8 text-center" style={{ background: "linear-gradient(135deg, rgba(251,191,36,.2), #fff 70%)" }}>
          <Trophy size={40} className="mx-auto text-amber-500" />
          <h1 className="text-3xl font-extrabold">{score} out of {questions.length}</h1>
          <p className="text-slate-300">{line} That was level 1 of 20 in {topic}.</p>
          <div className="flex justify-center gap-1.5">{results.map((r, n) => <span key={n} className={`grid h-8 w-8 place-items-center rounded-full ${r.correct ? "bg-emerald-500/20 text-emerald-600" : "bg-rose-500/20 text-rose-600"}`}>{r.correct ? <Check size={16} /> : <X size={16} />}</span>)}</div>
          {signedIn ? (
            <div className="space-y-3">
              {earned !== null && <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-bold text-emerald-700"><Flame size={15} />{earned > 0 ? `+${earned} XP and your streak has started` : "Today's quick drill on this topic was already counted"}</p>}
              <p className="text-sm text-slate-400">{earned ? `You are enrolled in ${topic}. Your next step is waiting on your dashboard.` : `Carry on in ${topic}.`}</p>
              <div className="flex flex-wrap justify-center gap-2"><Link href={`/tracks/${slug}`} className="btn">Keep going in {topic}<ArrowRight size={16} /></Link><Link href="/dashboard" className="btn btn-ghost">My path</Link></div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">Make a free account and you start on {topic} straight away: your rival is waiting, and so is a certificate at level 5.</p>
              <Link href={`/signup?try=${slug}&next=${encodeURIComponent(`/tracks/${slug}`)}`} className="btn !px-8 !py-3 text-base"><Rocket size={18} />Keep going: create a free account</Link>
            </div>
          )}
          <div><Link href="/try" className="inline-flex items-center gap-1 text-sm text-slate-400 underline"><RotateCcw size={13} />Try a different topic</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between text-sm"><span className="font-bold">{topic}</span><span className="text-slate-400">Question {i + 1} of {questions.length}</span></div>
      <div className="flex gap-1.5" aria-hidden>{questions.map((_, n) => <i key={n} className={`h-1.5 flex-1 rounded-full ${n < results.length ? (results[n].correct ? "bg-emerald-500" : "bg-rose-500") : n === i ? "bg-indigo-400" : "bg-black/10"}`} />)}</div>
      <div className="card space-y-4 p-5">
        <p className="text-lg font-semibold">{q.prompt}</p>
        {q.code && <pre tabIndex={0} aria-label="Code" className="overflow-x-auto rounded bg-black/5 p-3 text-sm">{q.code}</pre>}
        <div className="grid gap-2">
          {q.options.map((o) => {
            const right = shown && o.key.toLowerCase() === shown.answer.toLowerCase(), wrong = shown && shown.picked === o.key && !shown.correct;
            return (
              <button key={o.key} type="button" disabled={!!shown || pending} onClick={() => pick(o.key)}
                className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition disabled:cursor-default ${right ? "border-emerald-400 bg-emerald-500/10" : wrong ? "border-rose-300 bg-rose-500/10" : "border-black/10 hover:border-black/30"}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[.06] font-mono text-sm font-bold">{o.key.toUpperCase()}</span>
                <span className="flex-1 pt-0.5">{o.text}</span>
                {right && <Check size={18} className="shrink-0 text-emerald-600" />}{wrong && <X size={18} className="shrink-0 text-rose-500" />}
              </button>);
          })}
        </div>
        {pending && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" />Checking…</p>}
        {err && <p role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700">{err} <Link href="/signup" className="font-semibold underline">Create a free account</Link></p>}
        {shown && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`font-bold ${shown.correct ? "text-emerald-600" : "text-rose-500"}`}>{shown.correct ? "Right!" : `Not quite. The answer was ${shown.answer.toUpperCase()}.`}</p>
            <button type="button" className="btn" onClick={() => { const last = i + 1 >= questions.length; setI(i + 1); if (last && signedIn) start(async () => { const r = await finishTrialAction(slug); setEarned(r?.xp ?? 0); }); }}>{i + 1 < questions.length ? "Next question" : "See my score"}<ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

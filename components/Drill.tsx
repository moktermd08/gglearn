"use client";
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, CircleX, Flame, Lightbulb, RotateCw, Sparkles, Tag, Trophy, X, Zap } from "lucide-react";
import { drillCheck, finishDrill } from "@/app/actions";
import { Confetti } from "@/components/Confetti";
import { Ring } from "@/components/Ring";
import type { QuizQ } from "@/components/Quiz";

type Result = { ok: boolean; topic: string | null; prompt: string; answer: string };

/** Five instant-feedback questions: pick, see right or wrong at once, move on. Ends with a breakdown by topic and what to do next. */
export function Drill({ trackId, back, again, studyHref, trackName, art, accent = "#f59e0b", questions }: {
  trackId: number; back: string; again: string; studyHref: string; trackName: string; art: ReactNode; accent?: string; questions: QuizQ[];
}) {
  const [i, setI] = useState(0), [results, setResults] = useState<Result[]>([]), [res, setRes] = useState<{ key: string; correct: boolean; answer: string; hint: string | null } | null>(null);
  const [xp, setXp] = useState<number | null>(null), [pending, start] = useTransition();
  const score = results.filter((r) => r.ok).length;
  let run = 0, best = 0;
  for (const r of results) { run = r.ok ? run + 1 : 0; best = Math.max(best, run); }
  const streak = (() => { let s = 0; for (let n = results.length - 1; n >= 0 && results[n].ok; n--) s++; return s; })();

  const header = (
    <div className="card relative flex items-center gap-3 overflow-hidden p-4" style={{ background: `linear-gradient(120deg, ${accent}26, #ffffff 60%)` }}>
      <svg className="pointer-events-none absolute -right-8 -top-10 h-40 w-40" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="80" fill="none" stroke={accent} strokeOpacity=".2" /><circle cx="120" cy="80" r="50" fill="none" stroke={accent} strokeOpacity=".28" strokeDasharray="4 6" className="march" /></svg>
      <div className="relative shrink-0">{art}</div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest" style={{ color: `color-mix(in srgb, ${accent} 55%, #000)` }}><Zap size={13} />Quick drill</div>
        <div className="truncate text-lg font-extrabold">{trackName}</div>
      </div>
      <div className="relative flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs font-semibold text-slate-400">{Math.min(i + 1, questions.length)}/{questions.length} · {score} right</span>
        <span className="flex items-center gap-0.5" role="img" title={`${streak} in a row`} aria-label={`${streak} in a row`}>
          {[0, 1, 2, 3, 4].map((n) => <Flame key={n} size={16} className={`transition ${n < streak ? "pulse-glow text-orange-500" : "text-black/15"}`} fill={n < streak ? "#f97316" : "none"} />)}
        </span>
      </div>
    </div>
  );

  if (xp !== null || i >= questions.length) {
    const pct = questions.length ? score / questions.length : 0;
    const byTopic = new Map<string, { ok: number; n: number }>();
    for (const r of results) { const k = r.topic ?? "General"; const e = byTopic.get(k) ?? { ok: 0, n: 0 }; e.n++; if (r.ok) e.ok++; byTopic.set(k, e); }
    const missed = results.filter((r) => !r.ok);
    const band = pct === 1 ? { t: "Perfect run!", Icon: Trophy, col: "text-amber-400" } : pct >= 0.8 ? { t: "On fire!", Icon: Flame, col: "text-orange-500" } : pct >= 0.5 ? { t: "Solid work", Icon: Zap, col: "text-sky-500" } : { t: "Keep climbing", Icon: Zap, col: "text-amber-500" };
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {header}
        {pct >= 0.8 && <Confetti count={pct === 1 ? 110 : 60} />}
        <div className="card pop space-y-4 p-7 text-center">
          <div className="flex items-center justify-center gap-6">
            <Ring pct={pct} label={`${score}/${questions.length}`} sub="correct" size={140} color={pct >= 0.8 ? "#34d399" : pct >= 0.5 ? "#fbbf24" : "#fb7185"} />
          </div>
          <h1 className={`flex items-center justify-center gap-2 text-2xl font-extrabold ${band.col}`}><band.Icon />{band.t}</h1>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            {[{ Icon: Check, v: `${Math.round(pct * 100)}%`, l: "accuracy", col: "#10b981" }, { Icon: Flame, v: best, l: "best streak", col: "#f97316" }, { Icon: Sparkles, v: xp ? `+${xp}` : "0", l: "XP earned", col: "#0ea5e9" }].map(({ Icon, v, l, col }) => (
              <div key={l} className="rounded-xl border border-black/5 p-3"><Icon size={18} className="mx-auto" style={{ color: col }} /><div className="mt-1 text-xl font-extrabold">{v}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">{l}</div></div>
            ))}
          </div>
          <p className="text-sm text-slate-400">{xp ? `+${xp} XP added to your quest log.` : "Today's drill quest was already done, so no extra XP this time."}</p>
        </div>

        {byTopic.size > 1 && (
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">By topic</h2>
            <ul className="space-y-2.5">
              {[...byTopic].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([name, e]) => (
                <li key={name}>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Tag size={12} className="text-slate-400" />{name}</span><span className="font-semibold">{e.ok}/{e.n}</span></div>
                  <div className="bar mt-1"><i className="grow" style={{ width: `${Math.max(8, (e.ok / e.n) * 100)}%`, background: e.ok === e.n ? "#10b981" : e.ok === 0 ? "#f43f5e" : "#f59e0b" }} /></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {missed.length > 0 && (
          <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-rose-300"><CircleX size={15} />Worth another look</h2>
            <ul className="space-y-3 text-sm">{missed.map((m) => <li key={m.prompt}><div className="font-medium">{m.prompt}</div><div className="mt-0.5 flex items-start gap-1 text-slate-300"><Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />{m.answer}</div></li>)}</ul>
          </section>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <a href={again} className="btn"><RotateCw size={16} />Drill again</a>
          <Link href={studyHref} className="btn btn-ghost"><BookOpen size={16} />Study this level</Link>
          <Link href={back} className="btn btn-ghost">Back to the climb<ArrowRight size={16} /></Link>
        </div>
      </div>
    );
  }

  const q = questions[i];
  const pick = (key: string) => { if (res || pending) return; start(async () => { const r = await drillCheck(q.id, key); if (!r) return; setRes({ key, ...r }); setResults((x) => [...x, { ok: r.correct, topic: q.topic ?? null, prompt: q.prompt, answer: q.options?.find((o) => o.key === r.answer)?.text ?? r.answer }]); }); };
  const next = () => {
    if (i === questions.length - 1) start(async () => { setXp(await finishDrill(trackId)); });
    else { setRes(null); setI(i + 1); }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {header}
      <div className="flex gap-1.5" role="img" aria-label="Drill progress">
        {questions.map((_, n) => {
          const r = results[n];
          return <i key={n} className={`h-2.5 flex-1 rounded-full transition-all ${r ? (r.ok ? "pop bg-emerald-500" : "pop bg-rose-500") : n === i ? "animate-pulse" : "bg-black/10"}`} style={!r && n === i ? { background: accent } : undefined} />;
        })}
      </div>
      <div key={q.id} className={`card slide-in relative space-y-4 overflow-hidden p-6 ${res && !res.correct ? "shake" : ""}`}>
        <span className="pointer-events-none absolute -right-1 -top-8 select-none text-[130px] font-black leading-none" style={{ color: accent, opacity: 0.07 }} aria-hidden>{i + 1}</span>
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: `${accent}22`, color: `color-mix(in srgb, ${accent} 55%, #000)` }}>Question {i + 1}</span>
          {q.topic && <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-slate-300"><Tag size={12} />{q.topic}</span>}
        </div>
        <div className="relative text-xl font-semibold leading-snug">{q.prompt}</div>
        {q.code && <pre tabIndex={0} aria-label="Code" className="relative overflow-x-auto rounded-lg bg-black/5 p-3 text-sm">{q.code}</pre>}
        <div className="relative grid gap-2">
          {q.options?.map((o, n) => {
            const chosen = res?.key === o.key, right = res && o.key === res.answer;
            return (
              <button key={o.key} onClick={() => pick(o.key)} disabled={!!res || pending} style={{ "--i": n } as React.CSSProperties}
                className={`rise flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${right ? "ping-once border-emerald-400 bg-emerald-500/15" : chosen ? "border-rose-400 bg-rose-500/15" : res ? "border-transparent bg-black/[.03] opacity-50" : "border-black/10 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-md"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${right ? "bg-emerald-500 text-[#fff]" : chosen ? "bg-rose-500 text-[#fff]" : "bg-black/[.06]"}`}>{o.key.toUpperCase()}</span>
                <span className="flex-1">{o.text}</span>
                {right && <Check size={20} className="spin-in text-emerald-500" />}
                {chosen && !right && <X size={20} className="spin-in text-rose-500" />}
              </button>
            );
          })}
        </div>
        {res && (
          <div className="slide-in relative space-y-3">
            <p className={`flex items-center gap-2 text-lg font-extrabold ${res.correct ? "text-emerald-500" : "text-rose-500"}`}>
              {res.correct ? <><Check size={20} />Correct!{streak >= 2 && <span className="pop ml-1 flex items-center gap-1 text-sm text-orange-500"><Flame size={15} />{streak} in a row</span>}</> : <><X size={20} />Not quite.</>}
            </p>
            {res.hint && !res.correct && <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm"><Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" /><span>{res.hint}</span></p>}
            <button onClick={next} disabled={pending} className="btn">{i === questions.length - 1 ? "Finish" : "Next question"}<ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

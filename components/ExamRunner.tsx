"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Clock, Flag, ListTodo, Send } from "lucide-react";
import { submitCheckAction } from "@/app/terms-actions";
import { KindTag, Prompt, letter } from "@/components/ExamQuestion";
import { savedAnswersKey } from "@/components/ForgetSavedAnswers";

export type RunQuestion = { id: number; form: string; prompt: string; options: string[] };
type Saved = { answers: Record<number, number>; flags: number[]; at: number };

const EMPTY: Saved = { answers: {}, flags: [], at: 0 };
const never = () => () => {};

/** Reads what was saved in this browser, keeping only what still makes sense for these questions. */
function parse(raw: string | null, questions: RunQuestion[]): Saved {
  try {
    const v = JSON.parse(raw ?? "null") as Saved | null;
    if (!v) return EMPTY;
    const answers: Saved["answers"] = {};
    for (const q of questions) { const a = v.answers?.[q.id]; if (Number.isInteger(a) && a >= 0 && a < q.options.length) answers[q.id] = a; }
    return { answers, flags: Array.isArray(v.flags) ? v.flags.filter((f) => questions.some((q) => q.id === f)) : [], at: Number.isInteger(v.at) && v.at >= 0 && v.at <= questions.length ? v.at : 0 };
  } catch { return EMPTY; }
}

function Clocked({ since }: { since: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Math.floor(Date.now() / 1000)); const first = setTimeout(tick, 0), t = setInterval(tick, 1000); return () => { clearTimeout(first); clearInterval(t); }; }, []);
  const s = now == null ? null : Math.max(0, now - since);
  return <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-400" title="Time since the check was made"><Clock size={13} aria-hidden />{s == null ? "–:––" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</span>;
}

function Finish({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}><Send size={15} aria-hidden />{pending ? "Marking…" : ready ? "Finish and see where I stand" : "Finish anyway"}</button>;
}

/**
 * Sitting a term check: one question at a time with a map of all of them, flags to come back to, keys for the answers, and a last look before finishing.
 * What has been answered is kept in this browser until it is sent, so a reload does not lose it. The right answers are not sent to the page.
 */
export function ExamRunner({ examId, title, sub, startedAt, questions }: { examId: number; title: string; sub: string; startedAt: number; questions: RunQuestion[] }) {
  const key = savedAnswersKey(examId);
  const stored = useSyncExternalStore(never, () => { try { return window.localStorage.getItem(key); } catch { return null; } }, () => null);
  const [local, setLocal] = useState<Saved | null>(null);
  const data = local ?? parse(stored, questions);
  const save = (next: Saved) => { setLocal(next); try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* private window: kept only while the page is open */ } };

  const total = questions.length, at = data.at, q = questions[at]; // at === total is the last look
  const done = questions.filter((x) => data.answers[x.id] != null).length;
  const top = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLElement>(null);
  useEffect(() => { // keep the current question's number in sight in the sliding row
    const row = map.current, here = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (row && here) row.scrollTo({ left: here.offsetLeft - row.offsetLeft - row.clientWidth / 2 + here.clientWidth / 2 });
  }, [at]);
  const go = (n: number) => { save({ ...data, at: Math.max(0, Math.min(total, n)) }); top.current?.scrollIntoView({ block: "nearest" }); };
  const choose = (i: number) => save({ ...data, answers: { ...data.answers, [q.id]: i } });
  const flag = () => save({ ...data, flags: data.flags.includes(q.id) ? data.flags.filter((f) => f !== q.id) : [...data.flags, q.id] });

  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" && (el as HTMLInputElement).type !== "radio";
      if (typing || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : /^[a-d]$/i.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1;
      if (q && n >= 0 && n < q.options.length) { e.preventDefault(); choose(n); }
      else if (el.tagName !== "INPUT" && e.key === "ArrowRight") go(at + 1);
      else if (el.tagName !== "INPUT" && e.key === "ArrowLeft") go(at - 1);
    };
  });
  useEffect(() => { const on = (e: KeyboardEvent) => keys.current(e); window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }, []);

  const tile = (x: RunQuestion, n: number) => {
    const answered = data.answers[x.id] != null, flagged = data.flags.includes(x.id), here = n === at;
    return (
      <button key={x.id} type="button" onClick={() => go(n)} aria-current={here ? "step" : undefined} aria-label={`Question ${n + 1}${answered ? ", answered" : ", not answered"}${flagged ? ", flagged" : ""}`}
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 text-xs font-bold ${here ? "border-indigo-500 ring-2 ring-indigo-500" : answered ? "border-indigo-500" : "border-black/15"} ${answered ? "bg-indigo-500 text-[#fff]" : "bg-[#fff] text-slate-300"}`}>
        {n + 1}{flagged && <i className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#fff] bg-amber-400" aria-hidden />}
      </button>
    );
  };

  const open = questions.map((x, n) => [x, n] as const).filter(([x]) => data.answers[x.id] == null);
  const flagged = questions.map((x, n) => [x, n] as const).filter(([x]) => data.flags.includes(x.id));

  return (
    <form action={submitCheckAction} className="mx-auto max-w-3xl space-y-4">
      <input type="hidden" name="exam" value={examId} />
      {Object.entries(data.answers).map(([id, i]) => <input key={id} type="hidden" name={`a_${id}`} value={i} />)}

      <div ref={top} className="card scroll-mt-20 space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><h1 className="text-lg font-extrabold">{title}</h1><p className="text-xs text-slate-400">{sub}</p></div>
          <Clocked since={startedAt} />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
          <span className="text-xs font-bold" aria-live="polite">{done} of {total} answered</span>
        </div>
        {/* one sliding row on a phone, so the question stays in view; all of them at once on a wider screen */}
        <nav ref={map} aria-label="All questions" className="flex gap-1.5 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible">
          {questions.map(tile)}
          <button type="button" onClick={() => go(total)} aria-current={at === total ? "step" : undefined} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 text-xs font-bold ${at === total ? "border-indigo-500 ring-2 ring-indigo-500" : "border-black/15"}`}><ListTodo size={14} aria-hidden />Review</button>
        </nav>
      </div>

      {q ? (
        <>
          <fieldset key={q.id} className="card space-y-4 p-5 sm:p-6">
            <legend className="sr-only">Question {at + 1} of {total}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="text-sm font-extrabold text-slate-400">{at + 1} / {total}</span><KindTag form={q.form} /></span>
              <button type="button" onClick={flag} aria-pressed={data.flags.includes(q.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${data.flags.includes(q.id) ? "border-amber-400 bg-amber-500/10 text-amber-300" : "border-black/15 text-slate-300"}`}><Flag size={13} aria-hidden />{data.flags.includes(q.id) ? "Flagged" : "Flag for later"}</button>
            </div>
            <p><Prompt text={q.prompt} large /></p>
            <div className={`grid gap-2.5 ${q.options.every((o) => o.length <= 40) ? "sm:grid-cols-2" : ""}`}>
              {q.options.map((o, i) => {
                const on = data.answers[q.id] === i;
                return (
                  <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${on ? "border-indigo-500 bg-indigo-500/10" : "border-black/10 bg-[#fff] hover:border-indigo-400"}`}>
                    <input type="radio" name={`pick_${q.id}`} checked={on} onChange={() => choose(i)} className="sr-only" />
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold ${on ? "bg-indigo-500 text-[#fff]" : "bg-black/5 text-slate-300"}`} aria-hidden>{on ? <Check size={16} /> : letter(i)}</span>
                    <span className={`min-w-0 text-base ${on ? "font-bold" : ""}`}>{o}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="card sticky bottom-2 z-10 flex items-center justify-between gap-3 p-2 shadow-lg">
            <button type="button" className="btn btn-ghost" onClick={() => go(at - 1)} disabled={at === 0}><ChevronLeft size={16} aria-hidden />Back</button>
            <button type="button" className="btn" onClick={() => go(at + 1)}>{at === total - 1 ? "Review" : "Next"}<ChevronRight size={16} aria-hidden /></button>
          </div>
          <p className="hidden text-center text-xs text-slate-400 sm:block">Keys: A to D or 1 to 4 to answer, arrows to move.</p>
        </>
      ) : (
        <div className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">Before you finish</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["Answered", done, "#4f46e5"], ["Not answered", open.length, "#be123c"], ["Flagged", flagged.length, "#b45309"]] as const).map(([label, n, color]) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: `${color}12` }}><div className="text-2xl font-extrabold" style={{ color }}>{n}</div><div className="text-xs text-slate-300">{label}</div></div>
            ))}
          </div>
          {open.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold">Not answered yet</p><div className="flex flex-wrap gap-1.5">{open.map(([x, n]) => tile(x, n))}</div><p className="text-xs text-slate-400">An unanswered question counts as wrong.</p></div>}
          {flagged.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold">Flagged to look at again</p><div className="flex flex-wrap gap-1.5">{flagged.map(([x, n]) => tile(x, n))}</div></div>}
          <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4">
            <Finish ready={open.length === 0} />
            <button type="button" className="btn btn-ghost" onClick={() => go(open[0]?.[1] ?? total - 1)}><ChevronLeft size={16} aria-hidden />{open.length ? "Answer the rest" : "Back to the questions"}</button>
          </div>
        </div>
      )}
    </form>
  );
}

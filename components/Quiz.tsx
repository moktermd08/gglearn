"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, Flag, TriangleAlert, Lightbulb, ListChecks, PenLine, Tag, Timer } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";
import { exact } from "@/lib/competitions-shared";
import { Avatar } from "@/components/Avatar";

export type QuizQ = { id: number; prompt: string; code?: string | null; type: "mcq" | "open" | "scenario"; options?: { key: string; text: string }[] | null; topic?: string | null };

const KIND = {
  mcq: { label: "Multiple choice", Icon: ListChecks, cls: "bg-sky-500/15 text-sky-300" },
  open: { label: "Written answer", Icon: PenLine, cls: "bg-violet-500/15 text-violet-300" },
  scenario: { label: "Scenario", Icon: Lightbulb, cls: "bg-amber-500/15 text-amber-300" },
} as const;

/** One question at a time with a progress bar. Answers are posted together; grading stays on the server. */
export function Quiz({ questions, action, level, rivalHue, rivalName, meLook, rivalLook, photoUrl, elapsed, record }: {
  questions: QuizQ[]; action: (fd: FormData) => void | Promise<void>; level: number; rivalHue: number; rivalName: string; meLook?: string; rivalLook?: string; photoUrl?: string | null;
  elapsed?: number; // seconds since the exam was started, measured by the server
  record?: { seconds: number; holder: string; mine: boolean; title: string } | null; // fastest pass of this level in a live contest the person is racing in
}) {
  const [i, setI] = useState(0);
  const [warn, setWarn] = useState(false);
  const force = useRef(false);
  const key = `gglearn-draft:${questions.map((x) => x.id).join(",")}`;
  // answers only live in this page until you submit, so keep a draft: a refresh or a dropped connection must not cost the exam.
  // The saved draft is read as an external store (null on the server) and your edits sit on top of it.
  const saved = useSyncExternalStore(() => () => {}, () => { try { return sessionStorage.getItem(key); } catch { return null; } }, () => null);
  const draft = useMemo<Record<number, string>>(() => { try { const d = JSON.parse(saved ?? "null"); return d && typeof d === "object" ? d : {}; } catch { return {}; } }, [saved]);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const ans = { ...draft, ...edits };
  const setAns = (v: Record<number, string> | ((a: Record<number, string>) => Record<number, string>)) => setEdits((e) => (typeof v === "function" ? v({ ...draft, ...e }) : v));
  useEffect(() => {
    try { if (Object.keys(edits).length) sessionStorage.setItem(key, JSON.stringify({ ...draft, ...edits })); } catch { /* storage blocked: carry on without a draft */ }
  }, [edits, draft, key]);
  const q = questions[i], last = i === questions.length - 1;
  const done = (id: number) => !!ans[id]?.trim();
  const answered = questions.filter((x) => done(x.id)).length;
  const kind = KIND[q.type];
  const firstBlank = questions.findIndex((x) => !done(x.id));
  const left = questions.length - answered;
  // 1-4 or A-D picks an option, arrows move between questions (never while typing a written answer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t instanceof Element && t.closest("textarea,input,select"))) return;
      if (e.key === "ArrowRight") setI((n) => Math.min(questions.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (questions[i].type === "mcq") {
        const opts = questions[i].options ?? [], k = e.key.toLowerCase();
        const hit = opts.find((o, n) => o.key.toLowerCase() === k || String(n + 1) === k);
        if (hit) setEdits((a) => ({ ...a, [questions[i].id]: hit.key }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, questions]);
  return (
    <form action={(fd) => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } return action(fd); }}
      onSubmit={(e) => { if (left > 0 && !force.current) { e.preventDefault(); setWarn(true); } }} className="mx-auto max-w-2xl space-y-5">
      {questions.map((x) => <input key={x.id} type="hidden" name={`q${x.id}`} value={ans[x.id] ?? ""} />)}
      <div className="flex items-center gap-3">
        <Avatar kind="human" level={level} size={44} look={meLook} photoUrl={photoUrl} />
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-400"><span>Question {i + 1} of {questions.length}</span><span className="flex items-center gap-1"><Check size={12} className="text-emerald-400" />{answered} answered</span></div>
          <div className="bar mt-1"><i style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
        </div>
        <Avatar kind="rival" level={level} hue={rivalHue} size={44} className="opacity-70" look={rivalLook} />
      </div>

      {elapsed !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm" aria-label="Exam clock">
          <span className="inline-flex items-center gap-1.5 font-bold"><Timer size={16} className="text-sky-300" /><LiveClock elapsed={elapsed} className="text-lg" /></span>
          {record && <span className="text-xs text-slate-400">{record.mine ? "Your record" : `${record.holder}’s record`} in {record.title}: <b className="text-slate-200">{exact(record.seconds)}</b></span>}
        </div>
      )}

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
          <div className="grid gap-2" role="radiogroup" aria-label="Answer options">
            {q.options?.map((o, n) => {
              const on = ans[q.id] === o.key;
              return (
                <button type="button" role="radio" aria-checked={on} key={o.key} onClick={() => setAns({ ...ans, [q.id]: o.key })} style={{ "--i": n } as React.CSSProperties}
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
      {warn && left > 0 && (
        <div role="alert" className="card flex flex-wrap items-center gap-3 border-amber-300/50 p-4 text-sm">
          <TriangleAlert size={18} className="shrink-0 text-amber-400" />
          <span className="min-w-0 flex-1"><b>{left} question{left === 1 ? " is" : "s are"} still blank.</b> Blank answers score zero.</span>
          <button type="button" className="btn btn-ghost !py-1.5" onClick={() => { setI(firstBlank); setWarn(false); }}>Go to question {firstBlank + 1}</button>
          <button className="btn !py-1.5" onClick={() => { force.current = true; }}>Submit anyway</button>
        </div>
      )}
      <p className="text-center text-xs text-slate-500">Tip: press 1-4 or A-D to answer, and the arrow keys to move between questions.</p>
    </form>
  );
}

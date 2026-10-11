"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BookOpen, CheckCircle2, Clock, GraduationCap, Info, Lightbulb, ListChecks, Lock, PenLine, Sparkles, Target, X } from "lucide-react";
import { RankEmblem } from "@/components/RankEmblem";
import { LevelScale } from "@/components/charts";

export type LevelDetailData = {
  level: number; name: string; tier: string; hue: number; state: "done" | "current" | "locked" | "preview";
  meaning: string; expect: string; questions: number; minutes: number; passPct: number; perExam: number;
  topics: string[]; syllabus: string[]; lessonTitle: string | null; cert: string | null; prev: string | null; next: string | null;
  types: { mcq: number; open: number; scenario: number }; nextMeaning: string | null; nextExpect: string | null;
};

const STATE = {
  done: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-300", Icon: CheckCircle2 },
  current: { label: "Your next level", cls: "bg-indigo-500/15 text-indigo-300", Icon: Target },
  locked: { label: "Locked", cls: "bg-slate-500/15 text-slate-300", Icon: Lock },
  preview: { label: "Preview", cls: "bg-sky-500/15 text-sky-300", Icon: Info },
} as const;

/**
 * Makes a whole level card open this panel. The card's own buttons and links keep working: they sit above the invisible
 * button that covers the card. `actions` (Study / Exam) is rendered by the server and shown in the panel's footer.
 */
export function LevelDetail({ d, actions }: { d: LevelDetailData; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const s = STATE[d.state], c = `hsl(${d.hue} 70% 45%)`;
  const unlock = d.state === "done" ? "You have passed this level." : d.state === "current" ? "You can take this level now." : d.state === "locked" ? `Pass ${d.prev ?? "the level before it"} first. Levels open one at a time.` : "Start this subject to begin at level 1; each level opens when you pass the one before.";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`What ${d.name} (level ${d.level}) means`} className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-indigo-400" />
      {open && createPortal( // only ever true after a click, so `document` exists
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} role="dialog" aria-modal="true" aria-label={`${d.name}, level ${d.level}`}>
          <div className="pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#fff] shadow-2xl">
            <div className="relative flex items-center gap-4 px-6 pb-5 pt-6" style={{ background: `linear-gradient(135deg, hsl(${d.hue} 85% 55% / .25), transparent 80%)` }}>
              <RankEmblem level={d.level} state={d.state === "locked" ? "preview" : d.state} size={84} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-widest" style={{ color: c }}>{d.tier} rank · level {d.level} of 20</div>
                <h2 className="text-2xl font-extrabold">{d.name}</h2>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls}`}><s.Icon size={12} />{s.label}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"><X size={18} /></button>
            </div>

            <div className="space-y-5 px-6 pb-6">
              <p className="text-lg font-semibold leading-snug">{d.meaning}</p>

              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Where it sits on the climb</div>
                <LevelScale lo={d.level - 1} hi={d.level} you={d.level} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { Icon: ListChecks, v: `${d.perExam}`, l: "questions per exam", col: "#0ea5e9" },
                  { Icon: Target, v: `${d.passPct}%`, l: "to pass", col: "#ec4899" },
                  { Icon: Clock, v: `~${d.minutes} min`, l: "per attempt", col: "#f59e0b" },
                  { Icon: Sparkles, v: "+50 XP", l: "bonus for passing", col: "#10b981" },
                ].map(({ Icon, v, l, col }) => (
                  <div key={l} className="rounded-xl border border-black/5 p-2.5 text-center">
                    <Icon size={16} className="mx-auto" style={{ color: col }} />
                    <div className="mt-1 text-sm font-extrabold">{v}</div><div className="text-[10px] leading-tight text-slate-400">{l}</div>
                  </div>
                ))}
              </div>

              <section>
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold"><Target size={15} style={{ color: c }} />What to expect</h3>
                <p className="text-sm text-slate-300">{d.expect}</p>
                <p className="mt-1 text-xs text-slate-400">Each attempt draws {d.perExam} fresh questions from a pool of {d.questions}.</p>
              </section>

              {(() => {
                const T = [
                  { k: "mcq", n: d.types.mcq, label: "Multiple choice", hint: "Pick the best answer from the options.", Icon: ListChecks, col: "#0ea5e9" },
                  { k: "scenario", n: d.types.scenario, label: "Scenario", hint: "A short situation: say what you would do and why.", Icon: Lightbulb, col: "#f59e0b" },
                  { k: "open", n: d.types.open, label: "Written answer", hint: "Explain it in your own words.", Icon: PenLine, col: "#8b5cf6" },
                ].filter((t) => t.n > 0);
                const total = T.reduce((a, t) => a + t.n, 0);
                return total > 0 ? (
                  <section>
                    <h3 className="mb-1.5 text-sm font-bold">Types of question</h3>
                    <div className="flex h-3 overflow-hidden rounded-full bg-black/5" role="img" aria-label={T.map((t) => `${t.label} ${Math.round((t.n / total) * 100)}%`).join(", ")}>
                      {T.map((t) => <i key={t.k} className="block h-full" style={{ width: `${(t.n / total) * 100}%`, background: t.col }} />)}
                    </div>
                    <ul className="mt-2 space-y-1.5">{T.map((t) => (
                      <li key={t.k} className="flex items-start gap-2 text-sm"><t.Icon size={15} className="mt-0.5 shrink-0" style={{ color: t.col }} /><span><b>{t.label}</b> <span className="text-xs text-slate-400">{Math.round((t.n / total) * 100)}% of the pool</span><br /><span className="text-xs text-slate-400">{t.hint}</span></span></li>
                    ))}</ul>
                  </section>
                ) : null;
              })()}

              {d.topics.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-sm font-bold">Topics you will meet</h3>
                  <div className="flex flex-wrap gap-1.5">{d.topics.map((t) => <span key={t} className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `hsl(${d.hue} 80% 55% / .12)`, color: c }}>{t}</span>)}</div>
                </section>
              )}

              {d.syllabus.length > 0 && (
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold"><BookOpen size={15} style={{ color: c }} />{d.lessonTitle ?? "Study guide"}</h3>
                  <ol className="space-y-1.5">{d.syllabus.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold" style={{ background: `hsl(${d.hue} 80% 55% / .15)`, color: c }}>{i + 1}</span><span className="text-slate-300">{t}</span></li>
                  ))}</ol>
                </section>
              )}

              <section className="rounded-2xl bg-black/[.03] p-3">
                <h3 className="mb-2 text-sm font-bold">How to unlock it</h3>
                <div className="flex items-center gap-2 text-center text-[11px] font-semibold text-slate-400">
                  <div className="flex flex-1 flex-col items-center gap-1">{d.level > 1 ? <RankEmblem level={d.level - 1} state="done" size={34} /> : <span className="h-10" />}<span>{d.prev ?? "Start"}</span></div>
                  <span aria-hidden>→</span>
                  <div className="flex flex-1 flex-col items-center gap-1"><RankEmblem level={d.level} state={d.state === "locked" ? "preview" : d.state} size={44} /><span style={{ color: c }}>{d.name}</span></div>
                  <span aria-hidden>→</span>
                  <div className="flex flex-1 flex-col items-center gap-1">{d.level < 20 ? <RankEmblem level={d.level + 1} state="locked" size={34} /> : <span className="h-10" />}<span>{d.next ?? "The summit"}</span></div>
                </div>
                <p className="mt-2 text-sm text-slate-300">{unlock}</p>
              </section>

              {d.level < 20 && d.next && (
                <section className="flex items-start gap-3 rounded-2xl border border-black/5 p-3">
                  <RankEmblem level={d.level + 1} state="preview" size={44} />
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1 text-sm font-bold">What comes next <ArrowRight size={13} className="text-slate-400" /> <span style={{ color: c }}>{d.next}</span></h3>
                    {d.nextMeaning && <p className="mt-0.5 text-sm text-slate-300">{d.nextMeaning}</p>}
                    {d.nextExpect && <p className="mt-0.5 text-xs text-slate-400">Expect: {d.nextExpect}</p>}
                  </div>
                </section>
              )}

              {d.cert && <p className="flex items-center gap-2 rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-300"><GraduationCap size={16} />Passing this level earns the {d.cert} certificate.</p>}

              {actions && <div className="flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">{actions}</div>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

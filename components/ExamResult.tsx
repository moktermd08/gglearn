import Link from "next/link";
import { BookOpen, Check, CircleSlash, Clock, Medal, Trophy, X } from "lucide-react";
import { Ring } from "@/components/Ring";
import { KindTag, Prompt, letter } from "@/components/ExamQuestion";
import { RANK_COLOR, TopicIcon, topicHue } from "@/components/TermVisuals";
import { RANKS, TERM_PASS, rankName } from "@/lib/termsCore";
import type { CheckAnswer } from "@/lib/terms";
import type { ReactNode } from "react";

/** The result of a term check as pictures first: the score, which questions went wrong, how each rank and topic went, then every question to go over. */

const clock = (s: number) => (s >= 3600 ? "over an hour" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export function ResultHead({ score, title, sub, right, wrong, skipped, seconds }: { score: number; title: string; sub: string; right: number; wrong: number; skipped: number; seconds: number }) {
  const passed = score >= TERM_PASS, color = passed ? "#059669" : "#d97706";
  return (
    <header className="card flex flex-wrap items-center gap-5 p-5 sm:p-6" style={{ background: `linear-gradient(120deg, ${color}1f, #ffffff 60%)` }}>
      <Ring pct={score} size={128} label={`${Math.round(score * 100)}%`} sub={`pass ${TERM_PASS * 100}%`} color={color} className="mx-auto inline-grid" />
      <div className="min-w-0 flex-[1_1_16rem] space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">{passed ? <Trophy size={24} className="shrink-0 text-emerald-300" aria-hidden /> : <Medal size={24} className="shrink-0 text-amber-300" aria-hidden />}{title}</h1>
        <p className="text-sm text-slate-300">{sub}</p>
        <ul className="flex flex-wrap gap-2 text-xs font-bold">
          <li className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-emerald-800"><Check size={13} aria-hidden />{right} right</li>
          <li className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-rose-800"><X size={13} aria-hidden />{wrong} wrong</li>
          {skipped > 0 && <li className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-slate-300"><CircleSlash size={13} aria-hidden />{skipped} not answered</li>}
          <li className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-slate-300"><Clock size={13} aria-hidden />{clock(seconds)}</li>
        </ul>
      </div>
    </header>
  );
}

export function QuestionStrip({ answers }: { answers: CheckAnswer[] }) {
  return (
    <nav aria-label="Questions" className="card space-y-2 p-4">
      <h2 className="font-bold">Question by question <span className="text-xs font-normal text-slate-400">tap one to see it</span></h2>
      <ol className="flex flex-wrap gap-1.5">
        {answers.map((a, n) => (
          <li key={a.id}><a href={`#q${n + 1}`} aria-label={`Question ${n + 1}, ${a.right ? "right" : "wrong"}`} className={`grid h-10 w-10 place-items-center rounded-lg text-xs font-bold ${a.right ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            <span className="leading-none">{n + 1}</span>{a.right ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}
          </a></li>
        ))}
      </ol>
    </nav>
  );
}

export function RankChart({ stats, claimed, note }: { stats: Record<number, { tested: number; right: number }>; claimed: number; note?: ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-bold">By rank</h2>
      <div className="flex items-end gap-2">
        {RANKS.map((r, i) => {
          const t = stats[i + 1], pct = t ? Math.round((t.right / t.tested) * 100) : null;
          return (
            <div key={r} className={`min-w-0 flex-1 rounded-lg p-1 text-center ${i + 1 === claimed ? "ring-2 ring-indigo-500" : ""}`}>
              <div className="text-xs font-bold">{t ? `${t.right}/${t.tested}` : "–"}</div>
              <div className="mx-auto mt-1 flex h-24 w-full max-w-10 items-end overflow-hidden rounded-md bg-black/5" aria-hidden><div className="w-full" style={{ height: `${pct ?? 0}%`, background: RANK_COLOR[i] }} /></div>
              <div className="mt-1 truncate text-[10px] text-slate-400">{r}</div>
            </div>
          );
        })}
      </div>
      {note}
    </section>
  );
}

const SHOWN_TOPICS = 6;

export function TopicBars({ answers }: { answers: CheckAnswer[] }) {
  const topics = [...new Set(answers.map((a) => a.group))].map((g) => {
    const of = answers.filter((a) => a.group === g);
    return { group: g, total: of.length, right: of.filter((a) => a.right).length };
  }).sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total); // weakest first
  const row = (t: (typeof topics)[number]) => {
    const hue = topicHue(t.group), share = t.right / t.total;
    return (
      <li key={t.group} className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${hue}14`, color: hue }} aria-hidden><TopicIcon group={t.group} bank="" size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex justify-between gap-2 text-xs"><span className="truncate font-semibold">{t.group || "General"}</span><span className="text-slate-400">{t.right} of {t.total}</span></span>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-black/5" aria-hidden><i className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: share >= TERM_PASS ? "#059669" : "#d97706" }} /></span>
        </span>
      </li>
    );
  };
  const rest = topics.slice(SHOWN_TOPICS);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-bold">By topic <span className="text-xs font-normal text-slate-400">weakest first</span></h2>
      <ul className="space-y-2.5">{topics.slice(0, SHOWN_TOPICS).map(row)}</ul>
      {rest.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold underline">Show {rest.length} more topic{rest.length === 1 ? "" : "s"}</summary><ul className="mt-2.5 space-y-2.5">{rest.map(row)}</ul></details>}
    </section>
  );
}

function Reviewed({ a, n }: { a: CheckAnswer; n: number }) {
  return (
    <li id={`q${n}`} className="card scroll-mt-24 space-y-3 p-4 target:ring-2 target:ring-indigo-500" style={{ borderLeft: `5px solid ${a.right ? "#059669" : "#be123c"}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2"><span className="text-sm font-extrabold text-slate-400">{n}</span><KindTag form={a.form} /></span>
        <span className="text-xs text-slate-400">{rankName(a.tier)}</span>
      </div>
      <p><Prompt text={a.prompt} /></p>
      <ul className="grid gap-2">
        {a.options.map((o, i) => {
          const isRight = i === a.correct, picked = i === a.chosen;
          return (
            <li key={i} className={`flex items-center gap-3 rounded-xl border-2 p-2.5 text-sm ${isRight ? "border-emerald-400 bg-emerald-500/10 font-bold" : picked ? "border-rose-400 bg-rose-500/10" : "border-black/10"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${isRight ? "bg-emerald-100 text-emerald-800" : picked ? "bg-rose-100 text-rose-800" : "bg-black/5 text-slate-300"}`} aria-hidden>{isRight ? <Check size={14} /> : picked ? <X size={14} /> : letter(i)}</span>
              <span className="min-w-0 flex-1">{o}</span>
              {(picked || isRight) && <span className="shrink-0 text-[11px] font-bold text-slate-300">{picked && isRight ? "Your answer, right" : picked ? "Your answer" : "Right answer"}</span>}
            </li>
          );
        })}
      </ul>
      {a.chosen == null && <p className="text-xs text-rose-300">You did not answer this one.</p>}
      <p className="flex items-start gap-2 rounded-xl bg-indigo-500/10 p-3 text-sm"><BookOpen size={15} className="mt-0.5 shrink-0 text-indigo-300" aria-hidden /><span><b>{a.term}</b>: {a.meaning}</span></p>
    </li>
  );
}

export function Review({ examId, answers }: { examId: number; answers: CheckAnswer[] }) {
  const numbered = answers.map((a, i) => ({ a, n: i + 1 }));
  const wrong = numbered.filter((x) => !x.a.right), right = numbered.filter((x) => x.a.right);
  return (
    <>
      {wrong.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Terms to work on ({wrong.length})</h2>
            <Link href={`/terms/study/missed/${examId}`} className="btn"><BookOpen size={15} aria-hidden />Study the {wrong.length} term{wrong.length === 1 ? "" : "s"} I missed</Link>
          </div>
          <ol className="space-y-3">{wrong.map((x) => <Reviewed key={x.a.id} a={x.a} n={x.n} />)}</ol>
        </section>
      )}
      {right.length > 0 && (
        <details className="space-y-3" open={wrong.length === 0}>
          <summary className="cursor-pointer text-lg font-extrabold">What you got right ({right.length})</summary>
          <ol className="mt-3 space-y-3">{right.map((x) => <Reviewed key={x.a.id} a={x.a} n={x.n} />)}</ol>
        </details>
      )}
    </>
  );
}

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { answers, certificates, db, enrollments, questions, runs, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, PASS_MARK, TIERS, certTitle, tierOf } from "@/lib/levels";
import { rivalFor, rivalProgress } from "@/lib/rivals";
import { submitRun } from "@/app/actions";
import { Quiz } from "@/components/Quiz";
import { Ring } from "@/components/Ring";
import { Confetti } from "@/components/Confetti";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, BarChart3, Check, CircleCheck, CircleMinus, CircleX, GraduationCap, Lightbulb, Medal, MessageSquareText, Sparkles, Tag, Target, Trophy } from "lucide-react";

const OK = 0.8; // same bar the review has always used for a correct answer
const tone = (sc: number) => (sc >= OK ? "emerald" : sc > 0 ? "amber" : "rose") as "emerald" | "amber" | "rose";
const BAR = { emerald: "bg-emerald-400", amber: "bg-amber-400", rose: "bg-rose-400" };
const TEXT = { emerald: "text-emerald-300", amber: "text-amber-300", rose: "text-rose-300" };
const BORDER = { emerald: "border-emerald-500/40", amber: "border-amber-500/40", rose: "border-rose-500/40" };
const Verdict = { emerald: CircleCheck, amber: CircleMinus, rose: CircleX };

function Stat({ Icon, label, value, cls, i }: { Icon: typeof Check; label: string; value: string | number; cls: string; i: number }) {
  return (
    <div className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
      <Icon size={22} className={`mx-auto ${cls}`} />
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const runId = Number((await params).id);
  const run = db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, user.id))).get();
  if (!run) notFound();
  const track = db.select().from(tracks).where(eq(tracks.id, run.trackId)).get()!;
  const rival = rivalFor(track.slug);
  const rows = db.select({ a: answers, q: questions }).from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId)).where(eq(answers.runId, runId)).all();
  const title = `${track.name} · Level ${run.level} · ${LEVELS[run.level - 1]}`;

  if (!run.finishedAt) {
    return (
      <div className="space-y-4">
        <h1 className="text-center text-xl font-extrabold">{title}</h1>
        <Quiz action={submitRun.bind(null, runId)} level={run.level} rivalHue={rival.hue} rivalName={rival.name}
          questions={rows.map(({ q }) => ({ id: q.id, prompt: q.prompt, code: q.code, type: q.type, options: q.options, topic: q.topic }))} />
      </div>
    );
  }

  const score = run.score ?? 0, pct = Math.round(score * 100), passed = !!run.passed;
  const xp = pct + (passed ? 50 : 0);
  const enrolment = db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get();
  const rv = rivalProgress(rival, track.slug, enrolment?.startedAt ?? run.startedAt);
  const cert = db.select().from(certificates).where(and(eq(certificates.userId, user.id), eq(certificates.trackId, track.id), eq(certificates.level, run.level))).get();
  const right = rows.filter(({ a }) => a.score >= OK).length, partial = rows.filter(({ a }) => a.score > 0 && a.score < OK).length, missed = rows.length - right - partial;
  const byTopic = new Map<string, number[]>();
  for (const { a, q } of rows) if (q.topic) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), a.score]);
  const topics = [...byTopic].map(([name, sc]) => ({ name, avg: sc.reduce((x, y) => x + y, 0) / sc.length })).sort((x, y) => x.avg - y.avg);
  const tierUp = passed && run.level > 1 && tierOf(run.level) > tierOf(run.level - 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {passed && <Confetti count={run.level === MAX_LEVEL || cert ? 120 : 60} />}
      <div className="card pop space-y-4 p-6 text-center">
        <h1 className="text-xl font-extrabold">{title}</h1>
        <div className="flex items-center justify-center gap-6">
          <Avatar kind="human" level={passed ? run.level : run.level - 1} size={96} className="bob" />
          <Ring pct={score} label={`${pct}%`} sub={`pass ${PASS_MARK * 100}%`} size={140} color={passed ? "#34d399" : "#fbbf24"} />
          <Avatar kind="rival" level={rv.level} hue={rival.hue} size={96} className="bob [animation-delay:.5s]" />
        </div>
        <p className={`text-2xl font-extrabold ${passed ? "text-emerald-300" : "text-amber-300"}`}>
          <span className="inline-flex items-center justify-center gap-2">{passed ? <Trophy className="pulse-glow text-yellow-300" /> : <Target />}{passed ? (run.level === MAX_LEVEL ? "You are a Titan." : `Level ${run.level} conquered!`) : "So close. Review and go again."}</span>
        </p>
        <p className="text-slate-300">+{xp} XP · {passed ? `${rival.name} is on level ${rv.level}${run.level > rv.level ? ", and you are ahead!" : run.level === rv.level ? ", and you are level." : ", so keep pushing."}` : `You need ${PASS_MARK * 100}% to pass. ${rival.name} is on level ${rv.level}.`}</p>
        {tierUp && <p className="pop flex items-center justify-center gap-2 font-bold" style={{ color: `hsl(${TIERS[tierOf(run.level)].hue} 70% 35%)` }}><Medal size={20} />Rank up: {TIERS[tierOf(run.level)].name}!</p>}
        {cert && <Link href={`/cert/${cert.code}`} className="btn"><GraduationCap size={18} />Get your {certTitle(run.level)} certificate</Link>}
        <div><Link href={`/tracks/${track.slug}`} className="btn btn-ghost"><ArrowLeft size={16} />Back to the climb</Link></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat Icon={CircleCheck} label="Correct" value={right} cls="text-emerald-400" i={0} />
        <Stat Icon={CircleMinus} label="Partial" value={partial} cls="text-amber-400" i={1} />
        <Stat Icon={CircleX} label="Missed" value={missed} cls="text-rose-400" i={2} />
        <Stat Icon={Sparkles} label="XP earned" value={`+${xp}`} cls="text-sky-300" i={3} />
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><BarChart3 size={18} className="text-indigo-300" />Score by question</h2>
        <div className="relative flex h-32 items-end gap-1.5" role="img" aria-label="Score for each question">
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25" style={{ bottom: `${PASS_MARK * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] text-slate-400">pass {PASS_MARK * 100}%</span>
          </div>
          {rows.map(({ a }, i) => (
            <div key={a.id} className="group relative flex h-full flex-1 flex-col justify-end" title={`Q${i + 1}: ${Math.round(a.score * 100)}%`}>
              <div className={`grow rounded-t ${BAR[tone(a.score)]}`} style={{ height: `${Math.max(a.score * 100, 4)}%`, "--i": i } as React.CSSProperties} />
              <div className="mt-1 text-center text-[10px] text-slate-400">{i + 1}</div>
            </div>
          ))}
        </div>
      </section>

      {topics.length > 1 && (
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-bold"><Target size={18} className="text-pink-300" />Strengths by topic</h2>
          <ul className="space-y-2.5">
            {topics.map((t, i) => (
              <li key={t.name}>
                <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Tag size={12} className="text-slate-400" />{t.name}</span><span className={`font-semibold ${TEXT[tone(t.avg)]}`}>{Math.round(t.avg * 100)}%</span></div>
                <div className="bar mt-1"><i className="grow !transition-none" style={{ width: `${t.avg * 100}%`, "--i": i, background: undefined } as React.CSSProperties} /></div>
              </li>
            ))}
          </ul>
          {topics[0].avg < OK && <p className="flex items-center gap-2 text-sm text-slate-300"><Lightbulb size={15} className="text-amber-300" />Focus next on <b>{topics[0].name}</b>.</p>}
        </section>
      )}

      <h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText size={20} className="text-indigo-300" />Review</h2>
      <ol className="space-y-3">
        {rows.map(({ a, q }, i) => {
          const t = tone(a.score), V = Verdict[t];
          const correct = q.options?.find((o) => o.key === q.answer)?.text;
          return (
            <li key={a.id} className={`card rise p-4 ${BORDER[t]}`} style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start gap-3">
                <V size={22} className={`mt-0.5 shrink-0 ${TEXT[t]}`} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-400">Q{i + 1}</span>
                    {q.topic && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-slate-300"><Tag size={11} />{q.topic}</span>}
                    <span className={`ml-auto font-bold ${TEXT[t]}`}>{Math.round(a.score * 100)}%</span>
                  </div>
                  <div className="font-medium">{q.prompt}</div>
                  {q.code && <pre className="overflow-x-auto rounded bg-black/5 p-2 text-sm">{q.code}</pre>}
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`grow h-full rounded-full ${BAR[t]}`} style={{ width: `${a.score * 100}%`, "--i": i } as React.CSSProperties} /></div>
                  <div className={`rounded-lg p-2.5 text-sm ${t === "emerald" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                    <span className="text-xs uppercase tracking-wider text-slate-400">Your answer</span>
                    <div className="mt-0.5 whitespace-pre-wrap font-mono">{a.response || "—"}</div>
                  </div>
                  {q.type === "mcq" && a.score < 1 && (
                    <div className="rounded-lg bg-emerald-500/10 p-2.5 text-sm">
                      <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-emerald-300"><Check size={12} />Correct answer</span>
                      <div className="mt-0.5"><span className="font-mono font-bold">{q.answer?.toUpperCase()}</span> — {correct}</div>
                    </div>
                  )}
                  {a.feedback && <div className="flex gap-2 text-sm text-slate-400"><Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-300" /><span>{a.feedback}</span></div>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

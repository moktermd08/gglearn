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
          questions={rows.map(({ q }) => ({ id: q.id, prompt: q.prompt, code: q.code, type: q.type, options: q.options }))} />
      </div>
    );
  }

  const score = run.score ?? 0, pct = Math.round(score * 100), passed = !!run.passed;
  const xp = pct + (passed ? 50 : 0);
  const enrolment = db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get();
  const rv = rivalProgress(rival, track.slug, enrolment?.startedAt ?? run.startedAt);
  const cert = db.select().from(certificates).where(and(eq(certificates.userId, user.id), eq(certificates.trackId, track.id), eq(certificates.level, run.level))).get();
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
          {passed ? (run.level === MAX_LEVEL ? "You are a Titan. 👑" : `Level ${run.level} conquered!`) : "So close. Review and go again."}
        </p>
        <p className="text-slate-300">+{xp} XP · {passed ? `${rival.name} is on level ${rv.level}${run.level > rv.level ? ", and you are ahead!" : run.level === rv.level ? ", and you are level." : ", so keep pushing."}` : `You need ${PASS_MARK * 100}% to pass. ${rival.name} is on level ${rv.level}.`}</p>
        {tierUp && <p className="font-bold" style={{ color: `hsl(${TIERS[tierOf(run.level)].hue} 85% 70%)` }}>🎖️ Rank up: {TIERS[tierOf(run.level)].name}!</p>}
        {cert && <Link href={`/cert/${cert.code}`} className="btn">🎓 Get your {certTitle(run.level)} certificate</Link>}
        <div><Link href={`/tracks/${track.slug}`} className="btn btn-ghost">Back to the climb</Link></div>
      </div>

      <h2 className="text-lg font-bold">Review</h2>
      <ol className="space-y-3">
        {rows.map(({ a, q }, i) => (
          <li key={a.id} className={`card p-4 ${a.score >= 0.8 ? "border-emerald-500/40" : "border-rose-500/40"}`}>
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            {q.code && <pre className="mt-2 overflow-x-auto rounded bg-black/50 p-2 text-sm">{q.code}</pre>}
            <div className="mt-2 text-sm">Your answer: <span className="font-mono">{a.response || "—"}</span> {a.score >= 0.8 ? "✅" : "❌"}</div>
            {q.type === "mcq" && a.score < 1 && <div className="text-sm">Correct: <span className="font-mono">{q.answer}</span> — {q.options?.find((o) => o.key === q.answer)?.text}</div>}
            {a.feedback && <div className="mt-1 text-sm text-slate-400">{a.feedback}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

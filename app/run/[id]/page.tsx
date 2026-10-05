import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { answers, db, questions, runs, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, PASS_MARK } from "@/lib/levels";
import { submitRun } from "@/app/actions";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const runId = Number((await params).id);
  const run = db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, user.id))).get();
  if (!run) notFound();
  const track = db.select().from(tracks).where(eq(tracks.id, run.trackId)).get()!;
  const rows = db.select({ a: answers, q: questions }).from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId)).where(eq(answers.runId, runId)).all();
  const title = `${track.name} · Level ${run.level} · ${LEVELS[run.level - 1]}`;

  if (run.finishedAt) {
    const pct = Math.round((run.score ?? 0) * 100);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className={`mt-2 text-lg ${run.passed ? "text-green-600" : "text-amber-600"}`}>
            {pct}% — {run.passed ? (run.level === MAX_LEVEL ? "You are a Titan." : "Level passed. Next level unlocked.") : `Not yet. You need ${PASS_MARK * 100}%. Review below and try again.`}
          </p>
        </div>
        <ol className="space-y-3">
          {rows.map(({ a, q }, i) => (
            <li key={a.id} className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
              <div className="font-medium">{i + 1}. {q.prompt}</div>
              {q.code && <pre className="mt-2 overflow-x-auto rounded bg-stone-100 p-2 text-sm dark:bg-stone-900">{q.code}</pre>}
              <div className="mt-2 text-sm">Your answer: <span className="font-mono">{a.response || "—"}</span> {a.score >= 0.8 ? "✓" : "✗"}</div>
              {q.type === "mcq" && a.score < 1 && <div className="text-sm">Correct: <span className="font-mono">{q.answer}</span> — {q.options?.find((o) => o.key === q.answer)?.text}</div>}
              {a.feedback && <div className="mt-1 text-sm text-stone-500">{a.feedback}</div>}
            </li>
          ))}
        </ol>
        <Link href={`/tracks/${track.slug}`} className="underline">Back to {track.name}</Link>
      </div>
    );
  }

  return (
    <form action={submitRun.bind(null, runId)} className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <ol className="space-y-4">
        {rows.map(({ q }, i) => (
          <li key={q.id} className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            {q.code && <pre className="mt-2 overflow-x-auto rounded bg-stone-100 p-2 text-sm dark:bg-stone-900">{q.code}</pre>}
            {q.type === "mcq" ? (
              <fieldset className="mt-3 space-y-1">
                {q.options?.map((o) => (
                  <label key={o.key} className="flex items-start gap-2">
                    <input type="radio" name={`q${q.id}`} value={o.key} className="mt-1" />
                    <span><span className="font-mono">{o.key}.</span> {o.text}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <textarea name={`q${q.id}`} rows={4} maxLength={4000} placeholder="Write your answer"
                className="mt-3 w-full rounded border border-stone-300 bg-transparent p-2 dark:border-stone-700" />
            )}
          </li>
        ))}
      </ol>
      <button className="rounded bg-stone-900 px-5 py-2 text-white dark:bg-stone-100 dark:text-stone-900">Submit answers</button>
    </form>
  );
}

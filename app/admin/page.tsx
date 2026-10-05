import { desc, eq, sql } from "drizzle-orm";
import { answers, db, questions, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { retireQuestion } from "@/app/actions";

const MIN_ATTEMPTS = 5;

export default async function Admin() {
  await requireManager();
  const attempts = sql<number>`count(${answers.id})`;
  const accuracy = sql<number>`avg(${answers.score})`;

  const perTrack = db.select({
    track: tracks.name,
    total: sql<number>`count(distinct ${questions.id})`,
    authored: sql<number>`sum(${questions.source} != 'legacy-trialtest')`,
    attempts,
  }).from(tracks).leftJoin(questions, eq(questions.trackId, tracks.id)).leftJoin(answers, eq(answers.questionId, questions.id))
    .groupBy(tracks.id).orderBy(desc(sql`count(distinct ${questions.id})`)).limit(60).all();

  // The improvement loop: questions that people almost always fail (unclear or wrong?) or never fail (too easy).
  const flagged = db.select({ q: questions, track: tracks.name, attempts, accuracy })
    .from(questions).innerJoin(answers, eq(answers.questionId, questions.id)).innerJoin(tracks, eq(tracks.id, questions.trackId))
    .where(eq(questions.status, "active")).groupBy(questions.id)
    .having(sql`count(${answers.id}) >= ${MIN_ATTEMPTS} and (avg(${answers.score}) < 0.25 or avg(${answers.score}) > 0.98)`)
    .limit(50).all();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Question bank</h1>
      <section>
        <h2 className="mb-2 font-semibold">Needs review ({flagged.length})</h2>
        <p className="mb-3 text-sm text-stone-500">Questions with {MIN_ATTEMPTS}+ attempts that are almost always failed (possibly unclear or wrong) or never failed (too easy).</p>
        {flagged.length === 0 && <p className="text-sm text-stone-500">Nothing flagged yet. Flags appear once learners have answered.</p>}
        <ul className="space-y-2">
          {flagged.map(({ q, track, attempts: n, accuracy: acc }) => (
            <li key={q.id} className="flex items-start gap-3 rounded border border-stone-200 p-3 text-sm dark:border-stone-800">
              <div className="flex-1">
                <div className="font-medium">{q.prompt}</div>
                <div className="text-stone-500">{track} · L{q.level} · {n} attempts · {Math.round(acc * 100)}% correct</div>
              </div>
              <form action={retireQuestion}>
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="status" value="retired" />
                <button className="underline">Retire</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Coverage by track</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-stone-500"><th>Track</th><th>Questions</th><th>Brand-authored</th><th>Answers</th></tr></thead>
          <tbody>
            {perTrack.map((r) => (
              <tr key={r.track} className="border-t border-stone-200 dark:border-stone-800">
                <td className="py-1">{r.track}</td><td>{r.total}</td><td>{r.authored ?? 0}</td><td>{r.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

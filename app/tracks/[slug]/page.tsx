import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brands, db, enrollments, questions, tracks } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { levelsPassed } from "@/lib/progress";
import { KIND_LABEL, LEVELS, PASS_MARK, QUESTIONS_PER_RUN } from "@/lib/levels";
import { enroll, startRun } from "@/app/actions";

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = db.select({ track: tracks, brand: brands }).from(tracks)
    .innerJoin(brands, eq(brands.id, tracks.brandId)).where(eq(tracks.slug, slug)).get();
  if (!row) notFound();
  const { track, brand } = row;

  const counts = new Map(
    db.select({ level: questions.level, n: sql<number>`count(*)` }).from(questions)
      .where(and(eq(questions.trackId, track.id), eq(questions.status, "active"))).groupBy(questions.level).all()
      .map((r) => [r.level, r.n]),
  );
  const user = await currentUser();
  const enrolment = user
    ? db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get()
    : undefined;
  const passed = user && enrolment ? levelsPassed(user.id, track.id) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-stone-500">{brand.name} · {KIND_LABEL[track.kind]}</div>
        <h1 className="text-2xl font-bold">{track.name}</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">{track.description}</p>
      </div>

      {!user ? (
        <p><Link href="/login" className="underline">Sign in</Link> to start this track.</p>
      ) : !enrolment ? (
        <form action={enroll} className="flex max-w-xl flex-col gap-2">
          <input type="hidden" name="trackId" value={track.id} />
          <label className="text-sm font-medium" htmlFor="goal">What do you want to achieve with this track?</label>
          <input id="goal" name="goal" maxLength={300} placeholder="e.g. Run discovery calls on my own by month two"
            className="rounded border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700" />
          <button className="self-start rounded bg-stone-900 px-4 py-2 text-white dark:bg-stone-100 dark:text-stone-900">Start this track</button>
        </form>
      ) : (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Goal: <strong>{enrolment.goal || "not set"}</strong> · Pass mark {PASS_MARK * 100}% on {QUESTIONS_PER_RUN} questions per attempt.
        </p>
      )}

      <ol className="grid gap-2 sm:grid-cols-2">
        {LEVELS.map((name, i) => {
          const level = i + 1, n = counts.get(level) ?? 0;
          const done = level <= passed, open = enrolment && level === passed + 1, empty = n === 0;
          return (
            <li key={level} className={`flex items-center gap-3 rounded-lg border p-3 ${open ? "border-stone-900 dark:border-stone-100" : "border-stone-200 dark:border-stone-800"} ${!done && !open ? "opacity-60" : ""}`}>
              <span className="w-8 text-right font-mono text-sm text-stone-500">{level}</span>
              <div className="flex-1">
                <div className="font-medium">{name} {done && <span aria-label="passed">✓</span>}</div>
                <div className="text-xs text-stone-500">{n} questions</div>
              </div>
              {open && !empty && (
                <form action={startRun}>
                  <input type="hidden" name="trackId" value={track.id} />
                  <input type="hidden" name="level" value={level} />
                  <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white dark:bg-stone-100 dark:text-stone-900">Start</button>
                </form>
              )}
              {open && empty && <span className="text-xs text-amber-600">No questions yet</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

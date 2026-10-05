import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { brands, checklistItems, db, enrollments, runs, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { levelsPassed } from "@/lib/progress";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";

export default async function Dashboard() {
  const user = await requireUser();
  const mine = db.select({ e: enrollments, t: tracks, b: brands }).from(enrollments)
    .innerJoin(tracks, eq(tracks.id, enrollments.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId))
    .where(eq(enrollments.userId, user.id)).all();
  const todo = db.select().from(checklistItems).where(eq(checklistItems.userId, user.id)).all();
  const attempts = db.select({ n: sql<number>`count(*)` }).from(runs).where(eq(runs.userId, user.id)).get()?.n ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hi {user.name}</h1>
        <p className="text-stone-500">{attempts} attempts so far · role: {user.jobRole}</p>
      </div>

      {todo.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Onboarding checklist</h2>
          <ul className="space-y-1 text-sm">
            {todo.map((c) => <li key={c.id}>{c.done ? "☑" : "☐"} {c.label}</li>)}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">My tracks</h2>
        {mine.length === 0 && <p className="text-stone-500">Nothing yet. <Link href="/" className="underline">Browse tracks</Link>.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {mine.map(({ e, t, b }) => {
            const passed = levelsPassed(user.id, t.id);
            return (
              <Link key={e.id} href={`/tracks/${t.slug}`} className="rounded-lg border border-stone-200 p-4 hover:border-stone-400 dark:border-stone-800">
                <div className="text-xs text-stone-500">{b.name}</div>
                <div className="font-medium">{t.name}</div>
                <div className="mt-2 h-2 rounded bg-stone-200 dark:bg-stone-800">
                  <div className="h-2 rounded bg-green-600" style={{ width: `${(passed / MAX_LEVEL) * 100}%` }} />
                </div>
                <div className="mt-1 text-sm text-stone-500">{passed === 0 ? "Not started" : `Level ${passed} · ${LEVELS[passed - 1]}`}</div>
                {e.goal && <div className="mt-1 text-sm">Goal: {e.goal}</div>}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

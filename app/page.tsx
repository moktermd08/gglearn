import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "@/lib/db";
import { KIND_LABEL, LEVELS } from "@/lib/levels";

export default function Home() {
  const rows = db
    .select({ track: tracks, brand: brands, n: sql<number>`(select count(*) from ${questions} q where q.track_id = ${tracks.id} and q.status = 'active')` })
    .from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).orderBy(asc(brands.name), asc(tracks.name)).all();
  const byBrand = Map.groupBy(rows, (r) => r.brand.name);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold">Training academy</h1>
        <p className="mt-2 max-w-2xl text-stone-600 dark:text-stone-400">
          Pick a track, set a goal, and climb {LEVELS.length} levels from {LEVELS[0]} to {LEVELS[LEVELS.length - 1]}.
          Each level is a fresh set of questions, so you learn the material instead of memorising a list.
        </p>
      </section>
      {[...byBrand].map(([brand, items]) => (
        <section key={brand}>
          <h2 className="mb-3 text-xl font-semibold">{brand}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ track, n }) => (
              <Link key={track.id} href={`/tracks/${track.slug}`}
                className="rounded-lg border border-stone-200 p-4 hover:border-stone-400 dark:border-stone-800 dark:hover:border-stone-600">
                <div className="text-xs uppercase tracking-wide text-stone-500">{KIND_LABEL[track.kind]}</div>
                <div className="font-medium">{track.name}</div>
                <div className="mt-1 text-sm text-stone-500">{n} questions</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

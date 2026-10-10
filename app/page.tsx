import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "@/lib/db";
import { KIND_LABEL, LEVELS, TIERS } from "@/lib/levels";
import { Avatar } from "@/components/Avatar";
import { SubjectArt } from "@/components/SubjectArt";
import { rivalFor } from "@/lib/rivals";
import { hiddenTrackIds } from "@/lib/tracks";

export default function Home() {
  const all = db
    .select({ track: tracks, brand: brands, n: sql<number>`(select count(*) from ${questions} q where q.track_id = ${tracks.id} and q.status = 'active')` })
    .from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).orderBy(asc(brands.name), asc(tracks.name)).all();
  const hidden = hiddenTrackIds();
  const rows = all.filter((r) => !hidden.has(r.track.id));
  const featured = rows.find((r) => r.track.slug === "git-titan");
  const byBrand = new Map<string, typeof rows>();
  for (const r of rows) byBrand.set(r.brand.name, [...(byBrand.get(r.brand.name) ?? []), r]);

  return (
    <div className="space-y-12">
      <section className="card relative overflow-hidden p-6 sm:p-10">
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">Learn head-to-head</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">Race a rival to <span className="gradient-text">Titan</span></h1>
          <p className="mt-4 text-slate-300">
            Every subject comes with a rival who trains every single day. Do daily quests, pass level exams, earn certificates, and
            climb {LEVELS.length} levels before they do.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={featured ? `/tracks/${featured.track.slug}` : "/login"} className="btn">Start with Git →</Link>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 items-end justify-center gap-2 sm:flex" aria-hidden>
          <div className="mb-4 bob"><Avatar kind="human" level={1} size={120} /></div>
          <div className="mb-10 text-3xl font-black text-white/30">VS</div>
          <div className="mb-4 bob [animation-delay:.6s]"><Avatar kind="rival" level={1} hue={rivalFor("git-titan").hue} size={120} /></div>
        </div>
      </section>

      <section className="card flex flex-wrap items-center gap-4 p-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">Race a bot, a friend or a whole group</h2>
          <p className="text-slate-300">Any topic, hard skill or soft skill. Set a goal and a deadline, pick your opponents, and keep the contest public to watch or private to your group.</p>
        </div>
        <Link href="/competitions" className="btn">See contests</Link>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Five ranks, twenty levels</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TIERS.map((t, i) => (
            <div key={t.name} className="card p-3 text-center">
              <Avatar kind="human" level={t.from} size={72} className="mx-auto" />
              <div className="mt-1 font-bold" style={{ color: `hsl(${t.hue} 85% 70%)` }}>{t.name}</div>
              <div className="text-xs text-slate-400">Levels {t.from}–{i === 4 ? 20 : t.from + 3}</div>
            </div>
          ))}
        </div>
      </section>

      {[...byBrand].map(([brand, items]) => (
        <section key={brand}>
          <h2 className="mb-3 text-xl font-bold">{brand}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ track, n }) => {
              const rv = rivalFor(track.slug);
              return (
                <Link key={track.id} href={`/tracks/${track.slug}`} className="card card-hover flex items-center gap-3 p-4">
                  <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={56} />
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-slate-400">{KIND_LABEL[track.kind]}</div>
                    <div className="truncate font-semibold">{track.name}</div>
                    <div className="text-xs text-slate-400">{n} questions · vs {rv.name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

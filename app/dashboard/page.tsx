import { eq } from "drizzle-orm";
import Link from "next/link";
import { brands, checklistItems, db, enrollments, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, TIERS, tierOf } from "@/lib/levels";
import { badgesFor, trackStats } from "@/lib/stats";
import { rivalFor } from "@/lib/rivals";
import { Avatar } from "@/components/Avatar";

export default async function Dashboard() {
  const user = await requireUser();
  const mine = db.select({ e: enrollments, t: tracks, b: brands }).from(enrollments)
    .innerJoin(tracks, eq(tracks.id, enrollments.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId))
    .where(eq(enrollments.userId, user.id)).all();
  const todo = db.select().from(checklistItems).where(eq(checklistItems.userId, user.id)).all();
  const stats = mine.map((m) => ({ ...m, s: trackStats(user.id, m.t, m.e.startedAt) }));
  const totalXp = stats.reduce((a, m) => a + m.s.xp, 0);
  const bestStreak = Math.max(0, ...stats.map((m) => m.s.streak));
  const badges = stats.length ? badgesFor(stats.sort((a, b) => b.s.xp - a.s.xp)[0].s) : [];

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center gap-6 p-6">
        <Avatar kind="human" level={Math.max(0, ...stats.map((m) => m.s.passed))} size={96} className="bob" />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">Welcome back, {user.name}</h1>
          <p className="text-slate-400">Your quest log: finish today&apos;s quests to keep the streak and stay ahead of your rivals.</p>
        </div>
        <div className="flex gap-6 text-center">
          <div><div className="text-3xl font-extrabold text-sky-300">{totalXp}</div><div className="text-xs text-slate-400">total XP</div></div>
          <div><div className="text-3xl font-extrabold text-orange-400">🔥 {bestStreak}</div><div className="text-xs text-slate-400">day streak</div></div>
        </div>
      </div>

      {todo.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Onboarding checklist</h2>
          <ul className="space-y-1 text-sm text-slate-300">{todo.map((c) => <li key={c.id}>{c.done ? "☑" : "☐"} {c.label}</li>)}</ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">My races</h2>
        {mine.length === 0 && <p className="text-slate-400">Nothing yet. <Link href="/" className="underline">Pick a subject and meet your rival</Link>.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map(({ e, t, b, s }) => {
            const rv = rivalFor(t.slug), tier = TIERS[tierOf(s.passed)];
            const lead = s.passed - s.rival.level;
            return (
              <Link key={e.id} href={`/tracks/${t.slug}`} className="card card-hover p-4">
                <div className="flex items-center gap-3">
                  <Avatar kind="human" level={s.passed} size={56} />
                  <span className="text-xs font-black text-slate-500">VS</span>
                  <Avatar kind="rival" level={s.rival.level} hue={rv.hue} size={56} />
                  <div className="ml-auto text-right">
                    <div className={`text-sm font-bold ${lead > 0 ? "text-emerald-300" : lead === 0 ? "text-amber-300" : "text-rose-300"}`}>
                      {lead > 0 ? `+${lead} ahead` : lead === 0 ? "Tied" : `${lead} behind`}
                    </div>
                    <div className="text-xs text-slate-400">{rv.name} · L{s.rival.level}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400">{b.name}</div>
                <div className="font-semibold">{t.name}</div>
                <div className="bar mt-2"><i style={{ width: `${(s.passed / MAX_LEVEL) * 100}%` }} /></div>
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>{s.passed === 0 ? "Not started" : `Level ${s.passed} · ${LEVELS[s.passed - 1]} · ${tier.name}`}</span>
                  <span>🔥 {s.streak} · {s.xp} XP · {s.doneToday.size}/3 today</span>
                </div>
                {e.goal && <div className="mt-1 text-xs text-slate-300">🎯 {e.goal}</div>}
              </Link>
            );
          })}
        </div>
      </section>

      {badges.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Badges</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((x) => (
              <div key={x.key} title={x.desc} className={`card w-28 p-3 text-center ${x.earned ? "" : "opacity-40 grayscale"}`}>
                <div className="text-3xl">{x.icon}</div><div className="text-xs font-semibold">{x.name}</div><div className="text-[10px] text-slate-400">{x.desc}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

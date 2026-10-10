import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brands, db, enrollments, questions, tracks } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { CERT_LEVELS, KIND_LABEL, LEVELS, PASS_MARK, QUESTIONS_PER_RUN, TIERS, certTitle, tierOf } from "@/lib/levels";
import { QUEST_LABEL, QUEST_XP, badgesFor, trackStats } from "@/lib/stats";
import { rivalFor } from "@/lib/rivals";
import { enroll, startRun } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { SubjectArt } from "@/components/SubjectArt";
import { RaceTrack } from "@/components/RaceTrack";
import { RankEmblem } from "@/components/RankEmblem";

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = db.select({ track: tracks, brand: brands }).from(tracks)
    .innerJoin(brands, eq(brands.id, tracks.brandId)).where(eq(tracks.slug, slug)).get();
  if (!row) notFound();
  const { track, brand } = row;
  const rival = rivalFor(track.slug);

  const counts = new Map(
    db.select({ level: questions.level, n: sql<number>`count(*)` }).from(questions)
      .where(and(eq(questions.trackId, track.id), eq(questions.status, "active"))).groupBy(questions.level).all()
      .map((r) => [r.level, r.n]),
  );
  const user = await currentUser();
  const enrolment = user
    ? db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get()
    : undefined;
  const s = user && enrolment ? trackStats(user.id, track, enrolment.startedAt) : null;
  const passed = s?.passed ?? 0;
  const next = Math.min(20, passed + 1);

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center gap-6 p-6">
        <div className="flex items-end gap-1">
          <Avatar kind="human" level={passed} size={88} className="bob" />
          <span className="mb-8 text-xl font-black text-white/30">VS</span>
          <Avatar kind="rival" level={s?.rival.level ?? 0} hue={rival.hue} size={88} className="bob [animation-delay:.5s]" />
        </div>
        <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={96} className="shadow-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-indigo-300">{brand.name} · {KIND_LABEL[track.kind]}</div>
          <h1 className="text-3xl font-extrabold">{track.name}</h1>
          <p className="mt-1 text-slate-300">{track.description}</p>
          <p className="mt-1 text-sm text-slate-400">Your rival: <b className="text-white">{rival.name}</b>, {rival.tagline}.</p>
        </div>
        {s && (
          <div className="flex gap-5 text-center">
            <div><div className="text-2xl font-extrabold text-sky-300">{s.xp}</div><div className="text-xs text-slate-400">XP</div></div>
            <div><div className="text-2xl font-extrabold text-orange-400">🔥 {s.streak}</div><div className="text-xs text-slate-400">streak</div></div>
            <div><div className="text-2xl font-extrabold" style={{ color: `hsl(${TIERS[tierOf(passed)].hue} 85% 70%)` }}>{TIERS[tierOf(passed)].name}</div><div className="text-xs text-slate-400">rank</div></div>
          </div>
        )}
      </div>

      {!user ? (
        <p className="card p-4"><Link href="/login" className="underline">Sign in</Link> to take on {rival.name}.</p>
      ) : !enrolment ? (
        <form action={enroll} className="card flex max-w-xl flex-col gap-2 p-5">
          <input type="hidden" name="trackId" value={track.id} />
          <label className="font-semibold" htmlFor="goal">Set your goal. {rival.name} already has one.</label>
          <input id="goal" name="goal" maxLength={300} placeholder="e.g. Reach Titan in Git by the end of the quarter"
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
          <button className="btn self-start">Accept the challenge ⚔️</button>
        </form>
      ) : (
        <>
          <RaceTrack you={user.name.split(" ")[0]} rival={rival} youLevel={passed} rivalLevel={s!.rival.level} />

          <section>
            <h2 className="mb-3 text-lg font-bold">Daily quests <span className="text-sm font-normal text-slate-400">· {enrolment.goal && `🎯 ${enrolment.goal}`}</span></h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["study", "drill", "exam"] as const).map((k) => {
                const done = s!.doneToday.has(k);
                const href = k === "study" ? `/tracks/${track.slug}/learn/${next}` : k === "drill" ? `/tracks/${track.slug}/drill` : "#levels";
                return (
                  <Link key={k} href={href} className={`card card-hover flex items-center gap-3 p-4 ${done ? "border-emerald-400/50" : ""}`}>
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-500/20 text-2xl">{done ? "✅" : k === "study" ? "📖" : k === "drill" ? "⚡" : "🏆"}</div>
                    <div className="flex-1"><div className="font-semibold">{QUEST_LABEL[k][0]}</div><div className="text-xs text-slate-400">{QUEST_LABEL[k][1]}</div></div>
                    <div className="text-sm font-bold text-sky-300">+{QUEST_XP[k]}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section id="levels">
        <h2 className="mb-3 text-lg font-bold">The climb · pass mark {PASS_MARK * 100}% · {QUESTIONS_PER_RUN} questions per exam</h2>
        <div className="space-y-6">
          {TIERS.map((tier, ti) => (
            <div key={tier.name}>
              <div className="mb-2 text-sm font-bold uppercase tracking-widest" style={{ color: `hsl(${tier.hue} 85% 70%)` }}>{tier.name} rank</div>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {LEVELS.slice(ti * 4, ti * 4 + 4).map((name, j) => {
                  const level = ti * 4 + j + 1, n = counts.get(level) ?? 0;
                  const done = level <= passed, open = !!enrolment && level === passed + 1;
                  const cert = (CERT_LEVELS as readonly number[]).includes(level);
                  const mine = s?.certs.find((c) => c.level === level);
                  return (
                    <li key={level} className={`card flex flex-col items-center gap-2 p-4 text-center ${open ? "border-indigo-400 shadow-[0_0_30px_-8px_rgba(129,140,248,.8)]" : ""}`}>
                      <RankEmblem level={level} state={done ? "done" : open ? "current" : "locked"} />
                      <div className="font-semibold">{name}{done && " ✓"}</div>
                      <div className="text-xs text-slate-400">{n} questions{cert && ` · 🎓 ${certTitle(level)} certificate`}</div>
                      {mine && <Link href={`/cert/${mine.code}`} className="text-xs text-amber-300 underline">View certificate</Link>}
                      {open && n > 0 && (
                        <div className="flex gap-2">
                          <Link href={`/tracks/${track.slug}/learn/${level}`} className="btn btn-ghost !px-3 !py-1 text-sm">Study</Link>
                          <form action={startRun}>
                            <input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} />
                            <button className="btn !px-3 !py-1 text-sm">Exam</button>
                          </form>
                        </div>
                      )}
                      {open && n === 0 && <span className="text-xs text-amber-400">No questions yet</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {s && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Badges</h2>
          <div className="flex flex-wrap gap-3">
            {badgesFor(s).map((b) => (
              <div key={b.key} title={b.desc} className={`card w-28 p-3 text-center ${b.earned ? "" : "opacity-40 grayscale"}`}>
                <div className="text-3xl">{b.icon}</div><div className="text-xs font-semibold">{b.name}</div><div className="text-[10px] text-slate-400">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

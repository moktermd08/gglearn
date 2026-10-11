import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brands, db, enrollments, questions, tracks } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { openTo } from "@/lib/paths";
import { CERT_LEVELS, KIND_LABEL, LEVELS, PASS_MARK, QUESTIONS_PER_RUN, TIERS, certTitle, tierOf } from "@/lib/levels";
import { QUEST_LABEL, QUEST_XP, badgesFor, trackStats } from "@/lib/stats";
import { rivalFor } from "@/lib/rivals";
import { enroll, startRun } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { SubjectArt } from "@/components/SubjectArt";
import { RaceTrack } from "@/components/RaceTrack";
import { RankEmblem } from "@/components/RankEmblem";
import { Ring } from "@/components/Ring";
import { ArrowRight, BookOpen, Check, CheckCircle2, Crown, Flame, GraduationCap, ListChecks, Lock, LogIn, Medal, Mountain, Sparkles, Swords, Target, Trophy, Zap } from "lucide-react";

const QUEST_ICON = { study: BookOpen, drill: Zap, exam: Trophy } as const;

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
  if (user && !openTo(user.audience, track.audience)) notFound(); // customers never see staff-only tracks
  const enrolment = user
    ? db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get()
    : undefined;
  const s = user && enrolment ? trackStats(user.id, track, enrolment.startedAt) : null;
  const passed = s?.passed ?? 0;
  const next = Math.min(20, passed + 1);
  const maxN = Math.max(1, ...counts.values());
  const questsDone = s?.doneToday.size ?? 0;

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
        {s && <Ring pct={passed / 20} label={`${passed}/20`} sub="levels" size={108} color={`hsl(${TIERS[tierOf(passed)].hue} 85% 65%)`} />}
      </div>

      {s && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: Sparkles, label: "XP", value: s.xp, cls: "text-sky-300" },
            { Icon: Flame, label: "Day streak", value: s.streak, cls: "text-orange-400" },
            { Icon: Medal, label: "Rank", value: TIERS[tierOf(passed)].name, color: `hsl(${TIERS[tierOf(passed)].hue} 85% 70%)` },
          ].map(({ Icon, label, value, cls, color }, i) => (
            <div key={label} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
              <Icon size={22} className={`mx-auto ${cls ?? ""} ${label === "Day streak" && s.streak > 0 ? "pulse-glow" : ""}`} style={color ? { color } : undefined} />
              <div className="mt-1 text-2xl font-extrabold" style={color ? { color } : undefined}>{value}</div>
              <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!user ? (
        <p className="card flex items-center gap-2 p-4"><LogIn size={18} className="text-indigo-300" /><span><Link href="/login" className="underline">Sign in</Link> to take on {rival.name}.</span></p>
      ) : !enrolment ? (
        <form action={enroll} className="card flex max-w-xl flex-col gap-2 p-5">
          <input type="hidden" name="trackId" value={track.id} />
          <label className="flex items-center gap-2 font-semibold" htmlFor="goal"><Target size={18} className="text-pink-300" />Set your goal. {rival.name} already has one.</label>
          <input id="goal" name="goal" maxLength={300} placeholder="e.g. Reach Titan in Git by the end of the quarter"
            className="rounded-lg border border-white/15 bg-[#fff] px-3 py-2" />
          <button className="btn self-start">Accept the challenge<Swords size={16} /></button>
        </form>
      ) : (
        <>
          <RaceTrack you={user.name.split(" ")[0]} rival={rival} youLevel={passed} rivalLevel={s!.rival.level} />

          <section>
            <h2 className="mb-2 flex flex-wrap items-center gap-2 text-lg font-bold"><ListChecks size={20} className="text-emerald-300" />Daily quests <span className="text-sm font-normal text-slate-400">· {questsDone}/3 done</span>{enrolment.goal && <span className="flex items-center gap-1 text-sm font-normal text-slate-400">· <Target size={13} className="text-pink-300" />{enrolment.goal}</span>}</h2>
            <div className="bar mb-3"><i style={{ width: `${(questsDone / 3) * 100}%`, background: questsDone === 3 ? "#34d399" : undefined }} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["study", "drill", "exam"] as const).map((k, qi) => {
                const QIcon = QUEST_ICON[k];
                const done = s!.doneToday.has(k);
                const href = k === "study" ? `/tracks/${track.slug}/learn/${next}` : k === "drill" ? `/tracks/${track.slug}/drill` : "#levels";
                return (
                  <Link key={k} href={href} className={`card card-hover rise flex items-center gap-3 p-4 ${done ? "border-emerald-400/50" : ""}`} style={{ "--i": qi } as React.CSSProperties}>
                    <div className={`grid h-12 w-12 place-items-center rounded-full ${done ? "bg-emerald-500/25 text-emerald-300" : "bg-indigo-500/20 text-indigo-200"}`}>{done ? <CheckCircle2 size={26} className="spin-in" /> : <QIcon size={24} />}</div>
                    <div className="flex-1"><div className="font-semibold">{QUEST_LABEL[k][0]}</div><div className="text-xs text-slate-400">{QUEST_LABEL[k][1]}</div></div>
                    <div className="flex items-center gap-1 text-sm font-bold text-sky-300"><Sparkles size={13} />+{QUEST_XP[k]}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section id="levels">
        <h2 className="mb-2 flex flex-wrap items-center gap-2 text-lg font-bold"><Mountain size={20} className="text-violet-300" />The climb <span className="text-sm font-normal text-slate-400">· pass mark {PASS_MARK * 100}% · {QUESTIONS_PER_RUN} questions per exam</span></h2>
        {enrolment && <div className="mb-4 flex items-center gap-3 text-xs text-slate-400"><div className="bar flex-1"><i style={{ width: `${(passed / 20) * 100}%` }} /></div><span className="flex items-center gap-1"><Crown size={13} className="text-amber-300" />{passed}/20</span></div>}
        <div className="space-y-6">
          {TIERS.map((tier, ti) => (
            <div key={tier.name}>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-widest" style={{ color: `hsl(${tier.hue} 85% 70%)` }}>
                <Medal size={16} />{tier.name} rank
                {enrolment && <span className="ml-auto flex items-center gap-2 text-xs normal-case tracking-normal text-slate-400">
                  {Math.max(0, Math.min(4, passed - ti * 4))}/4
                  <span className="flex gap-0.5">{[0, 1, 2, 3].map((n) => <i key={n} className="h-2 w-5 rounded-full" style={{ background: ti * 4 + n < passed ? `hsl(${tier.hue} 85% 65%)` : "rgba(148,163,184,.25)" }} />)}</span>
                </span>}
              </div>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {LEVELS.slice(ti * 4, ti * 4 + 4).map((name, j) => {
                  const level = ti * 4 + j + 1, n = counts.get(level) ?? 0;
                  const done = level <= passed, open = !!enrolment && level === passed + 1;
                  const cert = (CERT_LEVELS as readonly number[]).includes(level);
                  const mine = s?.certs.find((c) => c.level === level);
                  return (
                    <li key={level} style={{ "--i": j } as React.CSSProperties} className={`card rise flex flex-col items-center gap-2 p-4 text-center ${!done && !open ? "opacity-70" : ""} ${open ? "border-indigo-400 shadow-[0_0_30px_-8px_rgba(129,140,248,.8)]" : ""}`}>
                      <RankEmblem level={level} state={done ? "done" : open ? "current" : "locked"} />
                      <div className="flex items-center gap-1 font-semibold">{name}{done && <Check size={15} className="text-emerald-400" />}{!done && !open && enrolment && <Lock size={12} className="text-slate-500" />}</div>
                      <div className="flex w-full items-center gap-2 text-xs text-slate-400" title={`${n} questions`}>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><i className="grow block h-full rounded-full bg-sky-400/70" style={{ width: `${(n / maxN) * 100}%`, "--i": j } as React.CSSProperties} /></span>
                        <span className="shrink-0">{n} Qs</span>
                      </div>
                      {cert && <div className="flex items-center gap-1 text-xs text-amber-300"><GraduationCap size={13} />{certTitle(level)} certificate</div>}
                      {mine && <Link href={`/cert/${mine.code}`} className="inline-flex items-center gap-1 text-xs text-amber-300 underline"><GraduationCap size={13} />View certificate</Link>}
                      {open && n > 0 && (
                        <div className="flex gap-2">
                          <Link href={`/tracks/${track.slug}/learn/${level}`} className="btn btn-ghost !px-3 !py-1 text-sm"><BookOpen size={14} />Study</Link>
                          <form action={startRun}>
                            <input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} />
                            <button className="btn !px-3 !py-1 text-sm">Exam<ArrowRight size={14} /></button>
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
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Medal size={20} className="text-yellow-300" />Badges <span className="text-xs font-normal text-slate-400">{badgesFor(s).filter((b) => b.earned).length}/{badgesFor(s).length} earned</span></h2>
          <div className="flex flex-wrap gap-3">
            {badgesFor(s).map((b, i) => (
              <div key={b.key} title={b.desc} style={{ "--i": i } as React.CSSProperties} className={`card rise relative w-28 p-3 text-center ${b.earned ? "pop border-yellow-400/40" : "opacity-40 grayscale"}`}>
                {!b.earned && <Lock size={12} className="absolute right-2 top-2 text-slate-400" />}
                <div className="text-3xl">{b.icon}</div><div className="text-xs font-semibold">{b.name}</div><div className="text-[10px] text-slate-400">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

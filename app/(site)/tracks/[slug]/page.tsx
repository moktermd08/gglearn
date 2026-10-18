import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brands, db, enrollments, lessons, questions, tracks } from "@/lib/db";
import { LevelDetail, type LevelDetailData } from "@/components/LevelDetail";
import { LEVEL_INFO } from "@/lib/levelInfo";
import { currentUser } from "@/lib/auth";
import { openTo, requirementsFor, scopesOf } from "@/lib/paths";
import { gateFor } from "@/lib/onboarding";
import { orderLockFor } from "@/lib/journeyLock";
import { now } from "@/lib/competitions";
import { CERT_LEVELS, KIND_LABEL, LEVELS, PASS_MARK, QUESTIONS_PER_RUN, TIERS, certTitle, tierOf } from "@/lib/levels";
import { QUEST_LABEL, QUEST_XP, badgesFor, trackStats } from "@/lib/stats";
import { rivalFor } from "@/lib/rivals";
import { enroll, startRun } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { SubjectArt, artFor } from "@/components/SubjectArt";
import { RaceTrack } from "@/components/RaceTrack";
import { AvatarPicker } from "@/components/AvatarPicker";
import { avatarLooks } from "@/lib/avatars";
import { RankEmblem } from "@/components/RankEmblem";
import { Ring } from "@/components/Ring";
import { AlertTriangle, ArrowRight, Hourglass, Info, ShieldCheck, BookOpen, Check, CheckCircle2, Crown, Flame, GraduationCap, ListChecks, Lock, LogIn, Medal, Mountain, Sparkles, Swords, Target, Trophy, Zap } from "lucide-react";

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
  // per level: how the pool splits by question type and how long a question takes, the commonest topics, and the study guide outline
  const byType = db.select({ level: questions.level, type: questions.type, n: sql<number>`count(*)`, t: sql<number>`avg(${questions.timeSec})` }).from(questions)
    .where(and(eq(questions.trackId, track.id), eq(questions.status, "active"))).groupBy(questions.level, questions.type).all();
  const topicRows = db.select({ level: questions.level, topic: questions.topic, n: sql<number>`count(*)` }).from(questions)
    .where(and(eq(questions.trackId, track.id), eq(questions.status, "active"), sql`${questions.topic} is not null and ${questions.topic} != ''`)).groupBy(questions.level, questions.topic).orderBy(sql`count(*) desc`).all();
  const lessonByLevel = new Map(db.select().from(lessons).where(eq(lessons.trackId, track.id)).all().map((l) => [l.level, l]));
  const detailFor = (level: number, state: LevelDetailData["state"]): LevelDetailData => {
    const rows = byType.filter((r) => r.level === level), total = rows.reduce((a, r) => a + r.n, 0);
    const avgSec = total ? rows.reduce((a, r) => a + r.t * r.n, 0) / total : 60;
    const get = (t: string) => rows.find((r) => r.type === t)?.n ?? 0;
    const tier = TIERS[tierOf(level)], info = LEVEL_INFO[level - 1], nxt = LEVEL_INFO[level];
    const lesson = lessonByLevel.get(level);
    return {
      level, name: LEVELS[level - 1], tier: tier.name, hue: tier.hue, state, meaning: info.meaning, expect: info.expect,
      questions: total, perExam: Math.min(QUESTIONS_PER_RUN, total) || QUESTIONS_PER_RUN, minutes: Math.max(1, Math.round((QUESTIONS_PER_RUN * avgSec) / 60)), passPct: PASS_MARK * 100,
      topics: topicRows.filter((r) => r.level === level).slice(0, 6).map((r) => r.topic as string), syllabus: lesson?.syllabus.slice(0, 6) ?? [], lessonTitle: lesson?.title ?? null,
      cert: (CERT_LEVELS as readonly number[]).includes(level) ? certTitle(level) : null, prev: level > 1 ? LEVELS[level - 2] : null, next: level < 20 ? LEVELS[level] : null,
      types: { mcq: get("mcq"), open: get("open"), scenario: get("scenario") }, nextMeaning: nxt?.meaning ?? null, nextExpect: nxt?.expect ?? null,
    };
  };
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
  const looks = await avatarLooks();
  const accent = artFor(track.slug, track.name, track.kind).color;
  const totalQs = [...counts.values()].reduce((a, b) => a + b, 0);
  // is this subject required of the person looking at it? then say what, and by when, right where they will act on it
  const req = user && enrolment ? requirementsFor(user, scopesOf(user.id)).find((r) => r.track.id === track.id) : undefined;
  const signGate = user && enrolment ? gateFor(user.id, track.id) : null;
  // an earlier stage of this person's learning journey is not passed yet (lib/journeyLock.ts)
  const orderLock = user && enrolment ? orderLockFor(user.id, track.id) : null;
  const gate = signGate ?? (orderLock ? { phase: "", waitingOn: "" } : null);
  const reqDays = req ? Math.ceil((req.dueAt - now()) / 86400) : 0;

  return (
    <div className="space-y-8">
      <div className="card pop relative flex flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden p-6" style={{ background: `linear-gradient(120deg, ${accent}26, #ffffff 60%)` }}>
        <svg className="pointer-events-none absolute -right-10 -top-14 h-72 w-72" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke={accent} strokeOpacity=".18" /><circle cx="120" cy="80" r="58" fill="none" stroke={accent} strokeOpacity=".25" strokeDasharray="4 6" className="march" /></svg>
        <div className="flex items-end gap-1">
          <Avatar kind="human" level={passed} size={88} className="bob" look={looks.me} photoUrl={looks.photoUrl} />
          <span className="mb-8 text-xl font-black text-white/30">VS</span>
          <Avatar kind="rival" level={s?.rival.level ?? 0} hue={rival.hue} size={88} className="bob [animation-delay:.5s]" look={looks.rival} />
        </div>
        <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={96} className="shadow-lg" />
        <div className="order-last min-w-0 basis-full xl:order-none xl:basis-0 xl:flex-1">
          <div className="text-xs uppercase tracking-widest text-indigo-300">{brand.name} · {KIND_LABEL[track.kind]}</div>
          <h1 className="text-3xl font-extrabold">{track.name}</h1>
          <AvatarPicker me={looks.me} rival={looks.rival} photoUrl={looks.photoUrl} signedIn={looks.signedIn} level={passed} rivalLevel={s?.rival.level ?? 0} rivalHue={rival.hue} className="mt-2" />
          <p className="mt-1 text-slate-300">{track.description}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><ListChecks size={12} />{totalQs.toLocaleString("en-GB")} questions</span><span className="inline-flex items-center gap-1"><Mountain size={12} />20 levels</span><span className="inline-flex items-center gap-1"><Target size={12} />{PASS_MARK * 100}% to pass</span></p>
          <p className="mt-1 text-sm text-slate-400">Your rival: <b className="text-white">{rival.name}</b>, {rival.tagline}.</p>
        </div>
        {s && <Ring pct={passed / 20} label={`${passed}/20`} sub="levels" size={108} color={`hsl(${TIERS[tierOf(passed)].hue} 85% 65%)`} />}
      </div>

      {s && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: Sparkles, label: "XP", value: s.xp, cls: "text-sky-300" },
            { Icon: Flame, label: "Day streak", value: s.streak, cls: "text-orange-400" },
            { Icon: Medal, label: "Rank", value: TIERS[tierOf(passed)].name, color: `hsl(${TIERS[tierOf(passed)].hue} 70% 35%)` },
          ].map(({ Icon, label, value, cls, color }, i) => (
            <div key={label} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
              <Icon size={22} className={`mx-auto ${cls ?? ""} ${label === "Day streak" && s.streak > 0 ? "pulse-glow" : ""}`} style={color ? { color } : undefined} />
              <div className="mt-1 text-2xl font-extrabold" style={color ? { color } : undefined}>{value}</div>
              <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {req && (
        <section role="status" aria-label="Required learning" className={`card flex flex-wrap items-center gap-3 p-4 text-sm ${req.done ? "border-emerald-400/40" : req.overdue ? "border-rose-400/50" : "border-indigo-300/40"}`}>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${req.done ? "bg-emerald-500/15 text-emerald-400" : req.overdue ? "bg-rose-500/15 text-rose-400" : "bg-indigo-500/15 text-indigo-400"}`}>{req.done ? <ShieldCheck size={18} /> : req.overdue ? <AlertTriangle size={18} /> : <Hourglass size={18} />}</span>
          <span className="min-w-0 flex-1">
            <b>{req.done ? "Required learning: passed." : `${req.why === "mandatory" ? "Mandatory for everyone" : "Required for your role"}: pass level ${track.requiredLevel}.`}</b>{" "}
            {!req.done && (req.overdue ? `It was due ${Math.abs(reqDays)} day${Math.abs(reqDays) === 1 ? "" : "s"} ago. Finish it as soon as you can.` : `${reqDays} day${reqDays === 1 ? "" : "s"} left (due ${new Date(req.dueAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}). You are on level ${Math.min(req.passed, track.requiredLevel)} of ${track.requiredLevel}.`)}
          </span>
        </section>
      )}

      {!user ? (
        <p className="card flex items-center gap-2 p-4"><LogIn size={18} className="text-indigo-300" /><span><Link href="/login" className="underline">Sign in</Link> to take on {rival.name}.</span></p>
      ) : totalQs === 0 ? (
        <p role="status" className="card flex items-center gap-2 p-4 text-sm"><Hourglass size={18} className="text-amber-400" /><span><b>Coming soon.</b> The questions for this subject are still being written and checked, so there is nothing to take yet.</span></p>
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
          {!signGate && orderLock && (
            <section aria-label="Locked until earlier stages are passed" className="card flex items-start gap-3 border-violet-300/40 p-4 text-sm">
              <Lock size={18} className="mt-0.5 shrink-0 text-violet-400" />
              <div className="space-y-1.5">
                <p><b>Exams are locked for now.</b> This is stage {orderLock.stage} of your learning journey. Pass {orderLock.waitingOn.map((w) => w.name).join(", ") || "the stage before"} first. You can still read the study guides.</p>
                <p className="flex flex-wrap gap-3">
                  {orderLock.waitingOn[0] && <Link href={`/tracks/${orderLock.waitingOn[0].slug}`} className="font-semibold text-indigo-300 hover:underline">Go to {orderLock.waitingOn[0].name}</Link>}
                  <Link href={`/start/${track.slug}`} className="font-semibold text-indigo-300 hover:underline">I already know this: test out</Link>
                  <Link href="/map" className="font-semibold text-indigo-300 hover:underline">See my journey on the map</Link>
                </p>
              </div>
            </section>
          )}
          {signGate && (
            <section aria-label="Locked until sign-off" className="card flex items-start gap-3 border-violet-300/40 p-4 text-sm">
              <Lock size={18} className="mt-0.5 shrink-0 text-violet-400" />
              <p><b>Exams are locked for now.</b> This is part of {signGate.phase}, which opens once your manager signs off {signGate.waitingOn}. You can still read the study guides.</p>
            </section>
          )}
          {passed < 20 && (
            <section aria-label="Next up" className="card flex flex-wrap items-center gap-3 border-indigo-300/40 p-4">
              <RankEmblem level={next} state="current" size={48} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">Next up</div>
                <div className="font-extrabold">Level {next} · {LEVELS[next - 1]}</div>
                <div className="text-xs text-slate-400">{passed === 0 ? "Read the guide first if the subject is new to you, then take the exam." : "Keep going: pass this level to unlock the next."}</div>
              </div>
              <Link href={`/tracks/${track.slug}/learn/${next}`} className="btn btn-ghost"><BookOpen size={16} />Study guide</Link>
              {gate ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={13} />Locked</span> : <form action={startRun}><input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={next} /><button className="btn">Take the exam<ArrowRight size={16} /></button></form>}
            </section>
          )}
          <RaceTrack you={user.name.split(" ")[0]} rival={rival} youLevel={passed} rivalLevel={s!.rival.level} meLook={looks.me} rivalLook={looks.rival} photoUrl={looks.photoUrl} />

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
        <h2 className="mb-2 flex flex-wrap items-center gap-2 text-lg font-bold"><Mountain size={20} className="text-violet-300" />The climb <span className="text-sm font-normal text-slate-400">· pass mark {PASS_MARK * 100}% · up to {QUESTIONS_PER_RUN} questions per exam</span></h2>
        {enrolment && <div className="mb-4 flex items-center gap-3 text-xs text-slate-400"><div className="bar flex-1"><i style={{ width: `${(passed / 20) * 100}%` }} /></div><span className="flex items-center gap-1"><Crown size={13} className="text-amber-300" />{passed}/20</span></div>}
        <div className="space-y-8">
          {TIERS.map((tier, ti) => {
            const got = Math.max(0, Math.min(4, passed - ti * 4)), tierDone = got === 4, tierOpen = !!enrolment && passed >= ti * 4 && !tierDone, tierLocked = !!enrolment && passed < ti * 4;
            const col = `hsl(${tier.hue} 70% 45%)`;
            return (
            <div key={tier.name} className="space-y-3">
              <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl px-4 py-3" style={{ background: `linear-gradient(100deg, hsl(${tier.hue} 85% 55% / ${tierLocked ? 0.1 : 0.22}), transparent 75%)`, border: `1px solid hsl(${tier.hue} 70% 50% / .25)` }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#fff]" style={{ background: `linear-gradient(135deg, hsl(${tier.hue} 85% 58%), hsl(${tier.hue} 80% 38%))`, opacity: tierLocked ? 0.55 : 1 }}>{tierDone ? <Check size={18} /> : tierLocked ? <Lock size={16} /> : <Medal size={18} />}</span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold uppercase tracking-widest" style={{ color: col }}>{tier.name} rank</div>
                  <div className="text-xs text-slate-400">Levels {ti * 4 + 1} to {ti * 4 + 4}{tierLocked ? ` · unlocks after level ${ti * 4}` : tierDone ? " · complete" : ""}</div>
                </div>
                {enrolment && <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                  {got}/4
                  <span className="flex gap-1">{[0, 1, 2, 3].map((n) => <i key={n} className="h-2 w-6 rounded-full" style={{ background: ti * 4 + n < passed ? `hsl(${tier.hue} 85% 55%)` : `hsl(${tier.hue} 40% 50% / .18)` }} />)}</span>
                </span>}
              </div>
              <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {LEVELS.slice(ti * 4, ti * 4 + 4).map((name, j) => {
                  const level = ti * 4 + j + 1, n = counts.get(level) ?? 0;
                  const done = level <= passed, open = !!enrolment && level === passed + 1;
                  const cert = (CERT_LEVELS as readonly number[]).includes(level);
                  const mine = s?.certs.find((c) => c.level === level);
                  return (
                    <li key={level} style={{ "--i": j, borderTop: `3px solid hsl(${tier.hue} 80% 55% / ${done || open || !enrolment ? 1 : 0.35})`, boxShadow: open ? `0 0 34px -8px hsl(${tier.hue} 85% 55%)` : undefined } as React.CSSProperties}
                      className={`card card-hover rise relative flex flex-col items-center gap-2 p-4 text-center [&>*]:pointer-events-none [&>button]:pointer-events-auto [&_a]:pointer-events-auto [&_a]:relative [&_a]:z-10 [&_form]:pointer-events-auto [&_form]:relative [&_form]:z-10 ${enrolment && !done && !open ? "bg-[#fbfaf6]" : ""}`}>
                      <LevelDetail d={detailFor(level, done ? "done" : open ? "current" : enrolment ? "locked" : "preview")} actions={open && n > 0 ? (<>
                        <Link href={`/tracks/${track.slug}/learn/${level}`} className="btn btn-ghost !px-3 !py-1 text-sm"><BookOpen size={14} />Study</Link>
                        {gate ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={13} />Locked</span> : <form action={startRun}><input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} /><button className="btn !px-3 !py-1 text-sm">Take the exam<ArrowRight size={14} /></button></form>}
                      </>) : undefined} />
                      <span className="absolute right-2 top-2 text-slate-500" aria-hidden><Info size={14} /></span>
                      {j < 3 && <span className="pointer-events-none absolute -right-3 top-12 hidden w-3 border-t-2 border-dashed border-black/15 lg:block" aria-hidden />}
                      {open && <span className="absolute -top-3 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#fff] shadow" style={{ background: col }}>You are here</span>}
                      <RankEmblem level={level} state={done ? "done" : open ? "current" : enrolment ? "locked" : "preview"} size={64} />
                      <div className={`font-bold ${enrolment && !done && !open ? "text-slate-400" : ""}`}>{name}</div>
                      <div className="flex w-full items-center gap-2 text-xs text-slate-400" title={`${n} questions`}>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><i className="grow block h-full rounded-full" style={{ width: `${(n / maxN) * 100}%`, background: `hsl(${tier.hue} 75% 55% / .8)`, "--i": j } as React.CSSProperties} /></span>
                        <span className="shrink-0">{n} Qs</span>
                      </div>
                      {cert && <div className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300"><GraduationCap size={13} />{certTitle(level)} certificate</div>}
                      {mine && <Link href={`/cert/${mine.code}`} className="inline-flex items-center gap-1 text-xs text-amber-300 underline"><GraduationCap size={13} />View certificate</Link>}
                      {open && n > 0 && (
                        <div className="flex flex-wrap justify-center gap-2">
                          <Link href={`/tracks/${track.slug}/learn/${level}`} className="btn btn-ghost !px-3 !py-1 text-sm"><BookOpen size={14} />Study</Link>
                          {gate ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={13} />Locked</span> : <form action={startRun}>
                            <input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} />
                            <button className="btn !px-3 !py-1 text-sm">Exam<ArrowRight size={14} /></button>
                          </form>}
                        </div>
                      )}
                      {open && n === 0 && <span className="text-xs text-amber-400">No questions yet</span>}
                      {!done && !open && enrolment && <span className="text-[11px] font-semibold text-slate-500">Pass level {level - 1} to unlock</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
            );
          })}
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

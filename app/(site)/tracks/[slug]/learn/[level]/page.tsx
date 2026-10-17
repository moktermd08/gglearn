import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, enrollments, lessons, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, PASS_MARK, QUESTIONS_PER_RUN, TIERS, tierOf } from "@/lib/levels";
import { LEVEL_INFO } from "@/lib/levelInfo";
import { levelsPassed } from "@/lib/progress";
import { markStudied, startRun } from "@/app/actions";
import { Donut, LevelScale, PALETTE } from "@/components/charts";
import { ArrowLeft, ArrowRight, BookOpen, BookOpenCheck, Clock, GraduationCap, Layers, ListChecks, Quote, Sparkles, Target } from "lucide-react";
import { Flashcards } from "@/components/Flashcards";
import { RankEmblem } from "@/components/RankEmblem";
import { SubjectArt, TopicChip, artFor } from "@/components/SubjectArt";

export default async function LearnPage({ params }: { params: Promise<{ slug: string; level: string }> }) {
  const { slug, level: lv } = await params;
  const user = await requireUser();
  const level = Number(lv);
  const track = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (!track || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) notFound();
  const enrolled = db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get();
  if (!enrolled) notFound();

  const lesson = db.select().from(lessons).where(and(eq(lessons.trackId, track.id), eq(lessons.level, level))).get();
  const qs = db.select().from(questions)
    .where(and(eq(questions.trackId, track.id), eq(questions.level, level), eq(questions.status, "active"), eq(questions.type, "mcq")))
    .orderBy(sql`random()`).limit(6).all();
  const mix = db.select({ topic: questions.topic, n: sql<number>`count(*)` }).from(questions)
    .where(and(eq(questions.trackId, track.id), eq(questions.level, level), eq(questions.status, "active"))).groupBy(questions.topic).orderBy(sql`count(*) desc`).limit(6).all().filter((m) => m.topic);
  const pool = db.select({ n: sql<number>`count(*)` }).from(questions).where(and(eq(questions.trackId, track.id), eq(questions.level, level), eq(questions.status, "active"))).get()?.n ?? 0;
  const art = artFor(track.slug, track.name, track.kind), accent = art.color;
  const tier = TIERS[tierOf(level)], info = LEVEL_INFO[level - 1], passed = levelsPassed(user.id, track.id);
  const state = level <= passed ? "done" : level === passed + 1 ? "current" : "preview";
  const SLICE = [PALETTE.indigo, PALETTE.sky, PALETTE.emerald, PALETTE.amber, PALETTE.pink, PALETTE.violet];
  const topics = [...new Set(qs.map((q) => q.topic).filter(Boolean))] as string[];
  const mins = qs.reduce((n, q) => n + q.timeSec, 0) / 60 + (lesson?.syllabus.length ?? 0);
  const cards = qs.map((q) => ({ q: q.prompt, code: q.code, a: q.options?.find((o) => o.key === q.answer)?.text ?? q.answer ?? "", topic: q.topic }));
  const steps = [
    { Icon: BookOpen, t: "Read the guide", href: "#guide" },
    { Icon: Layers, t: "Flip the cards", href: "#cards" },
    { Icon: GraduationCap, t: `Pass level ${level}`, href: "#exam" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={`/tracks/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={14} />{track.name}</Link>

      <header className="card pop relative overflow-hidden p-6" style={{ background: `linear-gradient(125deg, hsl(${tier.hue} 85% 55% / .2), ${accent}14 45%, #ffffff 80%)` }}>
        <svg className="pointer-events-none absolute -right-10 -top-14 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke={accent} strokeOpacity=".18" /><circle cx="120" cy="80" r="58" fill="none" stroke={accent} strokeOpacity=".25" strokeDasharray="4 6" className="march" /></svg>
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="bob"><RankEmblem level={level} state={state === "preview" ? "preview" : state} size={96} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-widest" style={{ color: `hsl(${tier.hue} 70% 42%)` }}>
              <span>{tier.name} rank</span><span className="text-slate-500">·</span><span>Level {level} of {MAX_LEVEL}</span>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300">Study guide</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold">{lesson?.title ?? LEVELS[level - 1]}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-400"><SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={22} />{track.name}</div>
          </div>
        </div>
        <p className="relative mt-4 flex items-start gap-2 text-lg font-semibold leading-snug"><Quote size={18} className="mt-1 shrink-0" style={{ color: accent }} />{info.meaning}</p>
        <div className="relative mt-4"><LevelScale lo={level - 1} hi={level} you={level} /></div>
      </header>

      <nav aria-label="Study path" className="sticky top-14 z-30 -mx-1 rounded-2xl border border-black/10 bg-[#f7f5ef]/90 p-1.5 shadow-sm backdrop-blur">
        <ol className="grid grid-cols-3 gap-1 text-center text-xs font-semibold">
          {steps.map(({ Icon, t, href }, i) => (
            <li key={t}><a href={href} className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-slate-300 transition hover:bg-black/5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-[#fff]" style={{ background: accent }}>{i + 1}</span><span className="hidden sm:inline"><Icon size={14} className="mr-1 inline" /></span>{t}
            </a></li>
          ))}
        </ol>
      </nav>

      <section className="grid grid-cols-3 gap-3" aria-label="At a glance">
        {[
          { Icon: Layers, v: cards.length, l: "Flashcards", col: PALETTE.sky },
          { Icon: Clock, v: `~${Math.max(5, Math.round(mins))} min`, l: "To study", col: PALETTE.amber },
          { Icon: Target, v: `${PASS_MARK * 100}%`, l: "To pass the exam", col: PALETTE.pink },
        ].map(({ Icon, v, l, col }, i) => (
          <div key={l} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${col}1a`, color: col }}><Icon size={20} /></span>
            <div className="mt-2 text-xl font-extrabold">{v}</div><div className="text-[11px] uppercase tracking-wider text-slate-400">{l}</div>
          </div>
        ))}
      </section>

      <section id="guide" className="scroll-mt-28 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpenCheck size={20} className="text-emerald-400" />What you will master</h2>
        <p className="rounded-2xl border-l-4 bg-black/[.03] px-4 py-3 text-sm text-slate-300" style={{ borderColor: accent }}><b>What to expect:</b> {info.expect}</p>
        {lesson ? (
          <ol className="grid gap-3 sm:grid-cols-2">
            {lesson.syllabus.map((t, i) => (
              <li key={t} className="card rise flex items-start gap-3 p-4" style={{ "--i": i, borderLeft: `4px solid hsl(${tier.hue} 75% 55%)` } as React.CSSProperties}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-[#fff]" style={{ background: `linear-gradient(135deg, hsl(${tier.hue} 80% 58%), hsl(${tier.hue} 75% 40%))` }}>{i + 1}</span>
                <span className="pt-0.5 text-sm font-medium">{t}</span>
              </li>
            ))}
          </ol>
        ) : <p className="card p-4 text-sm text-slate-400">The outline for this level is still being written. The flashcards below come from the real exam pool.</p>}
      </section>

      {topics.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Target size={20} className="text-pink-300" />Topics in the exam</h2>
          <div className={`card grid items-center gap-5 p-5 ${mix.length > 1 ? "sm:grid-cols-[auto_1fr]" : ""}`}>
            {mix.length > 1 && <Donut size={130} sub="questions" center={pool} parts={mix.map((m, i) => ({ label: m.topic as string, value: m.n, color: SLICE[i % SLICE.length] }))} />}
            <div>
              <p className="mb-2 text-xs text-slate-400">Each attempt draws {Math.min(QUESTIONS_PER_RUN, pool) || QUESTIONS_PER_RUN} fresh questions from this pool.</p>
              <div className="flex flex-wrap gap-2">{topics.map((t) => <TopicChip key={t} topic={t} color={accent} />)}</div>
            </div>
          </div>
        </section>
      )}

      {cards.length > 0 && (
        <section id="cards" className="scroll-mt-28 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Layers size={20} className="text-sky-300" />Flashcards</h2>
          <Flashcards cards={cards} accent={accent} />
        </section>
      )}

      <section id="exam" className="card scroll-mt-28 relative overflow-hidden p-6 text-center" style={{ background: `linear-gradient(135deg, hsl(${tier.hue} 85% 55% / .18), #fff 65%)` }}>
        <h2 className="text-xl font-extrabold">Ready for level {level}?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{QUESTIONS_PER_RUN} questions, {PASS_MARK * 100}% to pass. Passing earns bonus XP{level < MAX_LEVEL ? <> and opens <b>{LEVELS[level]}</b></> : " and the Titan crown"}.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <form action={markStudied.bind(null, track.id)}><button className="btn btn-ghost"><ListChecks size={16} />I have studied this (+20 XP)</button></form>
          <form action={startRun}>
            <input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} />
            <button className="btn !px-6 !py-3 text-base">Take the level {level} exam<ArrowRight size={16} /></button>
          </form>
        </div>
        {level < MAX_LEVEL && (
          <div className="mt-5 flex items-center justify-center gap-3 border-t border-black/5 pt-4 text-left">
            <RankEmblem level={level + 1} state="preview" size={40} />
            <div className="text-sm"><div className="flex items-center gap-1 font-bold"><Sparkles size={13} style={{ color: accent }} />Up next: {LEVELS[level]}</div><div className="text-xs text-slate-400">{LEVEL_INFO[level].meaning}</div></div>
          </div>
        )}
      </section>
    </div>
  );
}

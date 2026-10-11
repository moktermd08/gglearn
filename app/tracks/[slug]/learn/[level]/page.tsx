import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, enrollments, lessons, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";
import { markStudied, startRun } from "@/app/actions";
import { Donut, StatTile, PALETTE } from "@/components/charts";
import { ArrowRight, BookOpenCheck, GraduationCap, BookOpen, Clock, Layers, ListChecks, Target } from "lucide-react";
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
  const accent = artFor(track.slug, track.name, track.kind).color;
  const SLICE = [PALETTE.indigo, PALETTE.sky, PALETTE.emerald, PALETTE.amber, PALETTE.pink, PALETTE.violet];
  const topics = [...new Set(qs.map((q) => q.topic).filter(Boolean))];
  const mins = qs.reduce((n, q) => n + q.timeSec, 0) / 60 + (lesson?.syllabus.length ?? 0);
  const cards = qs.map((q) => ({ q: q.prompt, code: q.code, a: q.options?.find((o) => o.key === q.answer)?.text ?? q.answer ?? "" }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/tracks/${slug}`} className="text-sm text-slate-400 underline">← {track.name}</Link>
      <div className="card pop relative flex flex-wrap items-center gap-4 overflow-hidden p-6" style={{ background: `linear-gradient(120deg, ${accent}26, #ffffff 60%)` }}>
        <svg className="pointer-events-none absolute -right-10 -top-14 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke={accent} strokeOpacity=".18" /><circle cx="120" cy="80" r="58" fill="none" stroke={accent} strokeOpacity=".25" strokeDasharray="4 6" className="march" /></svg>
        <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={64} />
        <RankEmblem level={level} state="current" size={64} />
        <div>
          <div className="text-xs uppercase tracking-widest text-indigo-300">Study guide · level {level}</div>
          <h1 className="text-3xl font-extrabold">{lesson?.title ?? LEVELS[level - 1]}</h1>
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold" aria-label="Study path">
        {[{ Icon: BookOpen, t: "Read the guide" }, { Icon: Layers, t: "Flip the cards" }, { Icon: GraduationCap, t: `Pass level ${level}` }].map(({ Icon, t }, i) => (
          <li key={t} className="rise relative flex flex-col items-center gap-1.5" style={{ "--i": i } as React.CSSProperties}>
            {i < 2 && <span className="absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-5 border-t-2 border-dashed border-black/15" aria-hidden />}
            <span className="relative grid h-10 w-10 place-items-center rounded-full text-white shadow" style={{ background: accent }}><Icon size={18} /></span>
            <span className="text-slate-300">{i + 1}. {t}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-3 gap-3">
        <StatTile i={0} Icon={Layers} label="Flashcards" value={cards.length} color={PALETTE.sky} />
        <StatTile i={1} Icon={Target} label="Topics" value={topics.length} color={PALETTE.pink} />
        <StatTile i={2} Icon={Clock} label="Minutes" value={Math.max(5, Math.round(mins))} color={PALETTE.amber} />
      </div>

      {lesson && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><BookOpenCheck size={18} className="text-emerald-400" />What you will master</h2>
          <ul className="space-y-2">
            {lesson.syllabus.map((t, i) => <li key={t} className="rise flex items-start gap-3" style={{ "--i": i } as React.CSSProperties}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-extrabold text-emerald-300">{i + 1}</span><span className="pt-0.5">{t}</span></li>)}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Target size={18} className="text-pink-300" />Topics in the exam</h2>
          {mix.length > 1 && <div className="card mb-3 p-4"><Donut size={120} sub="questions" parts={mix.map((m, i) => ({ label: m.topic as string, value: m.n, color: SLICE[i % SLICE.length] }))} /></div>}
          <div className="flex flex-wrap gap-2">{topics.map((t) => <TopicChip key={t} topic={t} color={artFor(track.slug, track.name, track.kind).color} />)}</div>
        </section>
      )}

      {cards.length > 0 && (
        <section><h2 className="mb-2 flex items-center gap-2 font-bold"><Layers size={18} className="text-sky-300" />Flashcards</h2><Flashcards cards={cards} /></section>
      )}

      <div className="flex flex-wrap gap-3">
        <form action={markStudied.bind(null, track.id)}><button className="btn btn-ghost"><ListChecks size={16} />I have studied this (+20 XP)</button></form>
        <form action={startRun}>
          <input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} />
          <button className="btn">Take the level {level} exam<ArrowRight size={16} /></button>
        </form>
      </div>
    </div>
  );
}

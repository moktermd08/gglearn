import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, enrollments, lessons, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";
import { markStudied, startRun } from "@/app/actions";
import { ArrowRight, BookOpenCheck, Clock, Layers, ListChecks, Sparkles, Target } from "lucide-react";
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
  const topics = [...new Set(qs.map((q) => q.topic).filter(Boolean))];
  const mins = qs.reduce((n, q) => n + q.timeSec, 0) / 60 + (lesson?.syllabus.length ?? 0);
  const cards = qs.map((q) => ({ q: q.prompt, code: q.code, a: q.options?.find((o) => o.key === q.answer)?.text ?? q.answer ?? "" }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/tracks/${slug}`} className="text-sm text-slate-400 underline">← {track.name}</Link>
      <div className="flex items-center gap-4">
        <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={64} />
        <RankEmblem level={level} state="current" size={64} />
        <div>
          <div className="text-xs uppercase tracking-widest text-indigo-300">Study guide · level {level}</div>
          <h1 className="text-3xl font-extrabold">{lesson?.title ?? LEVELS[level - 1]}</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { Icon: Layers, label: "Flashcards", value: cards.length, cls: "text-sky-300" },
          { Icon: Target, label: "Topics", value: topics.length, cls: "text-pink-300" },
          { Icon: Clock, label: "Minutes", value: Math.max(5, Math.round(mins)), cls: "text-amber-300" },
        ].map(({ Icon, label, value, cls }, i) => (
          <div key={label} className="card rise p-3 text-center" style={{ "--i": i } as React.CSSProperties}>
            <Icon size={20} className={`mx-auto ${cls}`} />
            <div className="text-xl font-extrabold">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {lesson && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><BookOpenCheck size={18} className="text-emerald-400" />What you will master</h2>
          <ul className="space-y-2">
            {lesson.syllabus.map((t, i) => <li key={t} className="rise flex gap-2" style={{ "--i": i } as React.CSSProperties}><Sparkles size={16} className="mt-1 shrink-0 text-emerald-400" /><span>{t}</span></li>)}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Target size={18} className="text-pink-300" />Topics in the exam</h2>
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

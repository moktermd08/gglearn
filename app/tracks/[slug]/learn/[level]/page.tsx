import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, enrollments, lessons, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";
import { markStudied, startRun } from "@/app/actions";
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

      {lesson && (
        <section className="card p-5">
          <h2 className="mb-2 font-bold">What you will master</h2>
          <ul className="space-y-2">
            {lesson.syllabus.map((t) => <li key={t} className="flex gap-2"><span className="text-emerald-400">◆</span><span>{t}</span></li>)}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Topics in the exam</h2>
          <div className="flex flex-wrap gap-2">{topics.map((t) => <TopicChip key={t} topic={t} color={artFor(track.slug, track.name, track.kind).color} />)}</div>
        </section>
      )}

      {cards.length > 0 && (
        <section><h2 className="mb-2 font-bold">Flashcards</h2><Flashcards cards={cards} /></section>
      )}

      <div className="flex flex-wrap gap-3">
        <form action={markStudied.bind(null, track.id)}><button className="btn btn-ghost">✅ I have studied this (+20 XP)</button></form>
        <form action={startRun}>
          <input type="hidden" name="trackId" value={track.id} /><input type="hidden" name="level" value={level} />
          <button className="btn">Take the level {level} exam →</button>
        </form>
      </div>
    </div>
  );
}

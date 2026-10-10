import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, enrollments, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DRILL_SIZE, drillLevelFilter } from "@/lib/drill";
import { Drill } from "@/components/Drill";

export default async function DrillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const track = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (!track) notFound();
  if (!db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.trackId, track.id))).get()) notFound();

  const qs = db.select().from(questions)
    .where(and(eq(questions.trackId, track.id), eq(questions.status, "active"), eq(questions.type, "mcq"), drillLevelFilter(user.id, track.id)))
    .orderBy(sql`random()`).limit(DRILL_SIZE).all();
  if (!qs.length) return <p>No drill questions yet. <Link href={`/tracks/${slug}`} className="underline">Back</Link></p>;

  return <Drill trackId={track.id} back={`/tracks/${slug}`}
    questions={qs.map((q) => ({ id: q.id, prompt: q.prompt, code: q.code, type: "mcq" as const, options: q.options }))} />;
}

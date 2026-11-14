import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { ArrowLeft, GraduationCap, ShieldCheck } from "lucide-react";
import { answers, db, questions, runs, tracks, users } from "@/lib/db";
import { realUser, requireUser, viewAsState } from "@/lib/auth";
import { NoteComposer } from "@/components/NoteControls";
import { NotesThread } from "@/components/NotesThread";
import { PageHero } from "@/components/charts";
import { notesForAnswers, whyNotReview } from "@/lib/questionNotes";
import { reachOf, userInReach } from "@/lib/tenancy";

export const metadata: Metadata = { title: "Review exams — gglearn", robots: { index: false, follow: false } };

const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const course = (name: string) => name.replace(/^\d+\.\s*/, "");
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * A mentor reads the exam answers of someone who has let them (or a manager who runs them), and leaves notes under single questions. The
 * learner sees each note under that question in their own review, and can say "got it" or reply once. Same rule as everywhere
 * (lib/questionNotes.ts): a mentor needs the learner's permission, which the learner can take back at any time.
 */
export default async function ReviewExams({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || whyNotReview(me, id) !== null) notFound(); // the same answer for "no such person" and "not allowed"
  const viewing = (await viewAsState()) !== null, real = await realUser();
  const learner = db.select({ name: users.name }).from(users).where(eq(users.id, id)).get()!;
  const asManager = (me.role === "manager" || me.role === "admin") && userInReach(reachOf(me.id), id);
  const canNote = !viewing && !!real && real.id === me.id;

  const attempts = db.select({ r: runs, t: tracks }).from(runs).innerJoin(tracks, eq(tracks.id, runs.trackId)).where(and(eq(runs.userId, id), isNotNull(runs.finishedAt))).orderBy(desc(runs.finishedAt)).limit(30).all();
  const runIds = attempts.map((a) => a.r.id);
  const given = new Map<number, { a: typeof answers.$inferSelect; q: typeof questions.$inferSelect }[]>();
  if (runIds.length) for (const x of db.select({ a: answers, q: questions }).from(answers).innerJoin(questions, eq(questions.id, answers.questionId)).where(inArray(answers.runId, runIds)).all()) given.set(x.a.runId, [...(given.get(x.a.runId) ?? []), x]);
  const notes = notesForAnswers([...given.values()].flat().map((x) => x.a.id));
  const waiting = [...notes.values()].flat().filter((n) => !n.ackAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={GraduationCap} tone="violet" title={`${learner.name}'s exams`} sub="Read what they answered and leave a note under any question. They see it there and can reply.">
        <Link href="/mentoring" className="btn btn-ghost !py-1 text-sm"><ArrowLeft size={15} />Mentoring</Link>
      </PageHero>
      <p className="card flex items-start gap-2 p-3 text-sm text-slate-600"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
        {asManager ? "You can see this because you run them." : `You can see this because ${learner.name.split(" ")[0]} chose to let you review their exam answers. They can switch it off at any time.`} Be kind and specific: say what worked, and one thing to try next.</p>
      {viewing && <p className="card border-l-4 border-amber-500 p-3 text-sm text-amber-900">You are viewing as someone else, so notes are switched off. Exit the view to write them as yourself.</p>}
      {waiting > 0 && <p className="text-sm text-slate-500">{waiting} {waiting === 1 ? "note is" : "notes are"} waiting for them to read.</p>}

      {attempts.length === 0 ? <p className="card p-4 text-sm text-slate-400">No finished exams yet.</p> : (
        <ul className="space-y-2">
          {attempts.map(({ r, t }) => {
            const rows = given.get(r.id) ?? [], count = rows.reduce((n, { a }) => n + (notes.get(a.id)?.length ?? 0), 0);
            return (
              <li key={r.id} className="card p-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">{day(r.finishedAt ?? 0)}</span>
                    <span className="min-w-0 flex-1 font-semibold">{course(t.name)} · level {r.level}</span>
                    <span className="text-slate-500">{Math.round((r.score ?? 0) * 100)}%</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.passed ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"}`}>{r.passed ? "passed" : "not passed"}</span>
                    {count > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">{count} {count === 1 ? "note" : "notes"}</span>}
                  </summary>
                  <ol className="mt-3 space-y-4">
                    {rows.length === 0 && <li className="text-sm text-slate-400">No answers were kept for this attempt.</li>}
                    {rows.map(({ a, q }, i) => {
                      const chosen = q.options?.find((o) => o.key === a.response), right = q.options?.find((o) => o.key === q.answer);
                      return (
                        <li key={a.id} id={`q${a.id}`} className="scroll-mt-24 space-y-2 border-t border-black/5 pt-3 text-sm first:border-0 first:pt-0">
                          <p className="font-medium"><span className="text-slate-400">Q{i + 1}</span> {short(q.prompt, 400)}</p>
                          {q.code && <pre tabIndex={0} aria-label="Code" className="overflow-x-auto rounded bg-black/5 p-2 text-xs">{q.code}</pre>}
                          <p className={a.score >= 0.8 ? "text-emerald-700" : a.score > 0 ? "text-amber-700" : "text-rose-700"}>Answered: {chosen ? `${chosen.key.toUpperCase()}. ${chosen.text}` : short(a.response || "(no answer)", 600)} · {Math.round(a.score * 100)}%</p>
                          {q.type === "mcq" && right && a.score < 1 && <p className="text-slate-500">Correct: {right.key.toUpperCase()}. {right.text}</p>}
                          {a.feedback && <p className="text-xs text-slate-500">{short(a.feedback, 300)}</p>}
                          <NotesThread notes={notes.get(a.id) ?? []} as="reviewer" meId={me.id} mayModerate={asManager && canNote} />
                          {canNote && <NoteComposer answerId={a.id} />}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, questions, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { activateTrackQuestions, retireQuestion } from "@/app/actions";
import { Check, CheckCheck, ClipboardCheck, Trash2 } from "lucide-react";

export const metadata = { title: "Review questions — gglearn" };

export default async function ReviewQuestions({ params }: { params: Promise<{ slug: string }> }) {
  const me = await requireManager();
  const { slug } = await params;
  const track = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (!track) notFound();
  const waiting = db.select().from(questions).where(and(eq(questions.trackId, track.id), eq(questions.status, "review"))).orderBy(asc(questions.level), asc(questions.id)).all();
  const levels = [...new Set(waiting.map((q) => q.level))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="text-amber-300" />{track.name}</h1>
          <p className="text-sm text-slate-400">{waiting.length} questions waiting for review. Nothing here is live until it is approved. The correct answer is marked.</p>
        </div>
        {me.role === "admin" && waiting.length > 0 && (
          <form action={activateTrackQuestions.bind(null, track.id)}><button className="btn !py-1.5"><CheckCheck size={15} />Approve all {waiting.length}</button></form>
        )}
      </div>
      {waiting.length === 0 && <p className="text-slate-400">Nothing is waiting. <Link href="/admin/paths" className="underline">Back to what is required</Link>.</p>}
      {levels.map((lv) => (
        <section key={lv} className="space-y-3">
          <h2 className="font-semibold">Level {lv}</h2>
          {waiting.filter((q) => q.level === lv).map((q) => (
            <article key={q.id} className="card space-y-2 p-4">
              <p className="font-medium">{q.prompt}</p>
              <ul className="space-y-1 text-sm">
                {(q.options ?? []).map((o) => (
                  <li key={o.key} className={o.key === q.answer ? "flex items-start gap-1.5 text-emerald-300" : "pl-5 text-slate-300"}>
                    {o.key === q.answer && <Check size={14} className="mt-0.5 shrink-0" />}{o.text}
                  </li>
                ))}
              </ul>
              {q.hint && <p className="text-xs text-slate-500">Why: {q.hint}</p>}
              <div className="flex gap-2">
                <form action={retireQuestion}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="active" /><button className="btn btn-ghost !px-3 !py-1 text-sm"><Check size={14} />Approve</button></form>
                <form action={retireQuestion}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="retired" /><button className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25"><Trash2 size={14} />Retire</button></form>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

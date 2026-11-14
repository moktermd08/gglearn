import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { LearnerNoteActions } from "@/components/NoteControls";
import { PageHero } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL } from "@/lib/questionNoteText";
import { waitingNotes } from "@/lib/questionNotes";

export const metadata: Metadata = { title: "Feedback — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const course = (name: string) => name.replace(/^\d+\.\s*/, "");

/** Notes people have left under the questions of the learner's own exams that they have not yet read, with a way to say "got it" or reply. */
export default async function Feedback() {
  const me = await requireUser();
  const items = waitingNotes(me.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={MessageSquareText} tone="sky" title="Feedback on your answers" sub="Notes from the people helping you, left under the exact question they are about. Read them, say thanks or ask a question, and try the level again." />
      {items.length === 0 ? (
        <p className="card p-4 text-sm text-slate-400">Nothing waiting. When someone leaves you a note on an exam answer, it shows up here and in your notifications.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(({ n, who, q, r, t }) => (
            <li key={n.id} className="card space-y-2 p-4 text-sm">
              <p className="text-xs text-slate-500">{course(t.name)} · level {r.level} · {day(r.finishedAt ?? r.startedAt)}</p>
              <p className="font-medium">{q.prompt.length > 220 ? `${q.prompt.slice(0, 219)}…` : q.prompt}</p>
              <div className="rounded-lg border-l-4 border-sky-400/60 bg-sky-500/5 p-2.5">
                <p className="text-xs text-slate-500"><b>{KIND_LABEL[n.kind]}</b> from <b>{who}</b> · {day(n.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
              </div>
              <LearnerNoteActions noteId={n.id} acked={false} replied={!!n.repliedAt} />
              <Link href={`/run/${r.id}#q${n.answerId}`} className="inline-block text-xs text-sky-700 underline">See it in your exam review</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

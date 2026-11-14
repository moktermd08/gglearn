import { Lightbulb, MessageCircleQuestion, ThumbsUp } from "lucide-react";
import { DeleteNote, LearnerNoteActions } from "@/components/NoteControls";
import { KIND_LABEL, type NoteKind } from "@/lib/questionNoteText";
import type { NoteView } from "@/lib/questionNotes";

const ICON = { suggestion: Lightbulb, praise: ThumbsUp, question: MessageCircleQuestion } as const;
const TONE: Record<NoteKind, string> = { suggestion: "border-sky-400/50 bg-sky-500/5", praise: "border-emerald-400/50 bg-emerald-500/5", question: "border-violet-400/50 bg-violet-500/5" };
const CHIP: Record<NoteKind, string> = { suggestion: "text-sky-700", praise: "text-emerald-700", question: "text-violet-700" };
const when = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The notes under one question. The learner sees who wrote each, when, and can say "got it" and reply once; a reviewer sees the same,
 * the learner's reply, and may remove a note they wrote (or any, if they run the learner).
 */
export function NotesThread({ notes, as, meId, mayModerate = false }: { notes: NoteView[]; as: "learner" | "reviewer"; meId?: number; mayModerate?: boolean }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-2" aria-label="Notes on this question">
      {notes.map((n) => {
        const Icon = ICON[n.kind];
        return (
          <li key={n.id} className={`space-y-1.5 rounded-lg border-l-4 p-2.5 text-sm ${TONE[n.kind]}`}>
            <div className="flex flex-wrap items-center gap-x-2 text-xs">
              <span className={`inline-flex items-center gap-1 font-bold ${CHIP[n.kind]}`}><Icon size={13} aria-hidden />{KIND_LABEL[n.kind]}</span>
              <span className="text-slate-500">from <b>{n.author}</b> · {when(n.createdAt)}</span>
              {as === "reviewer" && (n.ackAt ? <span className="text-emerald-600">read</span> : <span className="text-slate-400">not read yet</span>)}
              {as === "reviewer" && (n.authorId === meId || mayModerate) && <span className="ml-auto"><DeleteNote noteId={n.id} /></span>}
            </div>
            <p className="whitespace-pre-wrap">{n.body}</p>
            {n.reply && <p className="whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs"><b>{as === "learner" ? "Your reply" : "Their reply"}:</b> {n.reply}</p>}
            {as === "learner" && <LearnerNoteActions noteId={n.id} acked={!!n.ackAt} replied={!!n.repliedAt} />}
          </li>
        );
      })}
    </ul>
  );
}

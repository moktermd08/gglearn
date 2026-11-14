import { Lightbulb, MessageCircleQuestion, ThumbsUp } from "lucide-react";
import { DeleteComment, OwnerCommentActions } from "@/components/cv/CommentControls";
import { KIND_LABEL } from "@/lib/questionNoteText";
import type { CommentView } from "@/lib/cv/review";

const ICON = { suggestion: Lightbulb, praise: ThumbsUp, question: MessageCircleQuestion } as const;
const TONE = { suggestion: "border-sky-400/50 bg-sky-500/5", praise: "border-emerald-400/50 bg-emerald-500/5", question: "border-violet-400/50 bg-violet-500/5" } as const;
const when = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS = { open: "open", done: "done", dismissed: "dismissed" } as const;

/** Comments on a CV. The reviewer sees and can remove their own; the owner sees every reviewer's, and can mark each done, dismiss it, or reply once. */
export function CommentThread({ comments, as, ownerId, showAuthor = false }: { comments: CommentView[]; as: "reviewer" | "owner"; ownerId: number; showAuthor?: boolean }) {
  if (!comments.length) return null;
  return (
    <ul className="space-y-2" aria-label="Comments">
      {comments.map((c) => {
        const Icon = ICON[c.kind];
        return (
          <li key={c.id} className={`space-y-1.5 rounded-lg border-l-4 p-2.5 text-sm ${TONE[c.kind]} ${c.status !== "open" ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-slate-700"><Icon size={13} aria-hidden />{KIND_LABEL[c.kind]}</span>
              {showAuthor && <span className="text-slate-500">from <b>{c.reviewer}</b></span>}
              <span className="text-slate-400">{when(c.createdAt)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.status === "open" ? "bg-amber-500/20 text-amber-800" : c.status === "done" ? "bg-emerald-500/15 text-emerald-700" : "bg-black/10 text-slate-500"}`}>{STATUS[c.status]}</span>
              {as === "reviewer" && <span className="ml-auto"><DeleteComment id={c.id} ownerId={ownerId} /></span>}
            </div>
            <p className="whitespace-pre-wrap">{c.body}</p>
            {c.reply && <p className="whitespace-pre-wrap rounded-md bg-black/5 p-2 text-xs"><b>{as === "owner" ? "Your reply" : "Their reply"}:</b> {c.reply}</p>}
            {as === "owner" && <OwnerCommentActions id={c.id} status={c.status} replied={!!c.repliedAt} />}
          </li>
        );
      })}
    </ul>
  );
}

"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { addCvCommentAction, deleteCommentAction, replyCommentAction, resolveCommentAction } from "@/app/cv-actions";
import { CvForm, InlineAction } from "@/components/cv/CvForms";
import { CV_COMMENT } from "@/lib/cv/types";
import { KIND_LABEL, NOTE_KINDS } from "@/lib/questionNoteText";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";
const small = "inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-black/5 disabled:opacity-50";

/** A reviewer writes a comment on a section (anchor "") or on one item. */
export function CommentComposer({ ownerId, section, anchor = "", placeholder }: { ownerId: number; section: string; anchor?: string; placeholder?: string }) {
  const [text, setText] = useState("");
  return (
    <CvForm action={addCvCommentAction} resetOnDone className="space-y-1.5" >
      <input type="hidden" name="ownerId" value={ownerId} /><input type="hidden" name="section" value={section} /><input type="hidden" name="anchor" value={anchor} />
      <div className="flex flex-wrap items-start gap-2">
        <select name="kind" defaultValue="suggestion" aria-label="Kind of comment" className="rounded-lg border border-black/15 bg-[#fff] px-2 py-1.5 text-sm text-slate-800">{NOTE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
        <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} required minLength={CV_COMMENT.min} maxLength={CV_COMMENT.max} rows={2} placeholder={placeholder ?? "A suggestion, some praise, or a question"} aria-label="Your comment" className={`${field} min-w-56 flex-1`} />
        <button className={small} disabled={text.trim().length < CV_COMMENT.min}><Send size={13} aria-hidden />Comment</button>
      </div>
      <p className="text-[11px] text-slate-400">{text.length}/{CV_COMMENT.max} · only you and the owner can see it</p>
    </CvForm>
  );
}

/** The owner's controls on one comment: done, dismiss, reopen, and one reply. */
export function OwnerCommentActions({ id, status, replied }: { id: number; status: string; replied: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {status === "open" && <><InlineAction action={resolveCommentAction} fields={{ id, to: "done" }} label="I changed it" /><InlineAction action={resolveCommentAction} fields={{ id, to: "dismissed" }} label="Not doing this" /></>}
        {status !== "open" && <InlineAction action={resolveCommentAction} fields={{ id, to: "open" }} label="Reopen" />}
        {!replied && <button type="button" className={small} onClick={() => setOpen((o) => !o)} aria-expanded={open}>Reply</button>}
      </div>
      {open && !replied && (
        <CvForm action={replyCommentAction} className="space-y-1.5">
          <input type="hidden" name="id" value={id} />
          <textarea name="reply" required minLength={2} maxLength={CV_COMMENT.reply} rows={2} placeholder="Say thanks, ask something, or explain what you will do" aria-label="Your reply" className={field} />
          <button className={small}><Send size={13} aria-hidden />Send</button>
        </CvForm>
      )}
    </div>
  );
}

/** The author removes their own comment. */
export function DeleteComment({ id, ownerId }: { id: number; ownerId: number }) {
  return <InlineAction action={deleteCommentAction} fields={{ id, ownerId }} label="Remove" tone="danger" confirm="Remove this comment?" />;
}

"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Reply, Send, Trash2 } from "lucide-react";
import { ackNoteAction, addNoteAction, deleteNoteAction, replyNoteAction, withdrawQuotableAction } from "@/app/note-actions";
import { KIND_LABEL, NOTE_KINDS, NOTE_MAX, REPLY_MAX } from "@/lib/questionNoteText";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";
const small = "inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-black/5 disabled:opacity-50";

/** A reviewer writes a note under one question. Plain text; the server checks again who they are to the learner. */
export function NoteComposer({ answerId, placeholder }: { answerId: number; placeholder?: string }) {
  const [state, run, pending] = useActionState(addNoteAction, null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState("suggestion");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.done) ref.current?.reset(); }, [state]); // clears the box once it was sent (and only then, so a refused note is not lost)
  return (
    <form ref={ref} action={run} onReset={() => setText("")} className="space-y-1.5">
      <input type="hidden" name="answerId" value={answerId} />
      <div className="flex flex-wrap items-start gap-2">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of note" className="rounded-lg border border-black/15 bg-[#fff] px-2 py-1.5 text-sm text-slate-800">
          {NOTE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} required minLength={3} maxLength={NOTE_MAX} rows={2} placeholder={placeholder ?? "A suggestion, some praise, or a question about this answer"} aria-label="Note on this question" className={`${field} min-w-56 flex-1`} />
        <button disabled={pending || text.trim().length < 3} className={small}><Send size={13} aria-hidden />{pending ? "Sending…" : "Leave note"}</button>
      </div>
      {kind === "praise" && (
        <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" name="quotable" className="mt-0.5" />They may quote this praise on their CV, with my name. I can take it back later.</label>
      )}
      <p className="text-[11px] text-slate-400">{text.length}/{NOTE_MAX} · they will be told and can reply once</p>
      {state?.error && <p role="alert" className="text-xs text-rose-600">{state.error}</p>}
      {state?.done && <p role="status" className="text-xs text-emerald-600">{state.done}</p>}
    </form>
  );
}

export function DeleteNote({ noteId }: { noteId: number }) {
  const [state, run, pending] = useActionState(deleteNoteAction, null);
  return (
    <form action={run} className="inline">
      <input type="hidden" name="noteId" value={noteId} />
      <button disabled={pending} className="inline-flex items-center gap-1 text-[11px] text-slate-400 underline hover:text-rose-600 disabled:opacity-50"><Trash2 size={11} aria-hidden />Remove</button>
      {state?.error && <span role="alert" className="ml-2 text-[11px] text-rose-600">{state.error}</span>}
    </form>
  );
}

/** The learner's side of a note: "Got it", and one reply. */
export function LearnerNoteActions({ noteId, acked, replied }: { noteId: number; acked: boolean; replied: boolean }) {
  const [ackState, ack, acking] = useActionState(ackNoteAction, null);
  const [repState, reply, replying] = useActionState(replyNoteAction, null);
  const [open, setOpen] = useState(false);
  const sent = repState?.done;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {!acked && !ackState?.done && (
          <form action={ack}><input type="hidden" name="noteId" value={noteId} /><button disabled={acking} className={small}><Check size={13} aria-hidden />Got it</button></form>
        )}
        {(acked || ackState?.done) && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} aria-hidden />Read</span>}
        {!replied && !sent && <button type="button" onClick={() => setOpen((o) => !o)} className={small} aria-expanded={open}><Reply size={13} aria-hidden />Reply</button>}
      </div>
      {open && !replied && !sent && (
        <form action={reply} className="flex flex-wrap items-start gap-2">
          <input type="hidden" name="noteId" value={noteId} />
          <textarea name="reply" required minLength={2} maxLength={REPLY_MAX} rows={2} placeholder="Say thanks, ask something, or tell them what you will try" aria-label="Your reply" className={`${field} min-w-56 flex-1`} />
          <button disabled={replying} className={small}><Send size={13} aria-hidden />{replying ? "Sending…" : "Send"}</button>
          <p className="w-full text-[11px] text-slate-400">One reply per note, up to {REPLY_MAX} characters.</p>
        </form>
      )}
      {repState?.error && <p role="alert" className="text-xs text-rose-600">{repState.error}</p>}
      {ackState?.error && <p role="alert" className="text-xs text-rose-600">{ackState.error}</p>}
      {sent && <p role="status" className="text-xs text-emerald-600">Sent.</p>}
    </div>
  );
}

/** The author of praise takes back permission to quote it on the learner's CV. */
export function WithdrawQuote({ noteId }: { noteId: number }) {
  const [state, run, pending] = useActionState(withdrawQuotableAction, null);
  if (state?.done) return <span className="text-[11px] text-emerald-600">{state.done}</span>;
  return (
    <form action={run} className="inline">
      <input type="hidden" name="noteId" value={noteId} />
      <button disabled={pending} className="text-[11px] text-slate-500 underline hover:text-rose-600 disabled:opacity-50">Withdraw permission to quote</button>
      {state?.error && <span role="alert" className="ml-2 text-[11px] text-rose-600">{state.error}</span>}
    </form>
  );
}

"use client";
import { useActionState, useTransition } from "react";
import { Check, Send, UserMinus } from "lucide-react";
import { becomeMentor, sendNote, stopMentoring, type MentorState } from "./actions";

export function AcceptMentee({ code, kind = "mentor" }: { code: string; kind?: "mentor" | "parent" }) {
  const [state, run, pending] = useActionState<MentorState, FormData>(async () => becomeMentor(code, kind), null);
  return (
    <form action={run} className="space-y-2">
      <button disabled={pending} className="btn disabled:opacity-50"><Check size={16} />{pending ? "One moment…" : kind === "parent" ? "Yes, follow their progress" : "Yes, be their mentor"}</button>
      {state?.error && <p role="alert" className="text-sm text-rose-500">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function NoteForm({ menteeId }: { menteeId: number }) {
  const [state, run, pending] = useActionState<MentorState, FormData>(sendNote.bind(null, menteeId), null);
  return (
    <form action={run} className="flex flex-wrap gap-2">
      <input name="text" required minLength={2} maxLength={140} placeholder="A word of encouragement (140 characters)" aria-label="A word of encouragement" className="min-w-48 flex-1 rounded-xl border border-black/15 bg-[#fff] px-3 py-2 text-sm" />
      <button disabled={pending} className="btn !py-1.5 text-sm disabled:opacity-50"><Send size={14} />{pending ? "Sending…" : "Send"}</button>
      {state?.error && <p role="alert" className="w-full text-sm text-rose-500">{state.error}</p>}
      {state?.message && <p role="status" className="w-full text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function StopButton({ otherId, label }: { otherId: number; label: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await stopMentoring(otherId); })} className="inline-flex items-center gap-1 text-xs text-slate-400 underline disabled:opacity-50"><UserMinus size={12} />{label}</button>;
}

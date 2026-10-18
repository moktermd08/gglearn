"use client";
import { useActionState, useTransition } from "react";
import { Check, Hand, Mail, UserPlus, X } from "lucide-react";
import { acceptFriendLink, addFriendByEmail, answerRequest, cheerEvent, type FriendState } from "./actions";

export function AddByEmail() {
  const [state, run, pending] = useActionState<FriendState, FormData>(addFriendByEmail, null);
  return (
    <form action={run} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1"><Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="email" type="email" required placeholder="A friend's email" aria-label="A friend's email" className="w-full rounded-xl border border-black/15 bg-[#fff] py-2 pl-9 pr-3" /></div>
        <button disabled={pending} className="btn disabled:opacity-50"><UserPlus size={15} />{pending ? "Asking…" : "Ask them"}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-rose-500">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function RequestButtons({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-2">
      <button disabled={pending} onClick={() => start(async () => { await answerRequest(id, true); })} className="btn !py-1.5 text-sm disabled:opacity-50"><Check size={14} />Accept</button>
      <button disabled={pending} onClick={() => start(async () => { await answerRequest(id, false); })} className="btn btn-ghost !py-1.5 text-sm disabled:opacity-50"><X size={14} />No thanks</button>
    </span>
  );
}

export function CheerButton({ eventKey, cheered, count }: { eventKey: string; cheered: boolean; count: number }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending || cheered} onClick={() => start(async () => { await cheerEvent(eventKey); })} aria-pressed={cheered} aria-label={cheered ? `You cheered. ${count} cheer${count === 1 ? "" : "s"} in all` : "Cheer this"}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${cheered ? "border-amber-300 bg-amber-400/20 text-amber-700" : "border-black/10 bg-[#fff] text-slate-500 hover:border-amber-300 hover:text-amber-700"} disabled:opacity-80`}>
      <Hand size={13} />{cheered ? "Cheered" : "Cheer"}{count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

export function AcceptLink({ code }: { code: string }) {
  const [state, run, pending] = useActionState<FriendState, FormData>(async () => acceptFriendLink(code), null);
  return (
    <form action={run} className="space-y-2">
      <button disabled={pending} className="btn !px-8 !py-3 text-base disabled:opacity-50"><UserPlus size={18} />{pending ? "Adding…" : "Be friends"}</button>
      {state?.error && <p role="alert" className="text-sm text-rose-500">{state.error}</p>}
    </form>
  );
}

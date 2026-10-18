"use client";
import { useActionState } from "react";
import { Swords, TriangleAlert } from "lucide-react";
import { joinDuelAction, type DuelActionState } from "../actions";

export default function JoinButton({ code }: { code: string }) {
  const [state, run, pending] = useActionState<DuelActionState, FormData>(async () => joinDuelAction(code), null);
  return (
    <form action={run} className="space-y-2">
      <button disabled={pending} className="btn !px-8 !py-3 text-base disabled:opacity-50"><Swords size={18} />{pending ? "Joining…" : "Accept the duel"}</button>
      {state?.error && <p role="alert" className="flex items-center justify-center gap-1.5 text-sm text-rose-500"><TriangleAlert size={14} />{state.error}</p>}
    </form>
  );
}

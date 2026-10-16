"use client";
import { useActionState } from "react";
import { Ban, Check, RotateCcw, TriangleAlert } from "lucide-react";
import { reinstateCert, revokeCert } from "./actions";
import type { SetupState } from "@/lib/setup";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
function Result({ state }: { state: SetupState }) {
  if (state?.error) return <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>;
  if (state?.done) return <p role="status" className="slide-in flex w-full items-center gap-1.5 text-emerald-400"><Check size={14} />{state.done}</p>;
  return null;
}

export function RevokeForm({ id, who }: { id: number; who: string }) {
  const [state, run, pending] = useActionState(revokeCert, null);
  return (
    <form action={run} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="id" value={id} />
      <input name="reason" required minLength={3} maxLength={300} placeholder={`Why is ${who}'s certificate being revoked? They will see this.`} aria-label="Reason for revoking" className={`${input} min-w-64 flex-1`} />
      <button disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1 font-semibold text-rose-500 transition hover:bg-rose-500/25 disabled:opacity-50"><Ban size={14} />Revoke</button>
      <Result state={state} />
    </form>
  );
}

export function ReinstateForm({ id }: { id: number }) {
  const [state, run, pending] = useActionState(reinstateCert, null);
  return (
    <form action={run} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="id" value={id} />
      <input name="reason" maxLength={300} placeholder="Note (optional)" aria-label="Note for reinstating" className={`${input} min-w-48 flex-1`} />
      <button disabled={pending} className="btn btn-ghost !px-3 !py-1"><RotateCcw size={14} />Reinstate</button>
      <Result state={state} />
    </form>
  );
}

"use client";
import { useActionState } from "react";
import { createInvite, type InviteState } from "@/app/actions";

export default function InvitePerson() {
  const [state, run, pending] = useActionState<InviteState, FormData>(createInvite, null);
  const input = "rounded border border-white/20 bg-black/30 px-2 py-1";
  const link = state?.path ? `${window.location.origin}${state.path}` : null;
  return (
    <form action={run} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/15 p-4 text-sm">
      <input name="email" type="email" placeholder="Their email" required className={input} />
      <input name="jobRole" placeholder="Role (sales, marketing, developer…)" required className={input} />
      <button disabled={pending} className="btn !py-1.5 py-1.5 disabled:opacity-50">Create invite link</button>
      {state?.error && <p role="alert" className="w-full text-red-600">{state.error}</p>}
      {link && (
        <p className="w-full text-slate-300">
          Send this link (single use, valid 7 days, shown once):
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${input} mt-1 block w-full`} />
        </p>
      )}
    </form>
  );
}

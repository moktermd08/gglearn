"use client";
import { useActionState } from "react";
import { inviteToCompetition, type InviteResult } from "../actions";

export default function InviteForm({ competitionId }: { competitionId: number }) {
  const [state, run, pending] = useActionState<InviteResult, FormData>(inviteToCompetition.bind(null, competitionId), null);
  return (
    <form action={run} className="space-y-2 text-sm">
      <label htmlFor="emails" className="font-semibold">Invite people by email</label>
      <textarea id="emails" name="emails" rows={2} required placeholder="ana@example.com, ben@example.com" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" />
      <button disabled={pending} className="btn !py-1.5 disabled:opacity-50">Send invitations</button>
      {state?.error && <p role="alert" className="text-rose-400">{state.error}</p>}
      {state?.message && <p className="text-emerald-300">{state.message}</p>}
    </form>
  );
}

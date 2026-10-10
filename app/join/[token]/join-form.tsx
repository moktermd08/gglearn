"use client";
import { useActionState } from "react";
import { joinWithInvite } from "@/app/actions";

export default function JoinForm({ token, email }: { token: string; email: string }) {
  const [error, run, pending] = useActionState(joinWithInvite.bind(null, token), null);
  const input = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2";
  return (
    <form action={run} className="card mx-auto max-w-sm space-y-3 p-6">
      <h2 className="text-lg font-semibold">Create your account</h2>
      <p className="text-sm text-slate-300">You were invited as <b>{email}</b>.</p>
      <input name="name" placeholder="Full name" required className={input} autoComplete="name" />
      <input name="password" type="password" placeholder="Choose a password (8+ characters)" required minLength={8} className={input} autoComplete="new-password" />
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50">Join</button>
    </form>
  );
}

"use client";
import { useActionState } from "react";
import { KeyRound, Mail, PartyPopper, TriangleAlert, User } from "lucide-react";
import { joinWithInvite } from "@/app/actions";

export default function JoinForm({ token, email }: { token: string; email: string }) {
  const [error, run, pending] = useActionState(joinWithInvite.bind(null, token), null);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  return (
    <form action={run} className="card pop mx-auto max-w-sm space-y-3 p-6">
      <div className="flex items-center gap-2"><PartyPopper className="bob text-amber-300" /><h2 className="text-lg font-semibold">Create your account</h2></div>
      <p className="flex items-center gap-1.5 text-sm text-slate-300"><Mail size={14} className="shrink-0 text-sky-300" />You were invited as <b>{email}</b>.</p>
      <div className="relative"><User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="name" placeholder="Full name" required className={`${input} !pl-9`} autoComplete="name" /></div>
      <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="password" type="password" placeholder="Choose a password (8+ characters)" required minLength={8} className={`${input} !pl-9`} autoComplete="new-password" /></div>
      {error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50"><PartyPopper size={16} />{pending ? "Joining…" : "Join"}</button>
    </form>
  );
}

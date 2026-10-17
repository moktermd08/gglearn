"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, PartyPopper, TriangleAlert, User } from "lucide-react";
import { joinWithInvite } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";

export default function JoinForm({ token, email, signedInAs = null }: { token: string; email: string; signedInAs?: string | null }) {
  const [show, setShow] = useState(false);
  const [error, run, pending] = useActionState(joinWithInvite.bind(null, token), null);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  return (
    <AuthShell title="You are invited." lead="Create your account and your first learning path is waiting.">
    <form action={run} className="space-y-3">
      <div className="flex items-center gap-2"><PartyPopper className="bob text-amber-300" /><h1 className="text-xl font-extrabold">Create your account</h1></div>
      <p className="flex items-center gap-1.5 text-sm text-slate-300"><Mail size={14} className="shrink-0 text-sky-300" />You were invited as <b>{email}</b>.</p>
      {signedInAs && <p role="status" className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-300"><TriangleAlert size={14} className="mt-0.5 shrink-0" />You are signed in as {signedInAs}. Joining switches this browser to the new account, so use a private window if you are only checking the link.</p>}
      <div className="relative"><User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="name" placeholder="Full name" required className={`${input} !pl-9`} autoComplete="name" /></div>
      <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="password" type={show ? "text" : "password"} placeholder="Choose a password (8+ characters)" required minLength={8} className={`${input} !px-9`} autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      {error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50"><PartyPopper size={16} />{pending ? "Joining…" : "Join"}</button>
    </form>
    </AuthShell>
  );
}

"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, Mail, Rocket, TriangleAlert, User } from "lucide-react";
import { signUp } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";

export default function SignUpForm({ next = "", refCode = "", tried = "", social = null }: { next?: string; refCode?: string; tried?: string; social?: React.ReactNode }) {
  const [error, run, pending] = useActionState(signUp, null);
  const [show, setShow] = useState(false);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  const signIn = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <AuthShell title="Start your climb." lead="Free. Pick a subject, find your level and race a rival in under a minute.">
      {social}
      <form action={run} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="ref" value={refCode} />
        <input type="hidden" name="try" value={tried} />
        <div className="flex items-center gap-2"><Rocket className="bob text-indigo-400" /><h1 className="text-xl font-extrabold">Create your account</h1></div>
        <div className="relative"><User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input name="name" placeholder="Your name" required maxLength={80} className={`${input} !pl-9`} autoComplete="name" /></div>
        <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input name="email" type="email" placeholder="Email" required className={`${input} !pl-9`} autoComplete="email" /></div>
        <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input name="password" type={show ? "text" : "password"} placeholder="Choose a password (8+ characters)" required minLength={8} className={`${input} !px-9`} autoComplete="new-password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        <label className="flex items-start gap-2 text-sm text-slate-400"><input type="checkbox" name="nudges" className="mt-1" />Email me a weekly recap and a reminder when my streak is at risk. One click to stop.</label>
        {error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{error}</p>}
        <button disabled={pending} className="btn disabled:opacity-50"><Rocket size={16} />{pending ? "Creating…" : "Create account and start"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">Already have an account? <Link href={signIn} className="font-semibold text-indigo-300 underline">Sign in</Link>. Joining a company or brand? Use the invite link they sent you.</p>
    </AuthShell>
  );
}

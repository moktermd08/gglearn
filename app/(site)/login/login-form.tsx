"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, Eye, EyeOff, KeyRound, LogIn, Mail, Swords, TriangleAlert } from "lucide-react";
import { login } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";

export default function LoginForm({ next = "" }: { next?: string }) {
  const [error, run, pending] = useActionState(login, null);
  const [show, setShow] = useState(false);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  return (
    <AuthShell title="Welcome back." lead="Pick up your climb where you left it. Your rival has been training.">
      <form action={run} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div className="flex items-center gap-2"><Swords className="bob text-pink-300" /><h1 className="text-xl font-extrabold">Sign in</h1></div>
        <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input name="email" type="email" placeholder="Email" required className={`${input} !pl-9`} autoComplete="email" /></div>
        <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input name="password" type={show ? "text" : "password"} placeholder="Password" required className={`${input} !px-9`} autoComplete="current-password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        {error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{error}</p>}
        <button disabled={pending} className="btn disabled:opacity-50"><LogIn size={16} />{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-indigo-300 underline">Create a free account</Link>. Joining a company or brand? Use the invite link they sent you.</p>
      <p className="mt-4 text-center"><Link href={next ? `/signin?next=${encodeURIComponent(next)}` : "/signin"} className="btn btn-ghost !py-1.5 text-sm"><Mail size={14} />Email me a sign-in link instead</Link></p>
      <p className="mt-2 text-center"><Link href={next ? `/sso?next=${encodeURIComponent(next)}` : "/sso"} className="btn btn-ghost !py-1.5 text-sm"><Building2 size={14} />Sign in with your company</Link></p>
      <p className="mt-2 text-center text-sm text-slate-400"><Link href="/forgot" className="font-semibold text-indigo-300 underline">Forgot your password?</Link> We will email you a link to choose a new one.</p>
    </AuthShell>
  );
}

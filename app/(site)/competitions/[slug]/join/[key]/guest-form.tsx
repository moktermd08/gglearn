"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, Mail, Swords, TriangleAlert, User } from "lucide-react";
import { joinAsGuest, joinWithLink } from "../../../actions";

const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";

/** Someone who is signed in: one button. */
export function MemberJoinButton({ slug, k, name }: { slug: string; k: string; name: string }) {
  const [error, run, pending] = useActionState(joinWithLink.bind(null, slug, k), null);
  return (
    <form action={run} className="space-y-3">
      <p className="text-sm text-slate-300">You are signed in as <b>{name}</b>.</p>
      {error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50"><Swords size={16} />{pending ? "Joining…" : "Join the race"}</button>
    </form>
  );
}

/** Someone with no account: name, email, password, and they are in. What they typed stays if it fails, because a form action empties its fields. */
export function GuestJoinForm({ slug, k, path }: { slug: string; k: string; path: string }) {
  const [error, run, pending] = useActionState(joinAsGuest.bind(null, slug, k), null);
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [show, setShow] = useState(false);
  return (
    <form action={run} className="space-y-3">
      <div className="relative"><User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required maxLength={80} className={`${input} !pl-9`} autoComplete="name" /></div>
      <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" required maxLength={120} className={`${input} !pl-9`} autoComplete="email" /></div>
      <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="password" type={show ? "text" : "password"} placeholder="Choose a password (8+ characters)" required minLength={8} className={`${input} !px-9`} autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      {error && <p role="alert" className="slide-in flex items-start gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50"><Swords size={16} />{pending ? "Creating your account…" : "Create my account and join"}</button>
      <p className="text-xs text-slate-400">A free gglearn account, just for learning and racing. Your email is your sign-in.</p>
      <p className="text-sm text-slate-300">Already have an account? <Link href={`/login?next=${encodeURIComponent(path)}`} className="font-semibold text-indigo-300 underline">Sign in to join</Link></p>
    </form>
  );
}

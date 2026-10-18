"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, Rocket, TriangleAlert, User } from "lucide-react";
import { joinAsCustomer } from "@/app/actions";

export default function EntryForm({ slug, cta }: { slug: string; cta: string }) {
  const [error, run, pending] = useActionState(joinAsCustomer.bind(null, slug), null);
  const [show, setShow] = useState(false);
  const input = "w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2";
  return (
    <form action={run} className="space-y-3">
      <div className="relative"><User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="name" placeholder="Your name" required maxLength={80} className={`${input} !pl-9`} autoComplete="name" /></div>
      <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="email" type="email" placeholder="Email" required className={`${input} !pl-9`} autoComplete="email" /></div>
      <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="password" type={show ? "text" : "password"} placeholder="Choose a password (8+ characters)" required minLength={8} className={`${input} !px-9`} autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      {error && <p role="alert" className="flex items-center gap-1.5 text-sm text-rose-500"><TriangleAlert size={14} />{error}</p>}
      <button disabled={pending} className="btn w-full !justify-center disabled:opacity-50"><Rocket size={16} />{pending ? "Creating your account…" : cta}</button>
    </form>
  );
}

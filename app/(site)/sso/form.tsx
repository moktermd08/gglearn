"use client";
import { useActionState } from "react";
import { Building2, Mail, TriangleAlert } from "lucide-react";
import { startCompanySso } from "./actions";

export function SsoForm({ next = "", problem = "" }: { next?: string; problem?: string }) {
  const [error, run, pending] = useActionState(startCompanySso, null);
  const shown = error ?? (problem || null);
  return (
    <form action={run} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input name="email" type="email" required placeholder="Your work email" autoComplete="email" className="w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2 !pl-9" /></div>
      {shown && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{shown}</p>}
      <button disabled={pending} className="btn disabled:opacity-50"><Building2 size={16} />{pending ? "One moment…" : "Continue with your company"}</button>
    </form>
  );
}

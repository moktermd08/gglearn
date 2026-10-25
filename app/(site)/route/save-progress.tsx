"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Save, TriangleAlert } from "lucide-react";
import { saveProgress, type RouteState } from "./actions";

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";

/** Shown to someone who started without an account: one small form that makes the account, keeping what they have done. */
export default function SaveProgress({ next }: { next: string }) {
  const [state, run, pending] = useActionState<RouteState, FormData>(saveProgress, null);
  return (
    <details className="card p-4" aria-label="Save your progress">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Save size={16} className="text-indigo-300" aria-hidden />Save your progress so you can come back on any device</summary>
      <form action={run} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input name="name" placeholder="Your name" required maxLength={80} autoComplete="name" className={input} />
        <input name="email" type="email" placeholder="Email" required autoComplete="email" className={input} />
        <input name="password" type="password" placeholder="Password (8+ characters)" required minLength={8} autoComplete="new-password" className={input} />
        {state?.error && <p role="alert" className="flex items-center gap-1.5 text-sm text-rose-400 sm:col-span-3"><TriangleAlert size={14} />{state.error}</p>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button disabled={pending} className="btn disabled:opacity-50">{pending ? "Saving…" : "Save my progress"}</button>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-slate-400 underline">I already have an account</Link>
        </div>
      </form>
    </details>
  );
}

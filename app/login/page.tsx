"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [error, run, pending] = useActionState(login, null);
  const input = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2";
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <form action={run} className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Sign in</h2>
        <input name="email" type="email" placeholder="Email" required className={input} autoComplete="email" />
        <input name="password" type="password" placeholder="Password" required className={input} autoComplete="current-password" />
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <button disabled={pending} className="btn disabled:opacity-50">Sign in</button>
      </form>
      <p className="text-center text-sm text-slate-400">New here? Ask your manager for an invite link.</p>
    </div>
  );
}

"use client";
import { useActionState } from "react";
import { login, signup } from "../actions";

function Form({ title, action, withName }: { title: string; action: typeof login; withName?: boolean }) {
  const [error, run, pending] = useActionState(action, null);
  const input = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2";
  return (
    <form action={run} className="card space-y-3 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {withName && <input name="name" placeholder="Full name" required className={input} />}
      <input name="email" type="email" placeholder="Email" required className={input} autoComplete="email" />
      <input name="password" type="password" placeholder="Password" required minLength={withName ? 8 : undefined} className={input}
        autoComplete={withName ? "new-password" : "current-password"} />
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50">{title}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-10 sm:grid-cols-2">
      <Form title="Sign in" action={login} />
      <Form title="Create account" action={signup} withName />
    </div>
  );
}

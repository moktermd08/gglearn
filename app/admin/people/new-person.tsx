"use client";
import { useActionState } from "react";
import { createPerson } from "@/app/actions";

export default function NewPerson() {
  const [error, run, pending] = useActionState(createPerson, null);
  const input = "rounded border border-white/20 bg-black/30 px-2 py-1";
  return (
    <form action={run} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/15 p-4 text-sm">
      <input name="name" placeholder="Name" required className={input} />
      <input name="email" type="email" placeholder="Email" required className={input} />
      <input name="jobRole" placeholder="Role (sales, marketing, developer…)" required className={input} />
      <input name="password" type="password" placeholder="Temporary password" minLength={8} required className={input} autoComplete="new-password" />
      <button disabled={pending} className="btn !py-1.5 py-1.5 disabled:opacity-50">Onboard</button>
      {error && <p role="alert" className="w-full text-red-600">{error}</p>}
    </form>
  );
}

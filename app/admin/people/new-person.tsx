"use client";
import { useActionState } from "react";
import { createPerson } from "@/app/actions";

export default function NewPerson() {
  const [error, run, pending] = useActionState(createPerson, null);
  const input = "rounded border border-stone-300 bg-transparent px-2 py-1 dark:border-stone-700";
  return (
    <form action={run} className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 p-4 text-sm dark:border-stone-800">
      <input name="name" placeholder="Name" required className={input} />
      <input name="email" type="email" placeholder="Email" required className={input} />
      <input name="jobRole" placeholder="Role (sales, marketing, developer…)" required className={input} />
      <input name="password" type="password" placeholder="Temporary password" minLength={8} required className={input} autoComplete="new-password" />
      <button disabled={pending} className="rounded bg-stone-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900">Onboard</button>
      {error && <p role="alert" className="w-full text-red-600">{error}</p>}
    </form>
  );
}

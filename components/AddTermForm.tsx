"use client";
import { useActionState } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { addOwnTermAction } from "@/app/terms-actions";

const input = "rounded border border-black/20 bg-[#fff] px-2 py-1";
const RANKS = ["Initiate", "Adept", "Expert", "Master", "Titan"];

/** A candidate's own term: private to them until a super admin adds it to a shared bank. */
export function AddTermForm() {
  const [state, run, pending] = useActionState(addOwnTermAction, null);
  return (
    <form action={run} className="card grid gap-3 p-4 text-sm md:grid-cols-6">
      <label className="grid gap-1 md:col-span-2">Term<input name="term" required minLength={2} maxLength={80} className={input} /></label>
      <label className="grid gap-1 md:col-span-4">What it means, in your words<input name="meaning" required minLength={8} maxLength={300} placeholder="Without using the term itself" className={input} /></label>
      <label className="grid gap-1 md:col-span-2">Group (optional)<input name="groupName" maxLength={60} className={input} /></label>
      <label className="grid gap-1 md:col-span-2">How advanced is it?
        <select name="tier" defaultValue={1} className={input}>{RANKS.map((r, i) => <option key={r} value={i + 1}>{i + 1} · {r}</option>)}</select>
      </label>
      <div className="flex items-end md:col-span-2"><button className="btn" disabled={pending}><Plus size={15} />Add my term</button></div>
      {state?.error && <p role="alert" className="flex items-center gap-1.5 text-rose-600 md:col-span-6"><TriangleAlert size={14} />{state.error}</p>}
      {state?.done && <p role="status" className="flex items-center gap-1.5 text-emerald-700 md:col-span-6"><Check size={14} />{state.done}</p>}
    </form>
  );
}

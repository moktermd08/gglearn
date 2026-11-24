"use client";
import { useActionState } from "react";
import { Check, Plus, Trash2, TriangleAlert } from "lucide-react";
import { promoteTermAction, removeTermAction, saveBankAction, saveTermAction } from "./actions";
import type { SetupState } from "@/lib/setup";

const input = "rounded border border-black/20 bg-[#fff] px-2 py-1";
const RANKS = ["Initiate", "Adept", "Expert", "Master", "Titan"];

function Result({ state }: { state: SetupState }) {
  if (state?.error) return <p role="alert" className="flex w-full items-center gap-1.5 text-sm text-rose-600"><TriangleAlert size={14} />{state.error}</p>;
  if (state?.done) return <p role="status" className="flex w-full items-center gap-1.5 text-sm text-emerald-700"><Check size={14} />{state.done}</p>;
  return null;
}

type Bank = { id: number; name: string; description: string; roles: string };
export type TermRow = { id: number; bankId: number; term: string; meaning: string; groupName: string; tier: number; similar: string; status: "active" | "hidden" };

export function BankForm({ bank }: { bank?: Bank }) {
  const [state, run, pending] = useActionState(saveBankAction, null);
  return (
    <form action={run} className="card grid gap-3 p-4 text-sm md:grid-cols-4">
      {bank && <input type="hidden" name="id" value={bank.id} />}
      <label className="grid gap-1">Name<input name="name" required maxLength={60} defaultValue={bank?.name} className={input} /></label>
      <label className="grid gap-1 md:col-span-2">What it is for<input name="description" maxLength={300} defaultValue={bank?.description} className={input} /></label>
      <label className="grid gap-1">Job roles (comma separated; empty = everyone)<input name="roles" defaultValue={bank?.roles} placeholder="cto, accounting" className={input} /></label>
      <div className="flex items-center gap-3 md:col-span-4"><button className="btn" disabled={pending}>{bank ? "Save bank" : <><Plus size={15} />Add bank</>}</button><Result state={state} /></div>
    </form>
  );
}

/** One term: edit it in place, move it to another bank, hide or delete it. */
export function TermForm({ banks, term, bankId, defaultGroup }: { banks: { id: number; name: string }[]; term?: TermRow; bankId: number; defaultGroup?: string }) {
  const [state, run, pending] = useActionState(saveTermAction, null);
  const [gone, remove, removing] = useActionState(removeTermAction, null);
  return (
    <div className={term ? "border-b border-black/10 py-2" : "card p-4"}>
      <form action={run} className="grid gap-2 text-sm md:grid-cols-12">
        {term && <input type="hidden" name="id" value={term.id} />}
        <input name="term" required maxLength={80} defaultValue={term?.term} placeholder="Term" aria-label="Term" className={`${input} md:col-span-2`} />
        <input name="meaning" required maxLength={300} defaultValue={term?.meaning} placeholder="Meaning" aria-label="Meaning" className={`${input} md:col-span-4`} />
        <input name="groupName" maxLength={60} defaultValue={term?.groupName ?? defaultGroup} placeholder="Group" aria-label="Group" className={`${input} md:col-span-2`} />
        <select name="tier" defaultValue={term?.tier ?? 1} aria-label="Rank" className={`${input} md:col-span-1`}>{RANKS.map((r, i) => <option key={r} value={i + 1}>{i + 1} {r}</option>)}</select>
        <select name="bankId" defaultValue={bankId} aria-label="Bank" className={`${input} md:col-span-2`}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select name="status" defaultValue={term?.status ?? "active"} aria-label="Shown" className={`${input} md:col-span-1`}><option value="active">Shown</option><option value="hidden">Hidden</option></select>
        <input name="similar" defaultValue={term ? (JSON.parse(term.similar) as string[]).join(", ") : ""} placeholder="Easily confused with (comma separated)" aria-label="Easily confused with" className={`${input} md:col-span-9`} />
        <div className="flex items-center gap-2 md:col-span-3"><button className="btn" disabled={pending}>{term ? "Save" : <><Plus size={15} />Add term</>}</button></div>
      </form>
      {term && (
        <form action={remove} className="mt-1 flex items-center gap-2 text-xs">
          <input type="hidden" name="id" value={term.id} />
          <button className="inline-flex items-center gap-1 text-rose-600 underline" disabled={removing}><Trash2 size={12} />Delete or hide</button>
          <Result state={gone} />
        </form>
      )}
      <Result state={state} />
    </div>
  );
}

export function PromoteForm({ id, banks, bankId, groupName }: { id: number; banks: { id: number; name: string }[]; bankId: number; groupName: string }) {
  const [state, run, pending] = useActionState(promoteTermAction, null);
  const [gone, remove, removing] = useActionState(removeTermAction, null);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <form action={run} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <select name="bankId" defaultValue={bankId} aria-label="Bank to add it to" className={input}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input name="groupName" defaultValue={groupName} maxLength={60} placeholder="Group" aria-label="Group" className={input} />
        <button className="btn" disabled={pending}>Add to shared bank</button>
      </form>
      <form action={remove}><input type="hidden" name="id" value={id} /><button className="text-rose-600 underline" disabled={removing}>Remove</button></form>
      <Result state={state ?? gone} />
    </div>
  );
}

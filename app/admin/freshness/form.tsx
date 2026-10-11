"use client";

import { useActionState } from "react";
import { recordKnowledgeChange } from "@/app/actions";
import { Save } from "lucide-react";

export function ChangeForm({ itemId, body }: { itemId: number; body: string }) {
  const [error, action, pending] = useActionState(recordKnowledgeChange, null);
  const input = "w-full rounded border border-white/20 bg-[#fff] px-2 py-1 text-slate-900";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <label className="block text-sm">New text
        <textarea name="body" defaultValue={body} rows={8} required maxLength={20000} className={input} />
      </label>
      <label className="block text-sm">What changed, in one sentence
        <input name="note" maxLength={500} placeholder="e.g. Our moto is now “Ship the lifecycle”, not “Build faster”" className={input} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="material" defaultChecked /> People must read this (untick for a typo or wording fix)
      </label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <button className="btn" disabled={pending}><Save size={16} />{pending ? "Saving…" : "Save and notify"}</button>
    </form>
  );
}

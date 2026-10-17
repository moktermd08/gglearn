"use client";

import { useActionState, useState } from "react";
import { recordKnowledgeChange } from "@/app/actions";
import { BellRing, Save, TriangleAlert } from "lucide-react";

export function ChangeForm({ itemId, body }: { itemId: number; body: string }) {
  const [error, action, pending] = useActionState(recordKnowledgeChange, null);
  const [text, setText] = useState(body), [material, setMaterial] = useState(true);
  const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2 focus:border-amber-400 focus:outline-none";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <label className="block text-sm font-semibold">New text
        <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} rows={8} required maxLength={20000} className={`${input} mt-1 font-normal`} />
        <span className="mt-0.5 block text-right text-xs font-normal text-slate-400">{text.length.toLocaleString("en-GB")} / 20,000{text === body && " · unchanged"}</span>
      </label>
      <label className="block text-sm font-semibold">What changed, in one sentence
        <input name="note" maxLength={500} placeholder="e.g. Our moto is now “Ship the lifecycle”, not “Build faster”" className={`${input} mt-1 font-normal`} />
      </label>
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${material ? "border-amber-400/60 bg-amber-500/10" : "border-black/10"}`}>
        <input type="checkbox" name="material" checked={material} onChange={(e) => setMaterial(e.target.checked)} className="mt-1" />
        <span><b className="flex items-center gap-1.5"><BellRing size={14} className="text-amber-300" />People must read this</b><span className="text-xs text-slate-400">{material ? "Everyone enrolled in this track is asked to read it and confirm." : "Untick for a typo or wording fix: nobody is asked to read it."}</span></span>
      </label>
      {error && <p role="alert" className="flex items-center gap-1.5 text-sm text-rose-300"><TriangleAlert size={14} />{error}</p>}
      <button className="btn" disabled={pending}><Save size={16} />{pending ? "Saving…" : material ? "Save and notify" : "Save"}</button>
    </form>
  );
}

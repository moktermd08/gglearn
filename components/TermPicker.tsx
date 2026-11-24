"use client";
import { useActionState, useMemo, useState } from "react";
import { startCheckAction } from "@/app/terms-actions";

export type PickTerm = { id: number; term: string; tier: number };
export type PickGroup = { name: string; terms: PickTerm[] };
export type PickBank = { key: string; name: string; groups: PickGroup[]; open: boolean };

const RANKS = ["Initiate", "Adept", "Expert", "Master", "Titan"];
const MIN = 5, MAX = 40, NEED_AT_CLAIM = 3;

/** Pick the terms to be tested on, say which rank you think you are at, and start the check. The count and the claim are checked here as you go and again on the server. */
export function TermPicker({ banks, defaultClaim }: { banks: PickBank[]; defaultClaim: number }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [claim, setClaim] = useState(defaultClaim);
  const [error, run, pending] = useActionState(startCheckAction, null);
  const tierOf = useMemo(() => new Map(banks.flatMap((b) => b.groups.flatMap((g) => g.terms.map((t) => [t.id, t.tier] as const)))), [banks]);
  const atClaim = [...picked].filter((id) => tierOf.get(id) === claim).length;
  const toggle = (ids: number[], on: boolean) => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const problem = picked.size < MIN ? `Pick at least ${MIN} terms.` : picked.size > MAX ? `Pick at most ${MAX} terms.` : atClaim < NEED_AT_CLAIM ? `Include at least ${NEED_AT_CLAIM} ${RANKS[claim - 1]} terms, so the check can show whether you are really at that rank.` : null;

  return (
    <form action={run} className="space-y-4">
      <div className="card flex flex-wrap items-end gap-4 p-4 text-sm">
        <label className="grid gap-1">
          <span className="text-xs text-slate-500">I think I am at</span>
          <select name="claimed" value={claim} onChange={(e) => setClaim(Number(e.target.value))} className="rounded border border-black/20 bg-[#fff] px-2 py-1">
            {RANKS.map((r, i) => <option key={r} value={i + 1}>{r}</option>)}
          </select>
        </label>
        <p aria-live="polite" className="text-sm"><b>{picked.size}</b> picked · <b>{atClaim}</b> at {RANKS[claim - 1]}</p>
        <button className="btn" disabled={pending || problem !== null}>{pending ? "Making your check…" : "Make my check"}</button>
        <button type="button" className="text-xs underline" onClick={() => setPicked(new Set())}>Clear</button>
        {(problem || error) && <p role="alert" className="w-full text-sm text-amber-700">{error ?? problem}</p>}
      </div>
      {[...picked].map((id) => <input key={id} type="hidden" name="term" value={id} />)}

      {banks.map((b) => (
        <details key={b.key} open={b.open} className="card p-3">
          <summary className="cursor-pointer text-sm font-semibold">{b.name} <span className="font-normal text-slate-500">({b.groups.reduce((n, g) => n + g.terms.length, 0)} terms)</span></summary>
          <div className="mt-3 space-y-3">
            {b.groups.map((g) => {
              const ids = g.terms.map((t) => t.id), all = ids.every((id) => picked.has(id));
              return (
                <fieldset key={g.name} className="rounded-lg border border-black/10 p-3">
                  <legend className="px-1 text-xs font-semibold text-slate-600">{g.name}</legend>
                  <button type="button" className="mb-2 text-xs underline" onClick={() => toggle(ids, !all)}>{all ? "Clear this group" : "Pick this group"}</button>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {g.terms.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={picked.has(t.id)} onChange={(e) => toggle([t.id], e.target.checked)} />
                        <span>{t.term}</span>
                        <span className="ml-auto text-[10px] text-slate-400" title={RANKS[t.tier - 1]}>{t.tier}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </details>
      ))}
    </form>
  );
}

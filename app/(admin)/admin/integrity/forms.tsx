"use client";
import { useActionState } from "react";
import { Check, Lock, RotateCcw, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import { decideAction, resetPolicyAction, savePolicyAction } from "./actions";
import type { SetupState } from "@/lib/setup";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
function Result({ state }: { state: SetupState }) {
  if (state?.error) return <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>;
  if (state?.done) return <p role="status" className="slide-in flex w-full items-center gap-1.5 text-emerald-400"><Check size={14} />{state.done}</p>;
  return null;
}

/** One setting as the page worked it out: what this level stores, what it would inherit, and who has locked it. */
export type Row = {
  key: string; label: string; help: string; group: string;
  type: "bool" | "enum" | "int"; options?: { value: string; label: string }[]; min?: number; max?: number; unit?: string;
  own: string; // what this level stores ("" = inherits)
  ownLock: boolean;
  inherited: string; // the value it would take from above, in words
  inheritedFrom: string; // which level that comes from
  lockedBy: string | null; // a wider level that has locked it: not editable here
  canLock: boolean;
};

export function PolicyForm({ scope, refId, rows, presets }: { scope: string; refId: number; rows: Row[]; presets: { key: string; label: string; blurb: string }[] }) {
  const [state, run, pending] = useActionState(savePolicyAction, null);
  const groups = [...new Set(rows.map((r) => r.group))];
  // the fields remount when what is saved changes (so a ready-made set shows its values); the form and its message stay put
  const saved = JSON.stringify(rows.map((r) => [r.own, r.ownLock]));
  return (
    <form action={run} className="card space-y-5 p-4 text-sm">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="refId" value={refId} />
      <div key={saved} className="space-y-5">
      <label className="grid gap-1 md:max-w-md">Start from a ready-made set
        <select name="preset" defaultValue="" className={input}>
          <option value="">Keep my choices below</option>
          {presets.map((p) => <option key={p.key} value={p.key}>{p.label}: {p.blurb}</option>)}
        </select>
        <span className="text-xs text-slate-400">A ready-made set replaces every setting it covers (except ones locked above). Pick it, then save.</span>
      </label>
      {groups.map((g) => (
        <fieldset key={g} className="space-y-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{g}</legend>
          <div className="divide-y divide-black/5 rounded-lg border border-black/5">
            {rows.filter((r) => r.group === g).map((r) => (
              <div key={r.key} className="grid gap-x-4 gap-y-1 px-3 py-2.5 md:grid-cols-[1fr_15rem_7rem] md:items-center">
                <div>
                  <div className="font-semibold">{r.label}</div>
                  <div className="text-xs text-slate-400">{r.help}</div>
                </div>
                {r.lockedBy ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 md:col-span-2"><Lock size={13} />Set to <b className="text-slate-200">{r.inherited}</b> and locked by {r.lockedBy}. It cannot be changed here.</div>
                ) : (
                  <>
                    {r.type === "int" ? (
                      <input name={`f_${r.key}`} type="number" inputMode="numeric" min={r.min} max={r.max} defaultValue={r.own} placeholder={`Inherit: ${r.inherited}`} className={input} aria-label={r.label} />
                    ) : (
                      <select name={`f_${r.key}`} defaultValue={r.own || "inherit"} className={input} aria-label={r.label}>
                        <option value="inherit">Inherit: {r.inherited} ({r.inheritedFrom})</option>
                        {r.type === "bool" ? <><option value="on">On</option><option value="off">Off</option></> : r.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    {r.canLock ? (
                      <label className="flex items-center gap-1.5 text-xs" title="Nothing below this level may change it"><input type="checkbox" name={`lock_${r.key}`} value="on" defaultChecked={r.ownLock} /><Lock size={12} />Lock below</label>
                    ) : <span />}
                  </>
                )}
                {r.type === "int" && !r.lockedBy && <div className="text-xs text-slate-400 md:col-start-2 md:col-span-2">Blank inherits {r.inherited} ({r.inheritedFrom}).</div>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><ShieldCheck size={14} />{pending ? "Saving…" : "Save policy here"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function ResetForm({ scope, refId }: { scope: string; refId: number }) {
  const [state, run, pending] = useActionState(resetPolicyAction, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="refId" value={refId} />
      <button disabled={pending} className="btn btn-ghost !py-1 text-xs disabled:opacity-50"><RotateCcw size={13} />Make this level inherit everything</button>
      <Result state={state} />
    </form>
  );
}

export function DecideForm({ sessionId, held }: { sessionId: number; held: boolean }) {
  const [state, run, pending] = useActionState(decideAction, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input name="note" maxLength={300} placeholder="Note (needed to reject; the person sees it)" className={`${input} min-w-64 flex-1`} aria-label="Note" />
      <button name="to" value="clear" disabled={pending} className="btn !py-1 text-xs disabled:opacity-50"><ShieldCheck size={13} />{held ? "Clear and release reward" : "Clear"}</button>
      <button name="to" value="reject" disabled={pending} className="btn btn-ghost !py-1 text-xs disabled:opacity-50"><ShieldX size={13} />Reject the pass</button>
      <Result state={state} />
    </form>
  );
}

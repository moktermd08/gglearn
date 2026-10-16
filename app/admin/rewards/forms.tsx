"use client";
import { useActionState } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { saveRewardRule, settleReward } from "./actions";
import type { SetupState } from "@/lib/setup";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
function Result({ state }: { state: SetupState }) {
  if (state?.error) return <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>;
  if (state?.done) return <p role="status" className="slide-in flex w-full items-center gap-1.5 text-emerald-400"><Check size={14} />{state.done}</p>;
  return null;
}

type Target = { scope: "company" | "brand" | "track"; id: number; label: string };

export function RuleForm({ targets, currencies }: { targets: Target[]; currencies: string[] }) {
  const [state, run, pending] = useActionState(saveRewardRule, null);
  return (
    <form action={run} className="card grid gap-3 p-4 text-sm md:grid-cols-4">
      <label className="grid gap-1 md:col-span-2">Applies to
        <select name="target" required className={input} onChange={(e) => {
          const [scope, id] = e.target.value.split(":");
          const f = e.target.form!; (f.elements.namedItem("scope") as HTMLInputElement).value = scope; (f.elements.namedItem("refId") as HTMLInputElement).value = id;
        }} defaultValue={targets[0] ? `${targets[0].scope}:${targets[0].id}` : ""}>
          {targets.map((t) => <option key={`${t.scope}:${t.id}`} value={`${t.scope}:${t.id}`}>{t.label}</option>)}
        </select>
        <input type="hidden" name="scope" defaultValue={targets[0]?.scope} />
        <input type="hidden" name="refId" defaultValue={targets[0]?.id} />
      </label>
      <label className="grid gap-1">When someone first passes level
        <input name="level" type="number" min={1} max={20} defaultValue={5} className={input} />
      </label>
      <label className="grid gap-1">They get
        <select name="kind" defaultValue="xp" className={input}>
          <option value="certificate">A certificate</option>
          <option value="xp">Bonus XP</option>
          <option value="voucher">A voucher</option>
          <option value="money">Money</option>
        </select>
      </label>
      <label className="grid gap-1">Amount (XP, or money in whole units)
        <input name="amount" inputMode="decimal" placeholder="e.g. 100 or 25.50" className={input} />
      </label>
      <label className="grid gap-1">Currency (money only)
        <select name="currency" defaultValue={currencies[0]} className={input}>{currencies.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="grid gap-1">What the voucher is for
        <input name="label" maxLength={120} placeholder="e.g. £10 coffee card" className={input} />
      </label>
      <label className="grid gap-1">Most people who can earn it
        <input name="maxAwards" type="number" min={0} placeholder="Required for vouchers and money" className={input} />
      </label>
      <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="enabled" value="off" />Switch this reward <b>off</b> here and below (for example, no certificate)</label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-4">
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Plus size={14} />{pending ? "Saving…" : "Save rule"}</button>
        <span className="text-xs text-slate-400">A track rule beats its brand&rsquo;s, which beats its company&rsquo;s. One rule per place, level and reward.</span>
        <Result state={state} />
      </div>
    </form>
  );
}

export function SettleForm({ awardId }: { awardId: number }) {
  const [state, run, pending] = useActionState(settleReward, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="awardId" value={awardId} />
      <input name="reference" placeholder="Voucher code or payment reference" maxLength={200} className={`${input} min-w-52`} aria-label="Reference" />
      <button name="to" value="fulfilled" disabled={pending} className="btn !py-1 text-xs disabled:opacity-50">Mark sent</button>
      <button name="to" value="void" disabled={pending} className="btn btn-ghost !py-1 text-xs disabled:opacity-50">Void</button>
      <Result state={state} />
    </form>
  );
}

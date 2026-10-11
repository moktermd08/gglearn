"use client";
import { useActionState } from "react";
import { Check, Copy, Link2, TriangleAlert } from "lucide-react";
import { createInvite, type InviteState } from "@/app/actions";
import { ScopePicker } from "@/components/ScopePicker";
import type { ScopeOptions } from "@/lib/paths";

export default function InvitePerson({ options }: { options: ScopeOptions }) {
  const [state, run, pending] = useActionState<InviteState, FormData>(createInvite, null);
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
  const link = state?.path ? `${window.location.origin}${state.path}` : null;
  return (
    <form action={run} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
      <input name="email" type="email" placeholder="Their email" required className={input} />
      <input name="jobRole" placeholder="Role (sales, marketing, developer…)" required className={input} />
      <select name="audience" className={input} defaultValue="staff" aria-label="Staff or customer">
        <option value="staff">Staff</option>
        <option value="customer">Customer</option>
      </select>
      <ScopePicker options={options} />
      <button disabled={pending} className="btn !py-1.5 py-1.5 disabled:opacity-50"><Link2 size={14} />{pending ? "Creating…" : "Create invite link"}</button>
      {state?.error && <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      {link && (
        <p className="pop w-full text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-300"><Check size={14} />Invite ready.</span>
          <span className="flex items-center gap-1.5"><Copy size={13} className="text-slate-400" />Send this link (single use, valid 7 days, shown once):</span>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${input} mt-1 block w-full`} />
        </p>
      )}
    </form>
  );
}

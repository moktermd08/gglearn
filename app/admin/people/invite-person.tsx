"use client";
import { useActionState } from "react";
import { Check, Copy, Info, Link2, TriangleAlert } from "lucide-react";
import { createInvite, type InviteState } from "@/app/actions";
import { RoleInput } from "@/components/RoleInput";
import { ScopePicker } from "@/components/ScopePicker";
import type { ScopeOptions } from "@/lib/paths";

export default function InvitePerson({ options, roles }: { options: ScopeOptions; roles: string[] }) {
  const [state, run, pending] = useActionState<InviteState, FormData>(createInvite, null);
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
  return (
    <form action={run} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
      <textarea name="emails" required rows={2} placeholder="Their emails: one, or a whole team separated by commas or new lines" aria-label="Their emails" className={`${input} min-w-64 flex-1`} />
      <RoleInput roles={roles} id="invite-roles" className={input} />
      <select name="audience" className={input} defaultValue="staff" aria-label="Staff or customer">
        <option value="staff">Staff</option>
        <option value="customer">Customer</option>
      </select>
      <ScopePicker options={options} />
      <button disabled={pending} className="btn !py-1.5 py-1.5 disabled:opacity-50"><Link2 size={14} />{pending ? "Creating…" : "Create invite links"}</button>
      {state?.error && <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      {!pending && state?.notice && <p role="status" className="slide-in flex w-full items-start gap-1.5 text-amber-300"><Info size={14} className="mt-0.5 shrink-0" />{state.notice}</p>}
      {!pending && state?.skipped && <p className="w-full text-slate-400">No link for {state.skipped.join(", ")}: already has an account.</p>}
      {!pending && state?.invites && (
        <div className="pop w-full space-y-2 text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-300"><Check size={14} />{state.invites.length === 1 ? "Invite ready." : `${state.invites.length} invites ready.`}</span>
          <span className="flex items-center gap-1.5"><Copy size={13} className="text-slate-400" />Send each person their own link (single use, valid 7 days, shown once):</span>
          <ul className="space-y-2">
            {state.invites.map((i) => (
              <li key={i.email}>
                <label className="block text-xs text-slate-400">For <b className="text-slate-200">{i.email}</b></label>
                <input readOnly aria-label={`Invite link for ${i.email}`} value={`${typeof window === "undefined" ? "" : window.location.origin}${i.path}`} onFocus={(e) => e.currentTarget.select()} className={`${input} block w-full`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

"use client";
import { useActionState, useState } from "react";
import { Check, Download, FileUp, Info, Link2, Mail, TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { bulkInvite, createInvite, type InviteState } from "@/app/actions";
import { MAX_BULK } from "@/lib/bulkInvite";
import { RoleInput } from "@/components/RoleInput";
import { ScopePicker } from "@/components/ScopePicker";
import { AccessSelect, type AccessChoice } from "@/components/AccessSelect";
import type { Scope, ScopeOptions } from "@/lib/paths";

/** "company:1,brand:2" back into scopes. Local on purpose: lib/paths reads the database, so a client component may only import its types. */
const scopesFrom = (raw: string): Scope[] => raw.split(",").flatMap((p) => {
  const [kind, id] = p.split(":");
  return (kind === "company" || kind === "brand" || kind === "project") && Number(id) > 0 ? [{ kind, id: Number(id) } as Scope] : [];
});

/** The note a manager sends: who invited them, to what, and the one link. Written so it makes sense with nothing around it. */
function inviteMessage(m: { from: string; where: string; role: string; access: string }, link: string) {
  return {
    subject: `${m.from} invited you to gglearn`,
    body: `Hi,\n\n${m.from} has invited you to join ${m.where} on gglearn as ${m.role}${m.access === "learner" ? "" : ` (with ${m.access} access)`}.\n\nCreate your account here (the link works once and expires in 7 days):\n${link}\n\nSee you there.`,
  };
}

export default function InvitePerson({ options, roles, access = [], mailReady = false }: { options: ScopeOptions; roles: string[]; access?: AccessChoice[]; mailReady?: boolean }) {
  const [one, runOne, onePending] = useActionState<InviteState, FormData>(createInvite, null);
  const [many, runMany, manyPending] = useActionState<InviteState, FormData>(bulkInvite, null);
  const [mode, setMode] = useState<"one" | "bulk">("one");
  const bulk = mode === "bulk";
  const state = bulk ? many : one, run = bulk ? runMany : runOne, pending = bulk ? manyPending : onePending;
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
  const kept = state?.values; // after an error the form shows what was typed instead of emptying
  return (
    <form action={run} key={`${mode}-${kept ? `kept-${kept.emails}|${kept.jobRole}|${kept.scopes}` : "fresh"}`} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
      <div className="flex w-full gap-1" role="tablist" aria-label="How many people">
        {([["one", "One by one, or a few"], ["bulk", `A whole list (up to ${MAX_BULK})`]] as const).map(([m, t]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m ? "bg-indigo-500 text-[#fff]" : "bg-black/5 text-slate-500 hover:bg-black/10"}`}>{t}</button>
        ))}
      </div>
      {bulk ? (
        <div className="w-full space-y-2">
          <textarea name="csv" rows={5} defaultValue={kept?.emails} placeholder={"One person per line, as email or email,role. A spreadsheet saved as CSV works as it is.\nana@example.com,designer\nben@example.com,sales"} aria-label="The list of people" className={`${input} block w-full font-mono text-xs`} />
          <label className="flex flex-wrap items-center gap-2 text-slate-400"><FileUp size={14} />or choose a CSV file <input type="file" name="file" accept=".csv,.txt,text/csv,text/plain" className="text-xs" /></label>
          <p className="text-xs text-slate-400">The role chosen below is used for any line that does not give one.</p>
        </div>
      ) : (
        <textarea name="emails" required rows={2} defaultValue={kept?.emails} placeholder="Their emails: one, or a whole team separated by commas or new lines" aria-label="Their emails" className={`${input} min-w-64 flex-1`} />
      )}
      <RoleInput roles={roles} id="invite-roles" defaultValue={kept?.jobRole} className={input} />
      <select name="audience" className={input} defaultValue={kept?.audience ?? "staff"} aria-label="Staff or customer">
        <option value="staff">Staff</option>
        <option value="customer">Customer</option>
      </select>
      <AccessSelect choices={access} defaultValue={kept?.access} className={input} />
      <ScopePicker options={options} selected={kept ? scopesFrom(kept.scopes) : []} />
      {mailReady && <label className="flex items-center gap-2"><input type="checkbox" name="sendEmail" defaultChecked={kept?.sendEmail ?? true} />Email the invitation now</label>}
      <button disabled={pending} className="btn !py-1.5 py-1.5 disabled:opacity-50"><Link2 size={14} />{pending ? "Creating…" : mailReady ? "Create and send invites" : "Create invites"}</button>
      {state?.error && <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      {!pending && state?.notice && <p role="status" className="slide-in flex w-full items-start gap-1.5 text-amber-300"><Info size={14} className="mt-0.5 shrink-0" />{state.notice}</p>}
      {!pending && state?.rejected && state.rejected.length > 0 && (
        <details className="w-full text-amber-300"><summary className="cursor-pointer">{state.rejected.length} line{state.rejected.length === 1 ? "" : "s"} could not be used</summary>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-400">{state.rejected.slice(0, 50).map((r) => <li key={r}>{r}</li>)}{state.rejected.length > 50 && <li>and {state.rejected.length - 50} more</li>}</ul></details>
      )}
      {!pending && state?.skipped && <p className="w-full text-slate-400">No link for {state.skipped.join(", ")}: already has an account.</p>}
      {!pending && state?.invites && (
        <div className="pop w-full space-y-2 text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-300"><Check size={14} />{state.invites.length === 1 ? "Invite ready." : `${state.invites.length} invites ready.`}</span>
          <span className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-1.5"><Mail size={13} className="shrink-0 text-slate-400" />{state.mail
              ? <span>{state.mail.sent.length > 0 && <>Emailed to <b className="text-slate-200">{state.mail.sent.join(", ")}</b>. </>}{state.mail.failed.length > 0 && <span className="text-amber-300">Could not email {state.mail.failed.map((f) => `${f.email} (${f.error})`).join("; ")}: send those yourself with <b>Open in email</b> or copy the link. </span>}The links are below too. Each works once, for 7 days, and is shown only now.</span>
              : <span>Next: send each person their invite. {mailReady ? "You chose not to email them from here, so use" : "gglearn is not set up to send email, so use"} <b className="text-slate-200">Open in email</b> (your mail app opens with the message written) or copy it. Each link works once, for 7 days, and is shown only now.</span>}</span>
            {state.invites.length > 1 && <CopyButton label="Copy all links" text={state.invites.map((i) => `${i.email}: ${i.url}`).join("\n")} />}
            {state.invites.length > 1 && <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-xs" onClick={() => { const csv = "email,role,link\n" + state.invites!.map((i) => `${i.email},${i.jobRole ?? ""},${i.url}`).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gglearn-invites.csv"; a.click(); URL.revokeObjectURL(a.href); }}><Download size={13} />Download CSV</button>}</span>
          <ul className="space-y-2">
            {state.invites.map((i) => (
              <li key={i.email}>
                <label className="block text-xs text-slate-400">For <b className="text-slate-200">{i.email}</b></label>
                <div className="flex flex-wrap gap-2">
                  <input readOnly aria-label={`Invite link for ${i.email}`} value={i.url} onFocus={(e) => e.currentTarget.select()} className={`${input} block min-w-0 flex-1`} />
                  {state.message && (() => {
                    const msg = inviteMessage(state.message, i.url);
                    return (<>
                      <a className="btn !px-2.5 !py-1 text-xs" href={`mailto:${i.email}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`}><Mail size={13} />Open in email</a>
                      <CopyButton label="Copy message" text={msg.body} />
                    </>);
                  })()}
                  <CopyButton label="Copy link" text={i.url} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

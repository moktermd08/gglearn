"use client";
import { useActionState } from "react";
import { Ban, Check, Eye, MessageSquare, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { blockAccountAction, clearMessageAction, saveDetailsAction, setMessageAction, startViewAsAction, unblockAccountAction } from "@/app/super-actions";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";

export type Control = { blocked: boolean; reason: string; since: string; message: string; tone: string };

/** What only a super admin sees in someone's panel: edit their name and email, view the app as them, block the account, and leave them a message. All checked again on the server. */
export function SuperTools({ userId, name, email, canView, control }: { userId: number; name: string; email: string; canView: boolean; control: Control }) {
  const [blockMsg, block, blocking] = useActionState(blockAccountAction, null);
  const [unblockMsg, unblock, unblocking] = useActionState(unblockAccountAction, null);
  const [setMsg, setMessage, setting] = useActionState(setMessageAction, null);
  const [clearMsg, clearMessage, clearing] = useActionState(clearMessageAction, null);
  const [saved, save, saving] = useActionState(saveDetailsAction, null);
  const [viewErr, view, starting] = useActionState(startViewAsAction, null);
  const first = name.split(" ")[0];
  return (
    <div className="space-y-4 text-sm">
      <form action={save} className="space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <p className="font-semibold">Name and email</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block space-y-1"><span className="block text-xs font-semibold text-slate-400">Name</span><input name="name" defaultValue={name} required maxLength={80} className={`${input} min-w-48`} /></label>
          <label className="block space-y-1"><span className="block text-xs font-semibold text-slate-400">Email</span><input name="email" type="email" defaultValue={email} required maxLength={120} className={`${input} min-w-64`} /></label>
          <button disabled={saving} className="btn btn-ghost !px-3 !py-1.5 disabled:opacity-50"><Save size={14} aria-hidden />{saving ? "Saving…" : "Save"}</button>
        </div>
        <p className="text-xs text-slate-400">Changing the email signs {first} out everywhere. Both changes are kept in the security log.</p>
        {saved === "ok" && <p role="status" className="flex items-center gap-1.5 text-emerald-600"><Check size={14} aria-hidden />Saved.</p>}
        {saved && saved !== "ok" && <p role="alert" className="flex items-center gap-1.5 text-rose-500"><TriangleAlert size={14} aria-hidden />{saved}</p>}
      </form>
      <div className="space-y-2 border-t border-black/10 pt-3">
        <p className="flex items-center gap-1.5 font-semibold"><Ban size={14} aria-hidden />{control.blocked ? "This account is blocked" : "Block account"}</p>
        {control.blocked ? (
          <form action={unblock} className="space-y-2">
            <input type="hidden" name="userId" value={userId} />
            <p className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-900">Blocked {control.since}. {first} is told: &ldquo;{control.reason}&rdquo;</p>
            <button disabled={unblocking} className="btn btn-ghost !px-3 !py-1.5 disabled:opacity-50"><ShieldCheck size={14} aria-hidden />{unblocking ? "Working…" : `Unblock ${first}`}</button>
            {unblockMsg === "ok" ? <p role="status" className="text-emerald-600">Unblocked.</p> : unblockMsg && <p role="alert" className="text-rose-500">{unblockMsg}</p>}
          </form>
        ) : (
          <form action={block} className="space-y-2" onSubmit={(e) => { if (!window.confirm(`Block ${name}? They will be signed out and cannot use the platform until you unblock them.`)) e.preventDefault(); }}>
            <input type="hidden" name="userId" value={userId} />
            <p className="text-xs text-slate-400">They cannot sign in or use the platform until you unblock them, and any session they have stops at once. Their records are untouched. They are told the reason below, but only after they prove who they are.</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block min-w-64 flex-1 space-y-1"><span className="block text-xs font-semibold text-slate-400">Reason they will see (required)</span><input name="reason" required minLength={8} maxLength={300} placeholder="e.g. Your account is paused while we check a security concern. Contact support@…" className={`${input} w-full`} autoComplete="off" /></label>
              <button disabled={blocking} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-500/25 disabled:opacity-50"><Ban size={14} aria-hidden />{blocking ? "Blocking…" : `Block ${first}`}</button>
            </div>
            {blockMsg === "ok" ? <p role="status" className="text-emerald-600">Blocked.</p> : blockMsg && <p role="alert" className="text-rose-500">{blockMsg}</p>}
          </form>
        )}
      </div>
      <div className="space-y-2 border-t border-black/10 pt-3">
        <p className="flex items-center gap-1.5 font-semibold"><MessageSquare size={14} aria-hidden />Message for {first}</p>
        {control.message && (
          <form action={clearMessage} className="flex flex-wrap items-center gap-2 rounded-lg bg-black/[0.04] p-2 text-xs">
            <input type="hidden" name="userId" value={userId} />
            <span className="min-w-0 flex-1"><b>{control.tone === "warning" ? "Important" : "Info"}:</b> {control.message}</span>
            <button disabled={clearing} className="rounded-md border border-black/10 px-2 py-0.5 font-semibold hover:bg-black/5 disabled:opacity-50">{clearing ? "Clearing…" : "Clear"}</button>
            {clearMsg && clearMsg !== "ok" && <span role="alert" className="text-rose-500">{clearMsg}</span>}
          </form>
        )}
        <form action={setMessage} className="space-y-2">
          <input type="hidden" name="userId" value={userId} />
          <p className="text-xs text-slate-400">Shown at the top of every page until {first} presses OK, and in their notifications. Plain text.</p>
          <textarea name="message" required minLength={3} maxLength={500} rows={2} placeholder="e.g. Please finish your compliance training by Friday. Call me if you are stuck." aria-label={`Message for ${name}`} className={`${input} w-full`} />
          <div className="flex flex-wrap items-center gap-2">
            <select name="tone" defaultValue="info" aria-label="How it looks" className={input}><option value="info">Information (blue)</option><option value="warning">Important (amber)</option></select>
            <button disabled={setting} className="btn btn-ghost !px-3 !py-1.5 disabled:opacity-50"><MessageSquare size={14} aria-hidden />{setting ? "Sending…" : control.message ? "Replace message" : "Set message"}</button>
          </div>
          {setMsg === "ok" ? <p role="status" className="text-emerald-600">Set.</p> : setMsg && <p role="alert" className="text-rose-500">{setMsg}</p>}
        </form>
      </div>
      {canView && (
        <form action={view} className="space-y-2 border-t border-black/10 pt-3">
          <input type="hidden" name="userId" value={userId} />
          <p className="font-semibold">View as {first}</p>
          <p className="text-xs text-slate-400">You will use the academy as {first}, with a red bar on every page and a one-click exit. It ends by itself after an hour. You cannot change their password or email, sign them out or offboard them while viewing. The start and end, and your reason, are kept in the security log.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-64 flex-1 space-y-1"><span className="block text-xs font-semibold text-slate-400">Why (required)</span><input name="reason" required minLength={8} maxLength={200} placeholder="e.g. Maksuda cannot see her course, checking" className={`${input} w-full`} autoComplete="off" /></label>
            <button disabled={starting} className="btn !px-3 !py-1.5 disabled:opacity-50"><Eye size={14} aria-hidden />{starting ? "Starting…" : `View as ${first}`}</button>
          </div>
          {viewErr && <p role="alert" className="flex items-center gap-1.5 text-rose-500"><TriangleAlert size={14} aria-hidden />{viewErr}</p>}
        </form>
      )}
    </div>
  );
}

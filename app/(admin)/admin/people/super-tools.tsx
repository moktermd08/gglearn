"use client";
import { useActionState } from "react";
import { Check, Eye, Save, TriangleAlert } from "lucide-react";
import { saveDetailsAction, startViewAsAction } from "@/app/super-actions";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";

/** What only a super admin sees in someone's panel: edit their name and email, and view the app as them. Both are checked again on the server. */
export function SuperTools({ userId, name, email, canView }: { userId: number; name: string; email: string; canView: boolean }) {
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

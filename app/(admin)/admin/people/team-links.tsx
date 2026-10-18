"use client";
import { useActionState } from "react";
import { Check, Link2, Trash2, TriangleAlert } from "lucide-react";
import { createJoinLink, revokeJoinLink, type LinkMade } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { RoleInput } from "@/components/RoleInput";
import { ScopePicker } from "@/components/ScopePicker";
import { DEFAULT_LINK_DAYS, DEFAULT_LINK_USES, MAX_LINK_DAYS, MAX_LINK_USES } from "@/lib/joinLinks-shared";
import type { ScopeOptions } from "@/lib/paths";

export type LinkRow = { id: number; label: string; role: string; where: string; uses: number; max: number; state: "open" | "revoked" | "expired" | "full"; expires: string; url: string };

const STATE = { open: ["Open", "text-emerald-400"], full: ["Full", "text-amber-400"], expired: ["Expired", "text-slate-400"], revoked: ["Switched off", "text-slate-400"] } as const;

/** One link for a whole team: pick where it is for and how many may use it. Copy it again any time; switch it off when the team is in. */
export default function TeamLinks({ options, roles, links, origin }: { options: ScopeOptions; roles: string[]; links: LinkRow[]; origin: string }) {
  const [made, run, pending] = useActionState<LinkMade, FormData>(createJoinLink, null);
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
  return (
    <div className="space-y-3">
      <form action={run} className="card flex flex-wrap items-end gap-2 p-4 text-sm">
        <input name="label" maxLength={60} placeholder="What is it for? (optional, only you see this)" aria-label="Label" className={`${input} min-w-56 flex-1`} />
        <RoleInput roles={roles} id="link-roles" className={input} />
        <select name="audience" className={input} defaultValue="staff" aria-label="Staff or customer"><option value="staff">Staff</option><option value="customer">Customer</option></select>
        <label className="flex items-center gap-1.5">Places <input name="maxUses" type="number" min={1} max={MAX_LINK_USES} defaultValue={DEFAULT_LINK_USES} className={`${input} w-20`} /></label>
        <label className="flex items-center gap-1.5">Days <input name="days" type="number" min={1} max={MAX_LINK_DAYS} defaultValue={DEFAULT_LINK_DAYS} className={`${input} w-16`} /></label>
        <ScopePicker options={options} selected={[]} />
        <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Link2 size={14} />{pending ? "Making…" : "Make a team link"}</button>
        {made?.error && <p role="alert" className="slide-in flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{made.error}</p>}
        {made?.path && (
          <div className="pop flex w-full flex-wrap items-center gap-2 text-slate-300"><Check size={14} className="text-emerald-400" />Ready. Post it in your team chat.
            <input readOnly aria-label="Team link" value={`${origin}${made.path}`} onFocus={(e) => e.currentTarget.select()} className={`${input} min-w-0 flex-1`} />
            <CopyButton label="Copy link" text={`${origin}${made.path}`} /></div>
        )}
        <p className="w-full text-xs text-slate-400">Anyone with the link can make their own account here, as a learner, until the places run out or the days are up. It cannot give manager or admin access. Share it only where your team is.</p>
      </form>
      {links.length > 0 && (
        <ul className="card divide-y divide-black/5 text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
              <span className="min-w-0 flex-1"><b className="block truncate">{l.label || `${l.role} · ${l.where}`}</b><span className="text-xs text-slate-400">{l.role} · {l.where} · expires {l.expires}</span></span>
              <span className="text-xs text-slate-400">{l.uses} of {l.max} used</span>
              <span className={`text-xs font-semibold ${STATE[l.state][1]}`}>{STATE[l.state][0]}</span>
              {l.state === "open" && <CopyButton label="Copy link" text={`${origin}${l.url}`} />}
              {l.state === "open" && <form action={revokeJoinLink.bind(null, l.id)}><button className="inline-flex items-center gap-1 text-xs text-rose-400 underline"><Trash2 size={12} />Switch off</button></form>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

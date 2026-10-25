"use client";
import { Trash2 } from "lucide-react";
import { revokeJoinLink } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";

export type LinkRow = { id: number; label: string; role: string; where: string; uses: number; max: number; state: "open" | "revoked" | "expired" | "full"; expires: string; url: string };

const STATE = { open: ["Open", "text-emerald-700"], full: ["Full", "text-amber-700"], expired: ["Expired", "text-slate-400"], revoked: ["Switched off", "text-slate-400"] } as const;

/** The team links already made: copy one again any time, switch it off when the team is in. Making a new one is part of Add people. */
export default function TeamLinkList({ links, origin }: { links: LinkRow[]; origin: string }) {
  if (!links.length) return null;
  return (
    <details className="card text-sm">
      <summary className="cursor-pointer p-4 font-semibold">Team links you have made <span className="font-normal text-slate-400">({links.length})</span></summary>
      <ul className="divide-y divide-black/5 border-t border-black/5">
        {links.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <span className="min-w-0 flex-1"><b className="block truncate">{l.label || `${l.role} · ${l.where}`}</b><span className="text-xs text-slate-400">{l.role} · {l.where} · expires {l.expires}</span></span>
            <span className="text-xs text-slate-400">{l.uses} of {l.max} used</span>
            <span className={`text-xs font-semibold ${STATE[l.state][1]}`}>{STATE[l.state][0]}</span>
            {l.state === "open" && <CopyButton label="Copy link" text={`${origin}${l.url}`} />}
            {l.state === "open" && <form action={revokeJoinLink.bind(null, l.id)}><button className="inline-flex items-center gap-1 text-xs text-rose-700 underline"><Trash2 size={12} aria-hidden />Switch off</button></form>}
          </li>
        ))}
      </ul>
    </details>
  );
}

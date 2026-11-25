"use client";
import { useState } from "react";
import { chooseRoleAction } from "@/app/terms-actions";

export type PickRole = { role: string; label: string; hasTerms: boolean; levels: { level: number; title: string }[] };

const input = "rounded border border-black/20 bg-[#fff] px-2 py-1";

/** Choose a role and the level you are aiming at: the list of terms you must know for it is made from those two choices. */
export function RolePicker({ roles, defaultRole, defaultLevel }: { roles: PickRole[]; defaultRole: string; defaultLevel: number }) {
  const first = roles.find((r) => r.role === defaultRole) ?? roles[0];
  const [role, setRole] = useState(first?.role ?? "");
  const current = roles.find((r) => r.role === role) ?? first;
  const [level, setLevel] = useState(first?.role === role && first.levels.some((l) => l.level === defaultLevel) ? defaultLevel : (current?.levels[0]?.level ?? 1));
  if (!roles.length) return null;
  return (
    <form action={chooseRoleAction} className="card flex flex-wrap items-end gap-3 p-4 text-sm">
      <label className="grid gap-1">
        <span className="text-xs text-slate-500">The role</span>
        <select name="role" value={role} onChange={(e) => { setRole(e.target.value); setLevel(roles.find((r) => r.role === e.target.value)?.levels[0]?.level ?? 1); }} className={`${input} min-w-56`}>
          {roles.map((r) => <option key={r.role} value={r.role}>{r.label}{r.hasTerms ? "" : " (everyone's terms only)"}</option>)}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-slate-500">The level I am aiming at</span>
        <select name="level" value={level} onChange={(e) => setLevel(Number(e.target.value))} className={`${input} min-w-56`}>
          {current?.levels.map((l) => <option key={l.level} value={l.level}>{l.title}</option>)}
        </select>
      </label>
      <button className="btn">Show my terms</button>
    </form>
  );
}

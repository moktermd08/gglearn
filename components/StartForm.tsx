"use client";
import { useState } from "react";
import { beginAction } from "@/app/terms-actions";
import type { PickRole } from "@/components/RolePicker";

const input = "w-full rounded border border-black/20 bg-[#fff] px-2 py-1.5";

/** The first screen: what do you want to learn, how far do you want to get, and how much do you know already. */
export function StartForm({ roles, defaultRole, defaultLevel, hasGoal }: { roles: PickRole[]; defaultRole: string; defaultLevel: number; hasGoal: boolean }) {
  const first = roles.find((r) => r.role === defaultRole) ?? roles[0];
  const [role, setRole] = useState(first?.role ?? "");
  const current = roles.find((r) => r.role === role) ?? first;
  const [level, setLevel] = useState(first?.levels.some((l) => l.level === defaultLevel) ? defaultLevel : (first?.levels[0]?.level ?? 1));
  const [how, setHow] = useState<"new" | "some">("new");
  const laddered = current?.role !== "everyone";
  return (
    <form action={beginAction} className="card space-y-5 p-5 text-sm">
      <fieldset className="space-y-2">
        <legend className="font-semibold">1. What do you want to learn?</legend>
        <select name="role" value={role} onChange={(e) => { setRole(e.target.value); setLevel(roles.find((r) => r.role === e.target.value)?.levels[0]?.level ?? 1); }} className={input} aria-label="The role">
          {roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
        </select>
        <p className="text-xs text-slate-500">No job in mind? Choose “Any office job”: the words everyone at work needs.</p>
      </fieldset>
      {(current?.levels.length ?? 0) > 1 && (
        <fieldset className="space-y-2">
          <legend className="font-semibold">2. How far do you want to get?</legend>
          <select name="level" value={level} onChange={(e) => setLevel(Number(e.target.value))} className={input} aria-label="The level I am aiming at">
            {current?.levels.map((l) => <option key={l.level} value={l.level}>{l.title}</option>)}
          </select>
        </fieldset>
      )}
      {(current?.levels.length ?? 0) <= 1 && <input type="hidden" name="level" value={current?.levels[0]?.level ?? 1} />}
      <fieldset className="space-y-2">
        <legend className="font-semibold">{(current?.levels.length ?? 0) > 1 ? "3" : "2"}. How much do you know already?</legend>
        <label className="flex items-start gap-2"><input type="radio" name="how" value="new" checked={how === "new"} onChange={() => setHow("new")} className="mt-1" /><span><b>Nothing yet.</b> Start me at the beginning with the easiest words.</span></label>
        <label className="flex items-start gap-2"><input type="radio" name="how" value="some" checked={how === "some"} onChange={() => setHow("some")} className="mt-1" /><span><b>Some, or a lot.</b> Find my level: questions start easy and get deeper, and stop where I stop passing.</span></label>
      </fieldset>
      {laddered && !hasGoal && <label className="flex items-center gap-2"><input type="checkbox" name="goal" defaultChecked />Make this my career goal, so my progress is measured against it.</label>}
      <button className="btn">{how === "new" ? "Start learning" : "Find my level"}</button>
    </form>
  );
}

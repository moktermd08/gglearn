"use client";
import { useActionState } from "react";
import { Plus, Swords, TriangleAlert, Users } from "lucide-react";
import { createTeam, joinTeam, setAssignment, startTeamRace, type TeamState } from "./actions";

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";

export function NewTeamForm({ kind = "team" }: { kind?: "team" | "class" }) {
  const cls = kind === "class";
  const [state, run, pending] = useActionState<TeamState, FormData>(createTeam, null);
  return (
    <form action={run} className="card flex flex-wrap items-end gap-3 p-5">
      <input type="hidden" name="kind" value={kind} />
      <label className="block min-w-56 flex-1 text-sm font-semibold">{cls ? "Name your class" : "Name your team"}<input name="name" required minLength={2} maxLength={60} placeholder={cls ? "Year 10 computing" : "Friday study group"} className={`${input} mt-1 font-normal`} /></label>
      <button disabled={pending} className="btn disabled:opacity-50"><Plus size={16} />{pending ? "Making it…" : cls ? "Start a class" : "Start a team"}</button>
      {state?.error && <p role="alert" className="flex w-full items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
    </form>
  );
}

export function JoinTeamButton({ token }: { token: string }) {
  const [state, run, pending] = useActionState<TeamState, FormData>(async () => joinTeam(token), null);
  return (
    <form action={run} className="space-y-2">
      <button disabled={pending} className="btn disabled:opacity-50"><Users size={16} />{pending ? "Joining…" : "Join"}</button>
      {state?.error && <p role="alert" className="flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
    </form>
  );
}

export function TeamRaceForm({ teamId, topics }: { teamId: number; topics: { id: number; name: string }[] }) {
  const [state, run, pending] = useActionState<TeamState, FormData>(startTeamRace.bind(null, teamId), null);
  return (
    <form action={run} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="block min-w-48 flex-1 font-semibold">Topic
        <select name="trackId" required defaultValue="" className={`${input} mt-1 font-normal`}><option value="" disabled>Choose a topic…</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="block font-semibold">Levels to gain<input name="goal" type="number" min={1} max={10} defaultValue={3} className={`${input} mt-1 w-24 font-normal`} /></label>
      <label className="block font-semibold">Days<input name="days" type="number" min={3} max={60} defaultValue={14} className={`${input} mt-1 w-24 font-normal`} /></label>
      <button disabled={pending} className="btn disabled:opacity-50"><Swords size={16} />{pending ? "Starting…" : "Race the team"}</button>
      {state?.error && <p role="alert" className="flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
    </form>
  );
}

export function AssignmentForm({ teamId, topics }: { teamId: number; topics: { id: number; name: string }[] }) {
  const [state, run, pending] = useActionState<TeamState, FormData>(setAssignment.bind(null, teamId), null);
  return (
    <form action={run} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="block min-w-48 flex-1 font-semibold">Topic
        <select name="trackId" required defaultValue="" className={`${input} mt-1 font-normal`}><option value="" disabled>Choose a topic…</option>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="block font-semibold">Reach level<input name="level" type="number" min={1} max={20} defaultValue={3} className={`${input} mt-1 w-24 font-normal`} /></label>
      <label className="block font-semibold">Within days<input name="days" type="number" min={1} max={180} defaultValue={14} className={`${input} mt-1 w-24 font-normal`} /></label>
      <button disabled={pending} className="btn disabled:opacity-50"><Plus size={16} />{pending ? "Setting…" : "Set assignment"}</button>
      {state?.error && <p role="alert" className="flex w-full items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
    </form>
  );
}

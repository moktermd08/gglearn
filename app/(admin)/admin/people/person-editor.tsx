"use client";
import { useActionState, useState, useTransition } from "react";
import { Check, Eye, Save, TriangleAlert } from "lucide-react";
import { setAccess } from "@/app/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { tidyScopes, type PlaceTree } from "@/lib/placeSummary";
import type { Level } from "@/lib/accessLevel";
import type { Scope } from "@/lib/paths";
import { AccessCards, type AccessChoice } from "./access-cards";
import { PlacePicker } from "./place-picker";
import { type RoleDone, type RolePreview, applyRole, previewRole, savePlaces } from "./actions";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";
const KINDS = [["role_change", "Sideways move or new role"], ["promotion", "Promotion"], ["demotion", "Demotion"]] as const;

/** Changes someone's job role: see what it changes first (the learning and the tool access), then apply it with the reason on record. Same rules as Change a role. */
export function RoleEditor({ userId, name, jobRole, roles }: { userId: number; name: string; jobRole: string; roles: string[] }) {
  const [next, setNext] = useState("");
  const [preview, setPreview] = useState<RolePreview | null>(null);
  const [kind, setKind] = useState<string>("role_change");
  const [pending, start] = useTransition();
  const [result, apply, applying] = useActionState<RoleDone, FormData>(applyRole, null);
  const first = name.split(" ")[0];
  const changed = preview && !("error" in preview) && preview.to !== preview.from;
  const see = () => start(async () => { try { setPreview(await previewRole(userId, next)); } catch { setPreview({ error: "Could not work that out. Try again." }); } });

  if (result?.done) {
    return (
      <div role="status" className="space-y-1 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-900">
        <p className="flex items-center gap-1.5 font-semibold"><Check size={15} aria-hidden />{result.done}</p>
        {result.todo && result.todo.length > 0 ? <><p>Now do these in the tools:</p><ul className="list-disc pl-5">{result.todo.map((l, i) => <li key={i}>{l}</li>)}</ul></> : <p>No tool access changes.</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      <p>Job role now: <b>{jobRole}</b>. The role decides what {first} must learn and which tools they get.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block space-y-1"><span className="block font-semibold">New role</span>
          <input value={next} onChange={(e) => { setNext(e.target.value); setPreview(null); }} list="edit-roles" maxLength={40} placeholder="e.g. senior developer" className={`${input} min-w-56`} autoComplete="off" />
        </label>
        <datalist id="edit-roles">{roles.map((r) => <option key={r} value={r} />)}</datalist>
        <button type="button" disabled={pending || !next.trim()} onClick={see} className="btn btn-ghost !py-1.5 disabled:opacity-50"><Eye size={14} aria-hidden />{pending ? "Checking…" : "See what changes"}</button>
      </div>
      {preview && "error" in preview && <p role="alert" className="flex items-start gap-1.5 text-rose-700"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />{preview.error}</p>}
      {preview && !("error" in preview) && !changed && <p className="text-slate-400">That is already their role.</p>}
      {changed && preview && !("error" in preview) && (
        <form action={apply} className="space-y-3 rounded-xl border border-black/10 bg-[#fff] p-3">
          <input type="hidden" name="userId" value={userId} /><input type="hidden" name="jobRole" value={preview.to} />
          <p className="font-semibold">{preview.from} → {preview.to}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Learning (passes already earned stay)</p>
            {preview.added.length + preview.dropped.length === 0 ? <p className="text-slate-400">No change to required learning.</p> : (
              <ul className="space-y-0.5">
                {preview.added.map((t) => <li key={`a${t}`}><b className="text-amber-800">Now required</b> · {t}</li>)}
                {preview.dropped.map((t) => <li key={`d${t}`}><b className="text-slate-400">No longer required</b> · {t}</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tool access (recorded when you apply; you change the accounts in each tool)</p>
            {preview.access.length === 0 ? <p className="text-slate-400">No change to tool access.</p> : <ul className="space-y-0.5">{preview.access.map((a, i) => <li key={i}><b className={a.tone === "bad" ? "text-rose-700" : a.tone === "warn" ? "text-amber-800" : "text-emerald-800"}>{a.text.split(" ")[0]}</b> {a.text.replace(/^\S+ /, "")}</li>)}</ul>}
            {preview.adminOnly && preview.access.length > 0 && <p className="mt-1 text-xs text-amber-800">Only an admin records access changes in the register. Yours will be listed for them.</p>}
          </div>
          <label className="block space-y-1"><span className="block font-semibold">This is a</span><select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>{KINDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          <label className="block space-y-1"><span className="block font-semibold">Reason {kind === "role_change" ? "(optional)" : "(required)"}</span><textarea name="note" rows={2} maxLength={1000} className={`${input} w-full`} /></label>
          {result?.error && <p role="alert" className="flex items-start gap-1.5 text-rose-700"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />{result.error}</p>}
          <button disabled={applying} className="btn disabled:opacity-50"><Save size={14} aria-hidden />{applying ? "Saving…" : `Change role to ${preview.to}`}</button>
        </form>
      )}
    </div>
  );
}

/** Manager or admin access. Only offered to someone who may hand it out; the server checks again, and says why when it refuses. */
export function AccessEditor({ userId, name, current, choices, blockedWhy }: { userId: number; name: string; current: Level; choices: AccessChoice[]; blockedWhy?: string }) {
  const [level, setLevel] = useState<Level>(current);
  if (blockedWhy) return <p className="text-sm text-slate-400">{blockedWhy}</p>;
  return (
    <ActionForm action={setAccess} className="space-y-3 text-sm">
      <input type="hidden" name="userId" value={userId} /><input type="hidden" name="access" value={level} />
      <AccessCards choices={choices} value={level} onChange={setLevel} />
      <button disabled={level === current} className="btn btn-ghost !py-1.5 disabled:opacity-50"><Save size={14} aria-hidden />Save access for {name.split(" ")[0]}</button>
    </ActionForm>
  );
}

/** Where someone belongs. Saves, enrols them in what is now required, and says why when it is refused. */
export function PlaceEditor({ userId, tree, selected }: { userId: number; tree: PlaceTree; selected: Scope[] }) {
  const [places, setPlaces] = useState<Scope[]>(tidyScopes(tree, selected));
  return (
    <ActionForm action={savePlaces} className="space-y-3 text-sm">
      <input type="hidden" name="userId" value={userId} />
      <PlacePicker tree={tree} value={places} onChange={setPlaces} idPrefix={`edit${userId}`} />
      <button className="btn btn-ghost !py-1.5"><Save size={14} aria-hidden />Save and enrol in what is required</button>
    </ActionForm>
  );
}

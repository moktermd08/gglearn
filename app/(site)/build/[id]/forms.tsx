"use client";
import { useActionState, useTransition } from "react";
import { CheckCircle2, RefreshCw, Save, Undo2 } from "lucide-react";
import { checkRepo, markSelf, saveLinks, undoSelf, type BuildState } from "../actions";

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";

function Note({ state }: { state: BuildState }) {
  if (state?.error) return <p role="alert" className="text-sm text-rose-500">{state.error}</p>;
  if (state?.message) return <p role="status" className="text-sm text-emerald-600">{state.message}</p>;
  return null;
}

/** The two addresses a project needs: its repository on GitHub and, once it is deployed, where it is live. */
export function LinksForm({ projectId, repo, site }: { projectId: number; repo: string | null; site: string | null }) {
  const [state, run, pending] = useActionState<BuildState, FormData>(saveLinks.bind(null, projectId), null);
  return (
    <form action={run} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">GitHub repository
          <input name="repo" defaultValue={repo ?? ""} placeholder="your-name/your-project" autoComplete="off" spellCheck={false} className={`${input} mt-1 font-normal`} /></label>
        <label className="block text-sm font-semibold">Live address (once it is deployed)
          <input name="site" defaultValue={site ?? ""} placeholder="https://your-project.example.com" inputMode="url" autoComplete="off" spellCheck={false} className={`${input} mt-1 font-normal`} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-ghost disabled:opacity-50"><Save size={16} />{pending ? "Saving…" : "Save addresses"}</button>
        <Note state={state} />
      </div>
    </form>
  );
}

/** Reads the repository on GitHub and ticks what it finds. */
export function CheckButton({ projectId, disabled }: { projectId: number; disabled: boolean }) {
  const [state, run, pending] = useActionState<BuildState, FormData>(async () => checkRepo(projectId), null);
  return (
    <form action={run} className="space-y-2">
      <button disabled={pending || disabled} className="btn disabled:opacity-50"><RefreshCw size={16} className={pending ? "animate-spin" : ""} />{pending ? "Reading your repository…" : "Check my GitHub"}</button>
      <Note state={state} />
    </form>
  );
}

/** For the few steps that happen outside GitHub (a conversation, a first customer): the person writes what happened. */
export function SelfForm({ projectId, stepKey, min, note }: { projectId: number; stepKey: string; min: number; note: string | null }) {
  const [state, run, pending] = useActionState<BuildState, FormData>(markSelf.bind(null, projectId, stepKey), null);
  const [undoing, startUndo] = useTransition();
  return (
    <form action={run} className="space-y-2">
      <label className="block text-sm font-semibold">What happened? (at least {min} characters)
        <textarea name="note" defaultValue={note ?? ""} rows={3} maxLength={1000} required className={`${input} mt-1 font-normal`} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn btn-ghost disabled:opacity-50"><CheckCircle2 size={16} />{pending ? "Saving…" : note ? "Update my note" : "I did this"}</button>
        {note && <button type="button" disabled={undoing} onClick={() => startUndo(async () => { await undoSelf(projectId, stepKey); })} className="inline-flex items-center gap-1 text-xs text-slate-400 underline disabled:opacity-50"><Undo2 size={12} />Not done after all</button>}
        <Note state={state} />
      </div>
    </form>
  );
}

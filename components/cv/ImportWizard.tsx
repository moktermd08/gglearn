"use client";
import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { applyImportAction, parseImportAction, type ImportState } from "@/app/cv-import-actions";
import { ENTRY_LABEL, type EntryKind } from "@/lib/cv/types";
import { dateRange } from "@/lib/cv/text";
import type { Candidate, Parsed } from "@/lib/cv/import";

const btn = "btn !py-1.5 text-sm";
const FIELD_LABEL: Record<string, string> = { headline: "Headline", summary: "Summary", location: "Location", contactEmail: "Email for the CV", phone: "Phone", links: "Links" };
const keyOf = (c: Pick<Candidate, "kind" | "title" | "org" | "startsOn">) => `${c.kind}|${c.title.toLowerCase()}|${c.org.toLowerCase()}|${c.startsOn}`;
const show = (v: unknown) => (Array.isArray(v) ? v.map((l: { label: string; url: string }) => l.label ? `${l.label}: ${l.url}` : l.url).join(", ") : String(v ?? ""));

/** Step 2: what was found, with a tick beside everything. Anything already on the CV is shown and left unticked. Nothing is saved until the button. */
function Preview({ parsed, existing, current }: { parsed: Parsed; existing: string[]; current: Record<string, unknown> }) {
  const have = new Set(existing);
  const [pick, setPick] = useState<boolean[]>(() => parsed.entries.map((c) => !have.has(keyOf(c))));
  const fieldKeys = Object.keys(parsed.profile);
  const [fields, setFields] = useState<Record<string, boolean>>(() => Object.fromEntries(fieldKeys.map((k) => [k, !current[k] || (Array.isArray(current[k]) && (current[k] as unknown[]).length === 0)])));
  const [state, apply, applying] = useActionState<ImportState, FormData>(applyImportAction, null);
  const chosen = pick.filter(Boolean).length, nFields = fieldKeys.filter((k) => fields[k]).length;
  const payload = JSON.stringify({ entries: parsed.entries.filter((_, i) => pick[i]), profile: Object.fromEntries(fieldKeys.filter((k) => fields[k]).map((k) => [k, (parsed.profile as Record<string, unknown>)[k]])) });
  const kinds = [...new Set(parsed.entries.map((e) => e.kind))] as EntryKind[];
  return (
    <div className="space-y-4">
      <p className="text-sm">Found <b>{parsed.entries.length}</b> {parsed.entries.length === 1 ? "item" : "items"}{fieldKeys.length ? ` and ${fieldKeys.length} profile ${fieldKeys.length === 1 ? "detail" : "details"}` : ""} in your {parsed.source === "linkedin" ? "LinkedIn export" : "JSON Resume"}. Tick what you want. Nothing is saved until you press the button.</p>
      {parsed.warnings.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      {fieldKeys.length > 0 && (
        <fieldset className="space-y-1.5 rounded-lg border border-black/10 p-3"><legend className="px-1 text-sm font-bold">Profile details</legend>
          {fieldKeys.map((k) => (
            <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.checked })} className="mt-0.5" />
              <span className="min-w-0"><b>{FIELD_LABEL[k] ?? k}:</b> <span className="break-words">{show((parsed.profile as Record<string, unknown>)[k]).slice(0, 200)}</span>{!!current[k] && !(Array.isArray(current[k]) && (current[k] as unknown[]).length === 0) && <span className="block text-xs text-amber-800">You already have one; ticking this replaces it{k === "links" ? " (new links are added to yours)" : ""}.</span>}</span></label>
          ))}
        </fieldset>
      )}
      {kinds.map((kind) => (
        <fieldset key={kind} className="space-y-1.5 rounded-lg border border-black/10 p-3"><legend className="px-1 text-sm font-bold">{ENTRY_LABEL[kind].many}</legend>
          <ul className="space-y-1">
            {parsed.entries.map((c, i) => c.kind !== kind ? null : (
              <li key={i}><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={pick[i]} onChange={(e) => setPick(pick.map((p, j) => (j === i ? e.target.checked : p)))} className="mt-0.5" />
                <span className="min-w-0"><b>{c.title}</b>{c.org && <span className="text-slate-500"> · {c.org}</span>}{dateRange(c.startsOn, c.endsOn, c.current) && <span className="text-slate-400"> · {dateRange(c.startsOn, c.endsOn, c.current)}</span>}{have.has(keyOf(c)) && <span className="ml-2 text-xs text-amber-800">already on your CV</span>}</span></label></li>
            ))}
          </ul>
        </fieldset>
      ))}
      {state?.done ? (
        <p role="status" className="card border-l-4 border-emerald-500 p-3 text-sm">{state.done} <a href="/profile/cv" className="font-semibold text-sky-700 underline">Go to your CV</a></p>
      ) : (
        <form action={apply} className="space-y-2">
          <input type="hidden" name="payload" value={payload} />
          <button disabled={applying || (chosen === 0 && nFields === 0)} className={`${btn} disabled:opacity-50`}>{applying ? "Importing…" : `Import ${chosen} ${chosen === 1 ? "item" : "items"}${nFields ? ` and ${nFields} ${nFields === 1 ? "detail" : "details"}` : ""}`}</button>
          {state?.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

export function ImportWizard({ existing, current }: { existing: string[]; current: Record<string, unknown> }) {
  const [state, read, reading] = useActionState<ImportState, FormData>(parseImportAction, null);
  const parsed = state?.parsed;
  const k = parsed ? `${parsed.entries.length}:${parsed.entries.slice(0, 3).map((e) => e.title).join(",")}` : "";
  return (
    <div className="space-y-5">
      <form action={read} className="space-y-3" encType="multipart/form-data">
        <label className="block space-y-1 text-sm font-semibold">Choose your file or files
          <input name="files" type="file" multiple accept=".json,.csv,application/json,text/csv" required className="block w-full rounded-lg border border-black/15 bg-[#fff] p-2 text-sm font-normal" /></label>
        <button disabled={reading} className={`${btn} disabled:opacity-50`}><Upload size={14} aria-hidden />{reading ? "Reading…" : "Read my file"}</button>
        {state?.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
      </form>
      {parsed && <Preview key={k} parsed={parsed} existing={existing} current={current} />}
    </div>
  );
}

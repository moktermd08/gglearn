import { Building2, FolderKanban, Tag } from "lucide-react";
import type { Scope, ScopeOptions } from "@/lib/paths";

/** Checkboxes named "scope" (value "company:1", "brand:2", "project:3"). Read back with formScopes in app/actions.ts. */
export function ScopePicker({ options, selected = [] }: { options: ScopeOptions; selected?: Scope[] }) {
  const on = (kind: string, id: number) => selected.some((s) => s.kind === kind && s.id === id);
  const box = "flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-sm";
  const group = (title: string, Icon: typeof Tag, kind: "company" | "brand" | "project", rows: { id: number; name: string; hint?: string | null }[]) => (
    <fieldset className="min-w-0">
      <legend className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Icon size={12} />{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <label key={r.id} className={box}>
            <input type="checkbox" name="scope" value={`${kind}:${r.id}`} defaultChecked={on(kind, r.id)} />
            {r.name}{r.hint && <span className="text-xs text-slate-500">({r.hint})</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="w-full space-y-2">
      <p className="text-xs text-slate-400">Where they belong. A company covers all its brands; projects are separate, so tick the ones they work on.</p>
      {group("Companies", Building2, "company", options.companies)}
      {group("Brands", Tag, "brand", options.brands.map((b) => ({ ...b, hint: b.company })))}
      {group("Projects", FolderKanban, "project", options.projects.map((p) => ({ ...p, hint: p.brand })))}
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import { Building2, FolderKanban, Tag, Wand2, X } from "lucide-react";
import { type PlaceTree, coveredBrand, summarisePlaces, tidyScopes } from "@/lib/placeSummary";
import type { Scope } from "@/lib/paths";

const same = (a: Scope, kind: Scope["kind"], id: number) => a.kind === kind && a.id === id;

/** "company:1,brand:2" back into scopes. Local on purpose: lib/paths reads the database, so a client component may only import its types. */
export const scopesFrom = (raw: string): Scope[] => raw.split(",").flatMap((p) => {
  const [kind, id] = p.split(":");
  return (kind === "company" || kind === "brand" || kind === "project") && Number(id) > 0 ? [{ kind, id: Number(id) } as Scope] : [];
});

const SEARCH_FROM = 12; // a filter box only once the list is long enough to need one

/**
 * Where someone belongs, as a tree: company, its brands, their projects. Ticking a company covers its brands (so they show as included and are not
 * stored); projects are always their own tick, because learning for a project is separate. Under it, in plain words, what the person will see.
 * Also writes the ticks as hidden "scope" inputs, so it works in a plain form as well as in the add stepper. Only offers what `tree` holds,
 * which the server limited to what the signed-in person runs; the actions check again.
 */
export function PlacePicker({ tree, value, onChange, idPrefix = "place" }: { tree: PlaceTree; value: Scope[]; onChange: (next: Scope[]) => void; idPrefix?: string }) {
  const [filter, setFilter] = useState("");
  const total = tree.companies.length + tree.brands.length + tree.projects.length;
  const needle = filter.trim().toLowerCase();
  const hit = (name: string) => !needle || name.toLowerCase().includes(needle);

  const groups = useMemo(() => {
    const coIds = new Set(tree.companies.map((c) => c.id)), brandIds = new Set(tree.brands.map((b) => b.id));
    const projectsOf = (brandId: number) => tree.projects.filter((p) => p.brandId === brandId);
    const brandNode = (b: PlaceTree["brands"][number]) => ({ b, projects: projectsOf(b.id) });
    const perCompany = tree.companies.map((c) => ({
      c,
      brands: tree.brands.filter((b) => b.companyId === c.id).map(brandNode),
      projects: tree.projects.filter((p) => (p.brandId == null || !brandIds.has(p.brandId)) && p.companyId === c.id),
    }));
    return {
      perCompany,
      // brands and projects whose company this person does not run (or has none): shown on their own
      brands: tree.brands.filter((b) => b.companyId == null || !coIds.has(b.companyId)).map(brandNode),
      projects: tree.projects.filter((p) => (p.brandId == null || !brandIds.has(p.brandId)) && (p.companyId == null || !coIds.has(p.companyId))),
    };
  }, [tree]);

  const has = (kind: Scope["kind"], id: number) => value.some((s) => same(s, kind, id));
  const toggle = (kind: Scope["kind"], id: number) => onChange(tidyScopes(tree, has(kind, id) ? value.filter((s) => !same(s, kind, id)) : [...value, { kind, id }]));
  const everything = () => onChange(tidyScopes(tree, [...groups.perCompany.map(({ c }) => ({ kind: "company" as const, id: c.id })), ...groups.brands.map(({ b }) => ({ kind: "brand" as const, id: b.id })), ...groups.projects.map((p) => ({ kind: "project" as const, id: p.id }))]));
  const summary = summarisePlaces(tree, value);

  const row = "flex min-h-9 items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-black/5";
  const box = (kind: Scope["kind"], id: number, name: string, opts: { Icon: typeof Tag; hint?: string; covered?: boolean; strong?: boolean }) => {
    const covered = !!opts.covered, inputId = `${idPrefix}-${kind}-${id}`;
    return (
      <label key={`${kind}${id}`} htmlFor={inputId} className={`${row} ${covered ? "opacity-70" : "cursor-pointer"}`}>
        <input id={inputId} type="checkbox" className="h-4 w-4" checked={covered || has(kind, id)} disabled={covered} onChange={() => toggle(kind, id)} />
        <opts.Icon size={14} className="shrink-0 text-slate-500" aria-hidden />
        <span className={opts.strong ? "font-semibold" : ""}>{name}</span>
        {opts.hint && <span className="text-xs text-slate-500">{opts.hint}</span>}
      </label>
    );
  };
  const projectRows = (ps: PlaceTree["projects"]) => ps.filter((p) => hit(p.name)).map((p) => box("project", p.id, p.name, { Icon: FolderKanban, hint: "project" }));
  const brandRows = (bs: { b: PlaceTree["brands"][number]; projects: PlaceTree["projects"] }[]) => bs.filter(({ b, projects }) => hit(b.name) || projects.some((p) => hit(p.name))).map(({ b, projects }) => (
    <div key={b.id}>
      {box("brand", b.id, b.name, { Icon: Tag, hint: coveredBrand(tree, value, b.id) ? "included with the company" : "brand", covered: coveredBrand(tree, value, b.id) })}
      {projects.length > 0 && <div className="ml-6 border-l border-black/10 pl-2">{projectRows(projects)}</div>}
    </div>
  ));

  if (!total) return <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-700">There is no company, brand or project you can place people in yet.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {total >= SEARCH_FROM && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a company, brand or project" aria-label="Find a company, brand or project" className="min-w-52 flex-1 rounded border border-white/20 bg-[#fff] px-2 py-1 text-sm" />}
        <button type="button" onClick={everything} className="btn btn-ghost !px-3 !py-1 text-xs"><Wand2 size={13} />Everything I run</button>
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="btn btn-ghost !px-3 !py-1 text-xs"><X size={13} />Clear</button>}
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-black/10 p-2">
        {groups.perCompany.map(({ c, brands, projects }) => (!needle || hit(c.name) || brands.some(({ b, projects: ps }) => hit(b.name) || ps.some((p) => hit(p.name))) || projects.some((p) => hit(p.name))) && (
          <div key={c.id} className="rounded-lg bg-black/[.03] p-1">
            {box("company", c.id, c.name, { Icon: Building2, strong: true, hint: brands.length ? `whole company · ${brands.length} brand${brands.length === 1 ? "" : "s"}` : "whole company" })}
            <div className="ml-6 border-l border-black/10 pl-2">{brandRows(brands)}{projectRows(projects)}</div>
          </div>
        ))}
        {groups.brands.length > 0 && <div className="p-1"><p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Brands on their own</p>{brandRows(groups.brands)}</div>}
        {groups.projects.length > 0 && <div className="p-1"><p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Projects on their own</p>{projectRows(groups.projects)}</div>}
      </div>
      <p className="text-xs text-slate-500">A company covers all its brands. Projects are separate, so tick each one they work on.</p>
      <p aria-live="polite" className={`rounded-lg px-3 py-2 text-sm ${summary.parts.length ? "bg-emerald-500/10 text-emerald-800" : "bg-amber-500/15 text-amber-800"}`}>
        {summary.parts.length ? <><b>Will see:</b> {summary.text}</> : "Nothing picked yet. Pick at least one."}
      </p>
      {tidyScopes(tree, value).map((s) => <input key={`${s.kind}${s.id}`} type="hidden" name="scope" value={`${s.kind}:${s.id}`} />)}
    </div>
  );
}

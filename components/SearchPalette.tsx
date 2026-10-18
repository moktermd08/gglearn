"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, CornerDownLeft, FileText, Loader2, Search, Swords, Users, X } from "lucide-react";

type Hit = { title: string; sub: string; href: string; kind: "page" | "topic" | "race" | "team" | "certificate" };
type Group = { label: string; hits: Hit[] };
const ICON = { page: FileText, topic: BookOpen, race: Swords, team: Users, certificate: Award } as const;

/**
 * Search across the site, opened from the header or with Ctrl+K / Cmd+K. It asks /api/search, which only returns what the person may see, a moment
 * after they stop typing. Arrow keys move, Enter opens, Escape closes. The same thing works with no JavaScript at /search.
 */
export function SearchPalette() {
  const router = useRouter(), listId = useId();
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [groups, setGroups] = useState<Group[]>([]), [busy, setBusy] = useState(false), [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const flat = groups.flatMap((g) => g.hits);

  const close = useCallback(() => { setOpen(false); setQ(""); setGroups([]); setActive(0); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctl.signal });
        const data = (await r.json()) as { groups?: Group[] };
        setGroups(data.groups ?? []); setActive(0);
      } catch { /* a newer keystroke replaced this one, or the network dropped: the next one tries again */ }
      setBusy(false);
    }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open]);

  const go = (h: Hit) => { close(); router.push(h.href); };
  const short = q.trim().length < 2;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search (Ctrl or Cmd plus K)" className="flex h-9 items-center gap-2 rounded-full border border-black/10 bg-[#fff] px-3 text-sm text-slate-400 transition hover:border-indigo-300 hover:text-slate-600">
        <Search size={15} /><span className="hidden lg:inline">Search</span><kbd className="hidden rounded border border-black/10 px-1.5 text-[10px] font-semibold lg:inline">Ctrl K</kbd>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Search" className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-3 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); close(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && flat[active]) { e.preventDefault(); go(flat[active]); }
          }}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-[#fff] shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center gap-2 border-b border-black/5 px-4">
              {busy ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Search size={18} className="text-slate-400" />}
              <input ref={input} autoFocus value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded={flat.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
                placeholder="Search topics, races, teams, pages…" autoComplete="off" spellCheck={false} maxLength={60} className="h-14 flex-1 bg-transparent text-base outline-none" />
              <button type="button" onClick={close} aria-label="Close search" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-black/5"><X size={16} /></button>
            </div>
            <div id={listId} role="listbox" aria-label="Results" className="max-h-[55vh] overflow-y-auto p-2">
              {short && <p className="p-4 text-sm text-slate-400">Type at least two letters. Try <b>python</b>, <b>streak</b>, <b>league</b> or <b>certificate</b>.</p>}
              {!short && !busy && flat.length === 0 && <p className="p-4 text-sm text-slate-400">Nothing found for &ldquo;{q.trim()}&rdquo;. Try a shorter word.</p>}
              {(() => {
                let n = -1;
                return groups.map((g) => (
                  <div key={g.label} className="mb-1">
                    <div className="px-3 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{g.label}</div>
                    {g.hits.map((h) => {
                      n++; const i = n, Icon = ICON[h.kind];
                      return (
                        <button key={h.href + h.title} id={`${listId}-${i}`} role="option" aria-selected={i === active} type="button" onMouseMove={() => setActive(i)} onClick={() => go(h)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === active ? "bg-indigo-500/10" : ""}`}>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[.05] text-slate-500"><Icon size={16} /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{h.title}</span><span className="block truncate text-xs text-slate-400">{h.sub}</span></span>
                          {i === active && <CornerDownLeft size={14} className="shrink-0 text-slate-400" />}
                        </button>);
                    })}
                  </div>));
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

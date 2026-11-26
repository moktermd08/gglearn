"use client";
import { useRef, useSyncExternalStore, type ReactNode } from "react";

export type Tab = { id: string; label: string; icon: ReactNode; count?: number; content: ReactNode };

const subscribe = (done: () => void) => { window.addEventListener("hashchange", done); return () => window.removeEventListener("hashchange", done); };

/** Parts of one long page as tabs. The open one is in the address (/terms#test), so it survives a reload and can be linked to. */
export function Tabs({ items, label }: { items: Tab[]; label: string }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const on = items.some((t) => t.id === hash) ? hash : items[0]?.id;
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const open = (id: string) => { window.history.replaceState(window.history.state, "", `#${id}`); window.dispatchEvent(new HashChangeEvent("hashchange")); };
  const step = (by: number) => {
    const next = items[(items.findIndex((t) => t.id === on) + by + items.length) % items.length];
    open(next.id);
    buttons.current.get(next.id)?.focus();
  };
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={label} className="card flex flex-wrap gap-1 p-1.5" onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}>
        {items.map((t) => {
          const active = t.id === on;
          return (
            <button key={t.id} ref={(el) => { if (el) buttons.current.set(t.id, el); }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={active} aria-controls={`panel-${t.id}`} tabIndex={active ? 0 : -1} onClick={() => open(t.id)}
              className={`flex min-w-0 flex-[1_1_8rem] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${active ? "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500" : "text-slate-300"}`}>
              <span aria-hidden>{t.icon}</span>{t.label}{t.count != null && <span className="rounded-full bg-black/5 px-1.5 text-[11px]">{t.count}</span>}
            </button>
          );
        })}
      </div>
      {items.map((t) => <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={t.id !== on} className="space-y-4">{t.content}</div>)}
    </div>
  );
}

"use client";
import { type ReactNode, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * The edit panel: a dialog from the right edge (the whole screen on a phone). The person is chosen in the address (?edit=), so it can be linked to
 * and the page behind keeps its search and filters. Escape and the Close button go back to the list; focus moves in on opening and back on closing.
 */
export function Drawer({ title, sub, closeHref, children }: { title: string; sub?: string; closeHref: string; children: ReactNode }) {
  const router = useRouter(), ref = useRef<HTMLDivElement>(null), closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { router.push(closeHref, { scroll: false }); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; before?.focus?.(); };
  }, [closeHref, router]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => router.push(closeHref, { scroll: false })} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="edit-title" className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#fbfaf6] shadow-2xl">
        <div className="flex items-start gap-3 border-b border-black/10 bg-[#fff] px-4 py-3">
          <div className="min-w-0 flex-1"><h2 id="edit-title" className="truncate text-lg font-bold">{title}</h2>{sub && <p className="truncate text-sm text-slate-400">{sub}</p>}</div>
          <button ref={closeBtn} type="button" className="btn btn-ghost !px-3 !py-1" onClick={() => router.push(closeHref, { scroll: false })}><X size={15} aria-hidden />Close</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

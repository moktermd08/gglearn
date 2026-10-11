"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

/** Header dropdown: closes on outside click, Escape and navigation. `active` lights the trigger when a child page is open. */
export function Dropdown({ label, children, prefix, align = "left" }: { label: ReactNode; children: ReactNode; prefix?: string; align?: "left" | "right" }) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null); // open only for the page it was opened on, so navigating closes it
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  const box = useRef<HTMLDivElement>(null);
  const active = !!prefix && path.startsWith(prefix);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${active || open ? "bg-indigo-500/12 font-semibold text-indigo-300" : "text-slate-300 hover:bg-black/5 hover:text-white"}`}>
        {label}<ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className={`pop absolute top-full z-50 mt-2 min-w-56 rounded-2xl border border-black/10 bg-[#fff] p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"} [&_a]:flex [&_a]:w-full [&_a]:rounded-xl [&_a]:px-3 [&_a]:py-2 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-xl [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button:hover]:bg-black/5`}>
          {children}
        </div>
      )}
    </div>
  );
}

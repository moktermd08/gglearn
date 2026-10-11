"use client";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Hamburger that opens a full-width panel under the header on small screens. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  return (
    <div className="md:hidden">
      <button type="button" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}
        className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-[#fff] text-slate-300">{open ? <X size={20} /> : <Menu size={20} />}</button>
      {open && <div className="slide-in absolute inset-x-0 top-full max-h-[80vh] overflow-y-auto border-b border-black/10 bg-[#f7f5ef] px-4 pb-4 pt-2 shadow-lg">{children}</div>}
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Header link that lights up on its own page (and on pages beneath it). */
export function NavLink({ href, children, exact }: { href: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const on = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${on ? "bg-indigo-500/12 font-semibold text-indigo-300" : "text-slate-300 hover:bg-black/5 hover:text-white"}`}>
      {children}
    </Link>
  );
}

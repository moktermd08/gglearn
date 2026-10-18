import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { searchFor } from "@/lib/search";
import { MAX_QUERY } from "@/lib/searchRules";

export const metadata: Metadata = { title: "Search — gglearn", robots: { index: false, follow: true } };

/** The same search with no JavaScript: a plain form and a list of links. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, MAX_QUERY), me = await currentUser();
  const groups = q ? searchFor(me ? { id: me.id, role: me.role, audience: me.audience } : null, q) : [];
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <form action="/search" className="card flex items-center gap-2 p-3"><Search size={18} className="text-slate-400" />
        <input name="q" defaultValue={q} placeholder="Search topics, races, teams, pages…" aria-label="Search" maxLength={60} className="h-10 flex-1 bg-transparent outline-none" autoFocus /><button className="btn !py-1.5">Search</button></form>
      {q && groups.length === 0 && <p className="text-center text-slate-400">Nothing found for &ldquo;{q}&rdquo;. Try a shorter word.</p>}
      {groups.map((g) => (
        <section key={g.label} className="card p-4"><h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">{g.label}</h2>
          <ul className="space-y-1">{g.hits.map((h) => <li key={h.href + h.title}><Link href={h.href} className="block rounded-xl px-3 py-2 hover:bg-black/[.04]"><b>{h.title}</b><span className="block text-xs text-slate-400">{h.sub}</span></Link></li>)}</ul></section>))}
    </div>
  );
}

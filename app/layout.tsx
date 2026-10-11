import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { BookMarked, Database, LayoutDashboard, LogIn, LogOut, Mountain, Newspaper, Rocket, ShieldCheck, Swords, TrendingUp, Trophy, Users } from "lucide-react";
import { logout, logoutEverywhere } from "./actions";
import { NavLink } from "@/components/NavLink";

export const metadata: Metadata = {
  title: "gglearn — Training academy",
  description: "Role-based training for your team and customers: a learning path for every role, level exams, certificates and career progression.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f7f5ef]/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap">
            <Link href="/" className="flex items-center gap-1.5 text-lg font-extrabold"><span className="gradient-text">gglearn</span> <Swords size={18} className="text-pink-300" aria-hidden /></Link>
            {user && <NavLink href="/dashboard"><LayoutDashboard size={15} />My quest</NavLink>}
            {user && <NavLink href="/journey"><Mountain size={15} />My career</NavLink>}
            {user && <NavLink href="/start"><Rocket size={15} />Start a journey</NavLink>}
            <NavLink href="/competitions"><Trophy size={15} />Compete</NavLink>
            {user && user.role !== "learner" && (
              <span className="inline-flex flex-wrap items-center gap-x-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-2 py-0.5" aria-label="Admin">
                <span className="px-1.5 text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">Admin</span>
                  <NavLink href="/admin" exact><Database size={15} />Question bank</NavLink>
                  <NavLink href="/admin/people"><Users size={15} />People</NavLink>
                  <NavLink href="/admin/compliance"><ShieldCheck size={15} />Compliance</NavLink>
                  <NavLink href="/admin/freshness"><Newspaper size={15} />Freshness</NavLink>
                  <NavLink href="/admin/careers"><TrendingUp size={15} />Careers</NavLink>
              </span>
            )}
            <span className="ml-auto" />
            {user ? (
              <form action={logout} className="flex items-center gap-3">
                <Link href="/profile" className="inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"><BookMarked size={14} />{user.name}</Link>
                <button className="inline-flex items-center gap-1 text-slate-300 underline"><LogOut size={14} />Sign out</button>
                <button formAction={logoutEverywhere} className="text-slate-500 underline" title="Ends your session on every device">Sign out everywhere</button>
              </form>
            ) : (
              <Link href="/login" className="btn !py-1.5"><LogIn size={15} />Sign in</Link>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

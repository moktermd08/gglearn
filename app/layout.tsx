import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { BookMarked, Database, LayoutDashboard, LogIn, LogOut, Newspaper, Rocket, ShieldCheck, Swords, TrendingUp, Trophy, Users } from "lucide-react";
import { logout, logoutEverywhere } from "./actions";

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
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="flex items-center gap-1.5 text-lg font-extrabold"><span className="gradient-text">gglearn</span> <Swords size={18} className="text-pink-300" aria-hidden /></Link>
            {user && <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><LayoutDashboard size={15} />My quest</Link>}
            {user && <Link href="/start" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><Rocket size={15} />Start a journey</Link>}
            <Link href="/competitions" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><Trophy size={15} />Compete</Link>
            {user && user.role !== "learner" && <Link href="/admin" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><Database size={15} />Question bank</Link>}
            {user && user.role !== "learner" && <Link href="/admin/people" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><Users size={15} />People</Link>}
            {user && user.role !== "learner" && <Link href="/admin/compliance" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><ShieldCheck size={15} />Compliance</Link>}
            {user && user.role !== "learner" && <Link href="/admin/freshness" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><Newspaper size={15} />Freshness</Link>}
            {user && user.role !== "learner" && <Link href="/admin/careers" className="inline-flex items-center gap-1.5 text-slate-300 transition hover:text-white"><TrendingUp size={15} />Careers</Link>}
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

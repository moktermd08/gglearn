import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "gglearn — Race to Titan",
  description: "Learn any skill head-to-head against a rival. Daily quests, exams, certificates, and 20 levels from Novice to Titan.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b1a]/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="text-lg font-extrabold"><span className="gradient-text">gglearn</span> <span aria-hidden>⚔️</span></Link>
            {user && <Link href="/dashboard" className="text-slate-300 hover:text-white">My quest</Link>}
            {user && user.role !== "learner" && <Link href="/admin" className="text-slate-300 hover:text-white">Question bank</Link>}
            {user && user.role !== "learner" && <Link href="/admin/people" className="text-slate-300 hover:text-white">People</Link>}
            <span className="ml-auto" />
            {user ? (
              <form action={logout} className="flex items-center gap-3">
                <span className="text-slate-400">{user.name}</span>
                <button className="text-slate-300 underline">Sign out</button>
              </form>
            ) : (
              <Link href="/login" className="btn !py-1.5">Sign in</Link>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

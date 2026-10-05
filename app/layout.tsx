import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "gglearn — Training Academy",
  description: "Learn, sharpen and prove your skills across our brands, from Novice to Titan.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-bold">gglearn</Link>
            {user && <Link href="/dashboard">My learning</Link>}
            {user && user.role !== "learner" && <Link href="/admin">Question bank</Link>}
            {user && user.role !== "learner" && <Link href="/admin/people">People</Link>}
            <span className="ml-auto" />
            {user ? (
              <form action={logout} className="flex items-center gap-3">
                <span className="text-stone-500">{user.name}</span>
                <button className="underline">Sign out</button>
              </form>
            ) : (
              <Link href="/login" className="rounded bg-stone-900 px-3 py-1.5 text-white dark:bg-stone-100 dark:text-stone-900">Sign in</Link>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

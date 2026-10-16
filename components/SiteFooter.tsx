import Link from "next/link";
import { Swords } from "lucide-react";
import { ADMIN_LINKS } from "@/components/SiteHeader";
import { DEFAULT_LOOK, type Look } from "@/lib/brand";

type User = { role: string } | null;

export function SiteFooter({ user, look = DEFAULT_LOOK }: { user: User; look?: Look }) {
  const staff = !!user && user.role !== "learner";
  const col = "space-y-2 text-sm";
  const head = "mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400";
  const link = "text-slate-300 transition hover:text-white hover:underline";
  return (
    <footer className="mt-16 border-t border-black/10 bg-[#fff]/60 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold">
            {look.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={look.logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
              : <span className="grid h-8 w-8 place-items-center rounded-lg text-[#fff]" style={{ background: look.accent ? "var(--brand)" : "linear-gradient(135deg,#4f46e5,#9333ea 70%,#db2777)" }}><Swords size={17} aria-hidden /></span>}
            <span className="gradient-text">{look.name}</span>
          </Link>
          <p className="mt-3 text-sm text-slate-400">Role-based training for your team and customers: a learning path for every role, level exams, certificates and career progression.</p>
        </div>
        <nav aria-label="Learn"><h2 className={head}>Learn</h2>
          <ul className={col}>
            {user && <li><Link href="/dashboard" className={link}>My quest</Link></li>}
            {user && <li><Link href="/journey" className={link}>My career</Link></li>}
            {user && <li><Link href="/start" className={link}>Start a journey</Link></li>}
            <li><Link href="/#subjects" className={link}>Browse subjects</Link></li>
          </ul></nav>
        <nav aria-label="Compete"><h2 className={head}>Compete</h2>
          <ul className={col}>
            <li><Link href="/competitions" className={link}>All contests</Link></li>
            {user && <li><Link href="/competitions/new" className={link}>Start a contest</Link></li>}
            {user && <li><Link href="/updates" className={link}>What changed</Link></li>}
          </ul></nav>
        <nav aria-label={staff ? "Admin" : "Account"}><h2 className={head}>{staff ? "Admin" : "Account"}</h2>
          <ul className={col}>
            {staff && ADMIN_LINKS.map(({ href, label }) => <li key={href}><Link href={href} className={link}>{label}</Link></li>)}
            {user ? <li><Link href="/profile" className={link}>Your profile</Link></li> : <li><Link href="/login" className={link}>Sign in</Link></li>}
          </ul></nav>
      </div>
      <div className="border-t border-black/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} {look.company ?? "gglearn"}. All rights reserved.</span>
          <span>Accounts are created by your admin.</span>
        </div>
      </div>
    </footer>
  );
}

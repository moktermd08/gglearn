import Link from "next/link";
import { BookMarked, Database, Gift, Settings2, Flame, LayoutDashboard, LogIn, LogOut, Mountain, Newspaper, Rocket, ShieldCheck, Swords, TrendingUp, Trophy, Users, UserRound, Medal, CalendarDays, Bell } from "lucide-react";
import { logout, logoutEverywhere } from "@/app/actions";
import { NavLink } from "@/components/NavLink";
import { Dropdown } from "@/components/Dropdown";
import { MobileMenu } from "@/components/MobileMenu";
import { Initials } from "@/components/charts";
import { DEFAULT_LOOK, type Look } from "@/lib/brand";

type User = { name: string; email: string; role: string } | null;

export const ADMIN_LINKS = [
  { href: "/admin", label: "Question bank", Icon: Database, exact: true },
  { href: "/admin/people", label: "People", Icon: Users },
  { href: "/admin/compliance", label: "Compliance", Icon: ShieldCheck },
  { href: "/admin/freshness", label: "Freshness", Icon: Newspaper },
  { href: "/admin/careers", label: "Careers", Icon: TrendingUp },
  { href: "/admin/rewards", label: "Rewards", Icon: Gift },
  { href: "/admin/setup", label: "Set up", Icon: Settings2 },
];
/** Managers see everything except the policy pages only an admin may change. */
export const adminLinksFor = (role: string) => ADMIN_LINKS.filter((l) => !("adminOnly" in l && l.adminOnly) || role === "admin");

export function SiteHeader({ user, unread = 0, look = DEFAULT_LOOK }: { user: User; unread?: number; look?: Look }) {
  const staff = !!user && user.role !== "learner";
  const mobile = "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-base";
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f7f5ef]/90 backdrop-blur print:hidden">
      <nav aria-label="Main" className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 text-sm [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold">
          {look.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={look.logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
            : <span className="grid h-8 w-8 place-items-center rounded-lg text-[#fff] shadow" style={{ background: look.accent ? "var(--brand)" : "linear-gradient(135deg,#4f46e5,#9333ea 70%,#db2777)" }}><Swords size={17} aria-hidden /></span>}
          <span className="gradient-text">{look.name}</span>
        </Link>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {user && <NavLink href="/dashboard"><LayoutDashboard size={15} />My quest</NavLink>}
          {user && <NavLink href="/journey"><Mountain size={15} />My career</NavLink>}
          {user && <NavLink href="/start"><Rocket size={15} />Start a journey</NavLink>}
          <NavLink href="/campaigns"><Flame size={15} />Campaigns</NavLink>
          <NavLink href="/seasons"><CalendarDays size={15} />Seasons</NavLink>
          <NavLink href="/competitions"><Trophy size={15} />Compete</NavLink>
          {staff && (
            <Dropdown prefix="/admin" label={<><ShieldCheck size={15} />Admin</>}>
              {adminLinksFor(user!.role).map(({ href, label, Icon }) => <NavLink key={href} href={href} exact={href === "/admin"}><Icon size={15} />{label}</NavLink>)}
            </Dropdown>
          )}
        </div>

        <span className="ml-auto" />
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
            <Link href="/notifications" className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}><Bell size={18} />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-pink-600 px-1 text-[10px] font-bold leading-4 text-[#fff]">{unread > 9 ? "9+" : unread}</span>}</Link>
            <Dropdown align="right" label={<><Initials name={user.name} size={26} /><span className="max-w-32 truncate">{user.name}</span></>}>
              <div className="border-b border-black/5 px-3 pb-2 pt-1.5"><div className="font-semibold">{user.name}</div><div className="truncate text-xs text-slate-400">{user.email}</div></div>
              <Link href="/profile" className="mt-1 items-center gap-2 hover:bg-black/5"><UserRound size={15} />Your profile</Link>
              <Link href="/achievements" className="items-center gap-2 hover:bg-black/5"><Medal size={15} />Achievements</Link>
              <Link href="/rewards" className="items-center gap-2 hover:bg-black/5"><Gift size={15} />My rewards</Link>
              <form action={logout}>
                <button><LogOut size={15} />Sign out</button>
                <button formAction={logoutEverywhere} title="Ends your session on every device" className="!text-slate-400"><BookMarked size={15} />Sign out everywhere</button>
              </form>
            </Dropdown>
            </>
          ) : (
            <Link href="/login" className="btn !py-1.5"><LogIn size={15} />Sign in</Link>
          )}
        </div>

        <MobileMenu>
          <div className="space-y-0.5 text-slate-300">
            {user && <Link href="/dashboard" className={mobile}><LayoutDashboard size={18} />My quest</Link>}
            {user && <Link href="/journey" className={mobile}><Mountain size={18} />My career</Link>}
            {user && <Link href="/start" className={mobile}><Rocket size={18} />Start a journey</Link>}
            <Link href="/campaigns" className={mobile}><Flame size={18} />Campaigns</Link>
            <Link href="/seasons" className={mobile}><CalendarDays size={18} />Seasons</Link>
            <Link href="/competitions" className={mobile}><Trophy size={18} />Compete</Link>
            {staff && <div className="px-3 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-widest text-indigo-300">Admin</div>}
            {staff && adminLinksFor(user!.role).map(({ href, label, Icon }) => <Link key={href} href={href} className={mobile}><Icon size={18} />{label}</Link>)}
            <div className="my-2 border-t border-black/10" />
            {user ? (
              <>
                <Link href="/profile" className={mobile}><UserRound size={18} />{user.name}</Link>
                <Link href="/notifications" className={mobile}><Bell size={18} />Notifications{unread > 0 && <span className="ml-auto rounded-full bg-pink-600 px-2 text-xs font-bold text-[#fff]">{unread}</span>}</Link>
                <Link href="/achievements" className={mobile}><Medal size={18} />Achievements</Link>
                <Link href="/rewards" className={mobile}><Gift size={18} />My rewards</Link>
                <form action={logout}>
                  <button className={mobile}><LogOut size={18} />Sign out</button>
                  <button formAction={logoutEverywhere} className={`${mobile} !text-slate-400`}><BookMarked size={18} />Sign out everywhere</button>
                </form>
              </>
            ) : <Link href="/login" className={`${mobile} font-semibold text-indigo-300`}><LogIn size={18} />Sign in</Link>}
          </div>
        </MobileMenu>
      </nav>
    </header>
  );
}

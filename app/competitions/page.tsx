import { EmptyState, PageHero, PALETTE, StatTile } from "@/components/charts";
import Link from "next/link";
import { CalendarClock, Flag, LogIn, Radio, Swords, Trophy, Plus, Users } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { listFor } from "@/lib/competitions";
import { CompetitionCard } from "@/components/CompetitionCard";

export const metadata = { title: "Compete — gglearn" };

export default async function Competitions() {
  const user = await currentUser();
  const all = listFor(user);
  const mine = user ? listFor(user, { mineOnly: true }) : [];
  const mineIds = new Set(mine.map((m) => m.c.id));
  const open = all.filter((a) => !mineIds.has(a.c.id) && a.state !== "canceled");
  const group = (s: string) => open.filter((a) => a.state === s);

  const SECTION = {
    live: { title: "Live now", Icon: Radio, cls: "text-emerald-300" },
    upcoming: { title: "Starting soon", Icon: CalendarClock, cls: "text-sky-300" },
    finished: { title: "Recently finished", Icon: Flag, cls: "text-slate-300" },
  } as const;
  const stats = [
    { Icon: Radio, label: "Live now", value: all.filter((a) => a.state === "live").length, cls: "text-emerald-300" },
    { Icon: CalendarClock, label: "Starting soon", value: all.filter((a) => a.state === "upcoming").length, cls: "text-sky-300" },
    { Icon: Users, label: "Your contests", value: mine.length, cls: "text-pink-300" },
  ];

  return (
    <div className="space-y-8">
      <PageHero Icon={Trophy} tone="amber" title="Compete" sub="Pick any topic, set a goal and a deadline, then race a bot, a friend or a whole group. Public contests can be watched by anyone; private ones only by the people in them.">
        {user ? <Link href="/competitions/new" className="btn"><Plus size={16} />Start a contest</Link> : <Link href="/login" className="btn"><LogIn size={16} />Sign in to compete</Link>}
      </PageHero>

      <div className="grid grid-cols-3 gap-3">
        <StatTile i={0} Icon={Radio} label="Live now" value={stats[0].value} color={PALETTE.emerald} />
        <StatTile i={1} Icon={CalendarClock} label="Starting soon" value={stats[1].value} color={PALETTE.sky} />
        <StatTile i={2} Icon={Users} label="Your contests" value={stats[2].value} color={PALETTE.pink} />
      </div>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Swords size={20} className="text-pink-300" />Your contests</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((m) => <CompetitionCard key={m.c.id} card={m} />)}</div>
        </section>
      )}

      {(["live", "upcoming", "finished"] as const).map((s) => group(s).length > 0 && (
        <section key={s}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">{(() => { const { Icon, cls } = SECTION[s]; return <Icon size={20} className={cls} />; })()}{SECTION[s].title} <span className="text-sm font-normal text-slate-400">· public</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group(s).slice(0, 12).map((m) => <CompetitionCard key={m.c.id} card={m} />)}</div>
        </section>
      ))}

      {open.length === 0 && mine.length === 0 && <EmptyState Icon={Trophy} tone="amber" title="No public contests yet">Be the first: pick a topic, set a goal and challenge a bot or a friend.</EmptyState>}
    </div>
  );
}

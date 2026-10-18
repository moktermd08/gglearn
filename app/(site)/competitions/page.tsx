import { EmptyState, PageHero, PALETTE, StatTile } from "@/components/charts";
import Link from "next/link";
import { ArrowRight, Award, CalendarClock, Clock, Coins, Flag, LogIn, Radio, Swords, Target, Trophy, Plus, Users } from "lucide-react";
import { SubjectArt, artFor } from "@/components/SubjectArt";
import { Ring } from "@/components/Ring";
import { now, span } from "@/lib/competitions";
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
    live: { title: "Live now", Icon: Radio, tone: "bg-emerald-500/15 text-emerald-300" },
    upcoming: { title: "Starting soon", Icon: CalendarClock, tone: "bg-sky-500/15 text-sky-300" },
    finished: { title: "Recently finished", Icon: Flag, tone: "bg-slate-500/15 text-slate-300" },
  } as const;
  // the contest to put in the spotlight: one of yours that is live, otherwise any live public one
  const spotlight = [...mine, ...open].find((x) => x.state === "live");
  const t = now();
  const stats = [
    { Icon: Radio, label: "Live now", value: all.filter((a) => a.state === "live").length, cls: "text-emerald-300" },
    { Icon: CalendarClock, label: "Starting soon", value: all.filter((a) => a.state === "upcoming").length, cls: "text-sky-300" },
    { Icon: Users, label: "Your contests", value: mine.length, cls: "text-pink-300" },
  ];

  return (
    <div className="space-y-8">
      <PageHero Icon={Trophy} tone="amber" title="Compete" sub="Pick any topic, set a goal and a deadline, then race a bot, a friend or a whole group. Public contests can be watched by anyone; private ones only by the people in them.">
        {user ? <span className="flex flex-wrap items-center gap-3"><Link href="/start" className="btn"><Plus size={16} />Start a race</Link><Link href="/competitions/new" className="text-sm text-slate-400 underline">More options</Link></span> : <Link href="/login" className="btn"><LogIn size={16} />Sign in to compete</Link>}
      </PageHero>

      {spotlight && (() => {
        const { c, trackName, track, humans, bots } = spotlight, accent = artFor(track.slug, trackName, track.kind).color;
        const elapsed = Math.min(1, Math.max(0, (t - c.startsAt) / Math.max(1, c.endsAt - c.startsAt)));
        return (
          <Link href={`/competitions/${c.slug}`} className="card card-hover pop relative block overflow-hidden p-6" style={{ background: `linear-gradient(120deg, ${accent}2e, #ffffff 62%)` }} aria-label={`Live now: ${c.title}`}>
            <svg className="pointer-events-none absolute -right-8 -top-14 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke={accent} strokeOpacity=".2" /><circle cx="120" cy="80" r="58" fill="none" stroke={accent} strokeOpacity=".3" strokeDasharray="4 6" className="march" /></svg>
            <div className="relative flex flex-wrap items-center gap-5">
              <SubjectArt slug={track.slug} name={trackName} kind={track.kind} size={76} className="shadow-lg" />
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300"><i className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />Live now</span>
                <h2 className="mt-1 truncate text-2xl font-extrabold">{c.title}</h2>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300"><span className="inline-flex items-center gap-1"><Target size={14} className="text-pink-300" />{trackName} · gain {c.goalLevels} level{c.goalLevels === 1 ? "" : "s"}</span><span className="inline-flex items-center gap-1"><Users size={14} />{humans} {humans === 1 ? "person" : "people"}{bots > 0 && ` + ${bots} bot${bots === 1 ? "" : "s"}`}</span><span className="inline-flex items-center gap-1"><Clock size={14} />ends in {span(c.endsAt - t)}</span>{c.prizeAmount > 0 && <span className="inline-flex items-center gap-1 font-bold text-amber-300"><Coins size={14} />Prize</span>}</p>
              </div>
              <Ring pct={elapsed} label={`${Math.round(elapsed * 100)}%`} sub="of time" size={84} color="#10b981" />
              <span className="btn">Open the race<ArrowRight size={16} /></span>
            </div>
          </Link>
        );
      })()}

      <div className="grid grid-cols-3 gap-3">
        <StatTile i={0} Icon={Radio} label="Live now" value={stats[0].value} color={PALETTE.emerald} />
        <StatTile i={1} Icon={CalendarClock} label="Starting soon" value={stats[1].value} color={PALETTE.sky} />
        <StatTile i={2} Icon={Users} label="Your contests" value={stats[2].value} color={PALETTE.pink} />
      </div>

      <section aria-label="How contests work">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[{ Icon: Target, t: "Pick a topic and a goal", d: "Choose any subject, how many levels to gain, and a deadline.", tone: "bg-pink-500/15 text-pink-300" }, { Icon: Swords, t: "Race people or bots", d: "Friends, a team, or simulated rivals on a live leaderboard.", tone: "bg-violet-500/15 text-violet-300" }, { Icon: Award, t: "Earn a certificate", d: "Everyone who reaches the goal can claim one. First place is Champion.", tone: "bg-amber-500/15 text-amber-300" }].map(({ Icon, t: title, d, tone }, i) => (
            <li key={title} className="card rise flex items-start gap-3 p-4" style={{ "--i": i } as React.CSSProperties}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
              <div><div className="text-sm font-bold"><span className="mr-1 text-slate-400">{i + 1}.</span>{title}</div><p className="mt-0.5 text-xs text-slate-400">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Swords size={17} /></span>Your contests <span className="text-sm font-normal text-slate-400">{mine.length}</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((m) => <CompetitionCard key={m.c.id} card={m} />)}</div>
        </section>
      )}

      {(["live", "upcoming", "finished"] as const).map((s) => group(s).length > 0 && (
        <section key={s}>
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold">{(() => { const { Icon, tone } = SECTION[s]; return <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon size={17} /></span>; })()}{SECTION[s].title} <span className="text-sm font-normal text-slate-400">{group(s).length} · public</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group(s).slice(0, 12).map((m) => <CompetitionCard key={m.c.id} card={m} />)}</div>
          {group(s).length > 12 && <p className="mt-2 text-xs text-slate-400">Showing the 12 most recent of {group(s).length}.</p>}
        </section>
      ))}

      {open.length === 0 && mine.length === 0 && <EmptyState Icon={Trophy} tone="amber" title="No public contests yet">Be the first: pick a topic, set a goal and challenge a bot or a friend.</EmptyState>}
    </div>
  );
}

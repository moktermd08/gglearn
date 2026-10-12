import Link from "next/link";
import { Flame, Medal, Sparkles, Trophy } from "lucide-react";
import { PageHero, PALETTE, StatTile } from "@/components/charts";
import { BadgeTile, PlayerLevelCard, StreakCard, TIER, badgeDate } from "@/components/Achievements";
import { requireUser } from "@/lib/auth";
import { ShareButton } from "@/components/ShareButton";
import { db, shareCards } from "@/lib/db";
import { and, eq, isNull } from "drizzle-orm";
import { revokeShare } from "@/app/share/actions";
import { BADGE_GROUPS, PLAYER_TITLES, progressionFor, xpToReach } from "@/lib/progression";

export const metadata = { title: "Achievements — gglearn" };
export const dynamic = "force-dynamic";

export default async function Achievements() {
  const me = await requireUser();
  const p = progressionFor(me.id);
  const shared = db.select().from(shareCards).where(and(eq(shareCards.userId, me.id), isNull(shareCards.revokedAt))).all();
  const next = p.badges.filter((b) => !b.earned).sort((a, b) => b.pct - a.pct).slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHero Icon={Medal} tone="amber" title="Achievements" sub="Your player level, your streak and every badge. Everything here comes from real exams, quests and contests, so it cannot be clicked through.">
        <Link href="/campaigns" className="btn"><Trophy size={16} />Find a campaign</Link>
      </PageHero>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-label="Player level"><PlayerLevelCard p={p.player} /><ShareButton kind="level" refKey="level" label="Share my level" className="mt-3" /></section>
        <section className="card p-5" aria-label="Streak"><StreakCard s={p.streak} />{p.streak.longest >= 3 && <ShareButton kind="streak" refKey="streak" label="Share my streak" className="mt-3" />}</section>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile i={0} Icon={Sparkles} label="Total XP" value={p.facts.xp.toLocaleString("en-GB")} color={PALETTE.sky} />
        <StatTile i={1} Icon={Flame} label="Longest streak" value={p.streak.longest} color="#ea580c" />
        <StatTile i={2} Icon={Medal} label="Badges" value={`${p.earned}/${p.badges.length}`} color={PALETTE.amber} />
        <StatTile i={3} Icon={Trophy} label="Levels passed" value={p.facts.levelsPassed} color={PALETTE.violet} />
      </div>

      {next.length > 0 && (
        <section aria-label="Closest badges">
          <h2 className="mb-3 text-lg font-bold">Closest to earning</h2>
          <ul className="grid gap-3 sm:grid-cols-3">{next.map((b) => (
            <li key={b.key} className="card flex items-center gap-3 p-4">
              <span className="text-3xl" aria-hidden>{b.icon}</span>
              <div className="min-w-0 flex-1"><div className="text-sm font-bold">{b.name}</div><div className="text-xs text-slate-400">{b.desc}</div>
                <div className="bar mt-2 !h-1.5"><i style={{ width: `${b.pct * 100}%` }} /></div>
                <div className="mt-1 text-[11px] text-slate-400">{Math.min(b.value, b.target).toLocaleString("en-GB")} / {b.target.toLocaleString("en-GB")}</div></div>
            </li>))}</ul>
        </section>
      )}

      {BADGE_GROUPS.map((g) => (
        <section key={g} aria-label={`${g} badges`}>
          <h2 className="mb-3 text-lg font-bold">{g} <span className="text-sm font-normal text-slate-400">{p.badges.filter((b) => b.group === g && b.earned).length}/{p.badges.filter((b) => b.group === g).length}</span></h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{p.badges.filter((b) => b.group === g).map((b) => (
            <li key={b.key} className={`card flex items-center gap-3 p-3 ${b.earned ? "" : "opacity-80"}`}>
              <div className="w-16 shrink-0"><BadgeTile b={b} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{b.name}</span><span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{TIER[b.tier].label}</span></div>
                <div className="text-xs text-slate-400">{b.desc}</div>
                {b.earned
                  ? <div className="mt-1 flex items-center gap-3"><span className="text-[11px] font-semibold text-emerald-300">Earned{b.earnedAt ? ` ${badgeDate(b.earnedAt)}` : ""}</span><ShareButton kind="badge" refKey={b.key} /></div>
                  : <><div className="bar mt-2 !h-1.5"><i style={{ width: `${b.pct * 100}%` }} /></div><div className="mt-1 text-[11px] text-slate-400">{Math.min(b.value, b.target).toLocaleString("en-GB")} / {b.target.toLocaleString("en-GB")}</div></>}
              </div>
            </li>))}</ul>
        </section>
      ))}

      {shared.length > 0 && (
        <section className="card p-5" aria-label="Your shared cards">
          <h2 className="mb-2 text-lg font-bold">Your shared cards</h2>
          <p className="mb-3 text-xs text-slate-400">These are public to anyone with the link, showing your first name and initial. Stop sharing to take one down.</p>
          <ul className="divide-y divide-black/5">{shared.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2 text-sm"><Link href={`/s/${s.code}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{s.title}: {s.headline}</Link><form action={revokeShare.bind(null, s.id)}><button className="text-xs text-slate-400 underline" type="submit">Stop sharing</button></form></li>
          ))}</ul>
        </section>
      )}

      <section className="card p-5" aria-label="How levels work">
        <h2 className="mb-2 text-lg font-bold">How player levels work</h2>
        <p className="text-sm text-slate-400">Every exam you finish and every daily quest earns XP, on any subject. Your player level rises with your total XP: level 2 at {xpToReach(2)} XP, level 10 at {xpToReach(10).toLocaleString("en-GB")}, level 50 at {xpToReach(50).toLocaleString("en-GB")}, up to level 100. Your title changes every ten levels: {PLAYER_TITLES.join(", ")}. A streak counts each UTC day on which you finish a quest or an exam.</p>
        <p className="mt-2 text-xs text-slate-400">Badges are checked whenever you open this page, the dashboard or your profile, and after each exam. Badges you had already earned before this feature launched show the date they were first recognised.</p>
      </section>
    </div>
  );
}

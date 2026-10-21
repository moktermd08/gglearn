import Link from "next/link";
import { CalendarDays, Flame, GraduationCap, Medal, Sparkles, Target, Trophy, Users } from "lucide-react";
import { InviteFriendsCard } from "@/components/InviteFriendsCard";
import { Donut, PageHero, PALETTE, StatTile } from "@/components/charts";
import { BadgeTile, PlayerLevelCard, StreakCard, TIER, badgeDate } from "@/components/Achievements";
import { requireUser } from "@/lib/auth";
import { ShareButton } from "@/components/ShareButton";
import { db, shareCards } from "@/lib/db";
import { and, eq, isNull } from "drizzle-orm";
import { revokeShare } from "@/app/(site)/share/actions";
import { BADGE_GROUPS, PLAYER_TITLES, progressionFor, xpToReach } from "@/lib/progression";

export const metadata = { title: "Achievements — gglearn" };
export const dynamic = "force-dynamic";

const GROUP: Record<string, { Icon: typeof Flame; color: string; tone: string }> = {
  Streaks: { Icon: Flame, color: "#ea580c", tone: "bg-orange-500/15 text-orange-400" },
  XP: { Icon: Sparkles, color: PALETTE.sky, tone: "bg-sky-500/15 text-sky-300" },
  Levels: { Icon: Target, color: PALETTE.violet, tone: "bg-violet-500/15 text-violet-300" },
  Mastery: { Icon: GraduationCap, color: PALETTE.emerald, tone: "bg-emerald-500/15 text-emerald-300" },
  Contests: { Icon: Trophy, color: PALETTE.amber, tone: "bg-amber-500/15 text-amber-300" },
  Seasons: { Icon: CalendarDays, color: PALETTE.pink, tone: "bg-pink-500/15 text-pink-300" },
  Community: { Icon: Users, color: "#14b8a6", tone: "bg-teal-500/15 text-teal-400" },
};
const TIER_TEXT = { bronze: "#9a4a0c", silver: "#475569", gold: "#854d0e", legend: "#a21caf" } as const; // darker twins of TIER_COLOR, for text
const TIER_COLOR = { bronze: "#ea8a3c", silver: "#94a3b8", gold: "#eab308", legend: "#d946ef" } as const;

/** Percentage ring for a badge that is part-way there. */
function MiniRing({ pct, color, children }: { pct: number; color: string; children: React.ReactNode }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center" role="img" aria-label={`${Math.round(pct * 100)} percent`}>
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden><circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="5" /><circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.04, pct))} /></svg>
      <span className="text-2xl" aria-hidden>{children}</span>
    </span>
  );
}

export default async function Achievements() {
  const me = await requireUser();
  const p = progressionFor(me.id);
  const shared = db.select().from(shareCards).where(and(eq(shareCards.userId, me.id), isNull(shareCards.revokedAt))).all();
  const tiers = (["bronze", "silver", "gold", "legend"] as const).map((t) => ({ t, have: p.badges.filter((b) => b.tier === t && b.earned).length, all: p.badges.filter((b) => b.tier === t).length }));
  const titleAt = Math.min(PLAYER_TITLES.length - 1, Math.floor(p.player.level / 10));
  const next = p.badges.filter((b) => !b.earned).sort((a, b) => b.pct - a.pct).slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHero Icon={Medal} tone="amber" title="Achievements" sub="Your player level, your streak and every badge. Everything here comes from real exams, quests and contests, so it cannot be clicked through.">
        <Link href="/campaigns" className="btn"><Trophy size={16} />Find a campaign</Link>
      </PageHero>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-label="Player level"><PlayerLevelCard p={p.player} />
          <ol className="mt-4 flex gap-1" aria-label="Player titles">{PLAYER_TITLES.map((t, i) => (
            <li key={t} title={`${t} · level ${i * 10 || 1}+`} className="min-w-0 flex-1">
              <i className="block h-1.5 rounded-full" style={{ background: i <= titleAt ? "linear-gradient(90deg,#6366f1,#a855f7)" : "rgba(0,0,0,.08)", opacity: i === titleAt ? 1 : i < titleAt ? 0.6 : 1 }} />
              <span className={`mt-1 hidden truncate text-center text-[9px] font-bold uppercase tracking-wide sm:block ${i === titleAt ? "text-indigo-300" : "text-slate-500"}`}>{t}</span>
            </li>))}</ol>
          <ShareButton kind="level" refKey="level" label="Share my level" className="mt-3" /></section>
        <section className="card p-5" aria-label="Streak"><StreakCard s={p.streak} freezes={p.freezes} />{p.streak.longest >= 3 && <ShareButton kind="streak" refKey="streak" label="Share my streak" className="mt-3" />}</section>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile i={0} Icon={Sparkles} label="Total XP" value={p.facts.xp.toLocaleString("en-GB")} color={PALETTE.sky} />
        <StatTile i={1} Icon={Flame} label="Longest streak" value={p.streak.longest} color="#ea580c" />
        <StatTile i={2} Icon={Medal} label="Badges" value={`${p.earned}/${p.badges.length}`} color={PALETTE.amber} />
        <StatTile i={3} Icon={Trophy} label="Levels passed" value={p.facts.levelsPassed} color={PALETTE.violet} />
      </div>

      <section className="card flex flex-wrap items-center gap-6 p-5" aria-label="Badge collection">
        <Donut size={116} parts={tiers.map((x): { label: string; value: number; color: string } => ({ label: TIER[x.t].label, value: x.have, color: TIER_COLOR[x.t] })).concat(p.earned === p.badges.length ? [] : [{ label: "To earn", value: p.badges.length - p.earned, color: "rgba(148,163,184,.3)" }])} center={`${p.earned}/${p.badges.length}`} sub="badges" />
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="text-lg font-bold">Your collection</h2>
          <p className="text-sm text-slate-400">{p.earned === p.badges.length ? "Every badge earned. Nothing left to chase." : `${p.badges.length - p.earned} left to earn across ${BADGE_GROUPS.length} groups.`}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{tiers.map(({ t, have, all }) => (
            <li key={t} className="rounded-xl p-2.5 ring-1" style={{ background: `${TIER_COLOR[t]}1f`, ["--tw-ring-color" as string]: `${TIER_COLOR[t]}66` }}>
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: TIER_TEXT[t] }}>{TIER[t].label}</div>
              <div className="text-lg font-black">{have}<span className="text-xs font-bold text-slate-400"> / {all}</span></div>
            </li>))}</ul>
        </div>
      </section>

      {next.length > 0 && (
        <section aria-label="Closest badges">
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Target size={17} /></span>Closest to earning</h2>
          <ul className="grid gap-3 sm:grid-cols-3">{next.map((b) => (
            <li key={b.key} className="card flex items-center gap-3 p-4">
              <MiniRing pct={b.pct} color={GROUP[b.group]?.color ?? PALETTE.indigo}>{b.icon}</MiniRing>
              <div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><span className="text-sm font-bold">{b.name}</span><span className="text-xs font-extrabold text-slate-400">{Math.round(b.pct * 100)}%</span></div><div className="text-xs text-slate-400">{b.desc}</div>
                <div className="bar mt-2 !h-1.5"><i style={{ width: `${b.pct * 100}%` }} /></div>
                <div className="mt-1 text-[11px] text-slate-400">{Math.min(b.value, b.target).toLocaleString("en-GB")} / {b.target.toLocaleString("en-GB")}</div></div>
            </li>))}</ul>
        </section>
      )}

      <InviteFriendsCard userId={me.id} />

      {BADGE_GROUPS.map((g) => (
        <section key={g} aria-label={`${g} badges`}>
          {(() => { const { Icon, color, tone } = GROUP[g]; const all = p.badges.filter((b) => b.group === g), have = all.filter((b) => b.earned).length; return (
            <div className="mb-3 flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon size={17} /></span>
              <h2 className="text-lg font-bold">{g}</h2>
              <span className="text-sm font-normal text-slate-400">{have}/{all.length}</span>
              <span className="bar ml-auto !h-1.5 w-24 sm:w-40"><i style={{ width: `${(have / all.length) * 100}%`, background: color }} /></span>
            </div>); })()}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{p.badges.filter((b) => b.group === g).sort((a, b) => Number(b.earned) - Number(a.earned)).map((b) => (
            <li key={b.key} className="card flex items-center gap-3 border-l-4 p-3" style={{ borderLeftColor: b.earned ? TIER_COLOR[b.tier] : "transparent" }}>
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

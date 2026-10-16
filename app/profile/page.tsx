import { eq } from "drizzle-orm";
import Link from "next/link";
import { certificates, db, enrollments, tracks, userAvatars, users } from "@/lib/db";
import { setSeasonBoard } from "./actions";
import { requireUser } from "@/lib/auth";
import { Competitor } from "@/components/Competitor";
import { AvatarPicker } from "@/components/AvatarPicker";
import { RankEmblem } from "@/components/RankEmblem";
import { SubjectArt } from "@/components/SubjectArt";
import { Calendar, Flame, GraduationCap, Mail, Medal, Mountain, Shield, ShieldCheck, Sparkles, Swords, Trash2, TrendingUp, UserRound, Activity, Briefcase } from "lucide-react";
import { certState } from "@/lib/certs";
import { LEVELS, MAX_LEVEL, TIERS, certTitle, tierOf } from "@/lib/levels";
import { activityFor, trackStats } from "@/lib/stats";
import { progressionFor } from "@/lib/progression";
import { BadgeWall, PlayerLevelCard, StreakCard } from "@/components/Achievements";
import { avatarLooks } from "@/lib/avatars";
import { roleLabel } from "@/lib/journey";
import { AreaChart, EmptyState, Heatmap, PALETTE, StatTile } from "@/components/charts";
import { removePhoto } from "./actions";
import PhotoForm from "./photo-form";
import PasswordForm from "./password-form";

export const metadata = { title: "Your profile — gglearn" };

const date = (sec: number, opts: Intl.DateTimeFormatOptions) => new Date(sec * 1000).toLocaleDateString("en-GB", opts);
const ROLE: Record<string, string> = { admin: "Admin", manager: "Manager", learner: "Learner" };

export default async function Profile() {
  const me = await requireUser();
  const looks = await avatarLooks();
  const photo = db.select({ v: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, me.id)).get();
  const mine = db.select({ e: enrollments, t: tracks }).from(enrollments).innerJoin(tracks, eq(tracks.id, enrollments.trackId)).where(eq(enrollments.userId, me.id)).all()
    .map(({ e, t }) => ({ t, s: trackStats(me.id, t, e.startedAt) }))
    .sort((a, b) => b.s.passed - a.s.passed || b.s.xp - a.s.xp);
  const certs = db.select({ c: certificates, t: tracks }).from(certificates).innerJoin(tracks, eq(tracks.id, certificates.trackId)).where(eq(certificates.userId, me.id)).all()
    .sort((a, b) => b.c.issuedAt - a.c.issuedAt);
  const prog = progressionFor(me.id);
  const boardShown = db.select({ s: users.seasonBoard }).from(users).where(eq(users.id, me.id)).get()?.s !== "hide";
  const totalXp = prog.facts.xp, levels = mine.reduce((a, m) => a + m.s.passed, 0), streak = prog.streak.current;
  const bestLevel = Math.max(0, ...mine.map((m) => m.s.passed)), tier = TIERS[tierOf(bestLevel)];
  const activity = activityFor(me.id, 24);
  const weekXp = activity.slice(-7).reduce((a, d) => a + d.value, 0), activeDays = activity.filter((d) => d.value > 0).length;
  const photoUrl = photo ? `/api/avatar/${me.id}?v=${photo.v}` : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* profile card: cover, portrait, who you are */}
      <section className="card pop overflow-hidden">
        <div className="relative h-28 sm:h-32" style={{ background: `linear-gradient(120deg, hsl(${tier.hue} 80% 52%), hsl(${(tier.hue + 50) % 360} 75% 45%) 60%, #9333ea)` }}>
          <svg className="absolute inset-0 h-full w-full opacity-25" aria-hidden><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#fff" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots)" /></svg>
          <svg className="pointer-events-none absolute -right-6 -top-16 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke="#fff" strokeOpacity=".3" /><circle cx="120" cy="80" r="58" fill="none" stroke="#fff" strokeOpacity=".4" strokeDasharray="4 6" className="march" /></svg>
        </div>
        <div className="px-6 pb-6">
          <div className="relative z-10 -mt-14 flex flex-wrap items-end gap-4">
            <div className="rounded-full bg-[#fff] p-1.5 shadow-lg ring-1 ring-black/10"><Competitor isBot={false} seed={`u${me.id}`} name={me.name} size={108} photoUrl={photoUrl} /></div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{me.name}</h1>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400"><Mail size={13} />{me.email}</div>
            </div>
            <div className="pb-1"><AvatarPicker me={looks.me} rival={looks.rival} photoUrl={looks.photoUrl} signedIn level={bestLevel} /></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[#fff]" style={{ background: `hsl(${tier.hue} 70% 45%)` }}><Medal size={13} />{tier.name} rank</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/12 px-3 py-1 text-indigo-300"><ShieldCheck size={13} />{ROLE[me.role] ?? me.role}</span>
            {me.audience === "staff" && <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/12 px-3 py-1 text-sky-300"><Briefcase size={13} />{roleLabel(me.jobRole)}</span>}
            {me.audience === "customer" && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-amber-300">Customer</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-slate-300"><Calendar size={13} />Member since {date(me.createdAt, { month: "long", year: "numeric" })}</span>
            {streak > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-orange-500"><Flame size={13} fill="#f97316" />{streak}-day streak</span>}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-label="Player level"><PlayerLevelCard p={prog.player} /></section>
        <section className="card p-5" aria-label="Streak"><StreakCard s={prog.streak} /></section>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile i={0} Icon={Sparkles} label="Total XP" value={totalXp.toLocaleString("en-GB")} color={PALETTE.sky} spark={activity.slice(-14).map((d) => d.value)} />
        <StatTile i={1} Icon={Flame} label="Day streak" value={streak} color="#ea580c" />
        <StatTile i={2} Icon={Mountain} label="Levels passed" value={levels} color={PALETTE.violet} />
        <StatTile i={3} Icon={GraduationCap} label="Certificates" value={certs.length} color={PALETTE.amber} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Swords size={17} /></span>Your subjects <span className="text-xs font-normal text-slate-400">{mine.length} enrolled</span></h2>
            {mine.length === 0 ? (
              <EmptyState Icon={Swords} tone="pink" title="No subjects yet">Pick something to learn and it will show up here with your level.</EmptyState>
            ) : (
              <>
                <ul className="space-y-1">{mine.slice(0, 6).map(({ t, s }) => (
                  <li key={t.id}>
                    <Link href={`/tracks/${t.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-black/[.03]">
                      <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{t.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${(s.passed / MAX_LEVEL) * 100}%`, background: `hsl(${TIERS[tierOf(s.passed)].hue} 75% 52%)` }} /></span>
                          <span className="shrink-0 text-[11px] text-slate-400">{s.passed === 0 ? (s.xp > 0 ? "Level 1 in progress" : "Not started") : `L${s.passed} ${LEVELS[s.passed - 1]}`}</span>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-0.5 text-xs text-sky-300"><Sparkles size={11} />{s.xp}</span>
                    </Link>
                  </li>
                ))}</ul>
                {mine.length > 6 && (
                  <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs font-semibold text-sky-300">Show the other {mine.length - 6}</summary>
                    <ul className="mt-2 space-y-1">{mine.slice(6).map(({ t, s }) => (
                      <li key={t.id}><Link href={`/tracks/${t.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 text-sm transition hover:bg-black/[.03]"><SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={28} /><span className="min-w-0 flex-1 truncate">{t.name}</span><span className="text-[11px] text-slate-400">{s.passed === 0 ? "Not started" : `L${s.passed}`}</span></Link></li>
                    ))}</ul></details>
                )}
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><GraduationCap size={17} /></span>Certificates</h2>
            {certs.length === 0 ? (
              <EmptyState Icon={GraduationCap} tone="amber" title="Your first certificate is a few levels away">Pass level 5 of any subject to earn a Foundation certificate that anyone can verify.</EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">{certs.map(({ c, t }) => (
                <li key={c.id}>
                  <Link href={`/cert/${c.code}`} className="card-hover relative flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/40 p-3" style={{ background: `linear-gradient(135deg, hsl(${TIERS[tierOf(c.level)].hue} 85% 55% / .14), #fff 70%)` }}>
                    <RankEmblem level={c.level} size={44} />
                    <div className="min-w-0"><div className="truncate text-sm font-bold">{certTitle(c.level)} · {t.name}</div><div className="text-[11px] text-slate-400">Level {c.level} · {Math.round(c.score * 100)}% · {date(c.issuedAt, { day: "numeric", month: "short", year: "numeric" })}{(() => { const l = certState(c); return l.state === "expired" ? <b className="text-rose-500"> · Expired — pass level {c.level} again to renew</b> : l.state === "expiring" ? <b className="text-amber-500"> · Expires in {l.daysLeft} day{l.daysLeft === 1 ? "" : "s"}; pass again to renew</b> : null; })()}</div></div>
                  </Link>
                </li>
              ))}</ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Activity size={17} /></span>Learning rhythm</h2>
            <div className="mb-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-black/[.03] p-2"><div className="text-xl font-extrabold">{weekXp}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">XP this week</div></div>
              <div className="rounded-xl bg-black/[.03] p-2"><div className="text-xl font-extrabold">{activeDays}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">active days</div></div>
            </div>
            <AreaChart data={activity.slice(-30).map((d) => ({ label: d.day.slice(5), value: d.value }))} color={PALETTE.emerald} height={120} />
            <div className="mt-3"><div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Last 24 weeks</div><Heatmap days={activity} /></div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-yellow-500/15 text-yellow-500"><TrendingUp size={17} /></span>Badges <span className="text-xs font-normal text-slate-400">{prog.earned}/{prog.badges.length} earned</span></h2>
            <BadgeWall p={prog} />
          </section>
        </aside>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><UserRound size={17} /></span>Your photo</h2>
        <p className="mb-3 flex gap-2 text-sm text-slate-300"><Shield size={16} className="mt-0.5 shrink-0 text-emerald-300" /><span>A photo is optional. Without one you get a generated face. In contests, colleagues see your photo; strangers see it only if you play in a <b>public</b> contest.</span></p>
        <PhotoForm />
        {photo && <form action={removePhoto} className="mt-2"><button className="inline-flex items-center gap-1 text-sm text-slate-400 underline"><Trash2 size={13} />Remove my photo</button></form>}
      </section>

      <section id="password" className="card scroll-mt-24 p-5">
        <h2 className="mb-1 text-lg font-bold">Password</h2>
        <p className="mb-3 text-sm text-slate-400">Changing it signs you out on your other devices. If you forget it, ask your manager to set a temporary one.</p>
        <PasswordForm />
      </section>

      <section id="season-board" className="card scroll-mt-24 p-5">
        <h2 className="mb-1 text-lg font-bold">Season leaderboards</h2>
        <p className="mb-3 text-sm text-slate-400">{boardShown ? "Colleagues in your group can see your first name, an initial and your points on the weekly and monthly boards." : "You are hidden from every weekly and monthly board, including past ones, and will not earn new season results."}</p>
        <form action={setSeasonBoard}><input type="hidden" name="show" value={boardShown ? "0" : "1"} /><button className="btn btn-ghost" type="submit">{boardShown ? "Hide me from the boards" : "Show me on the boards"}</button></form>
      </section>
    </div>
  );
}

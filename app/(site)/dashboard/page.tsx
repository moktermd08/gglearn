import { eq } from "drizzle-orm";
import { ROLE_CHECK_VALID_DAYS } from "@/lib/roleCheck";
import Link from "next/link";
import { brands, checklistItems, db, enrollments, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, TIERS, tierOf } from "@/lib/levels";
import { QUEST_XP, activityFor, trackStats } from "@/lib/stats";
import { progressionFor } from "@/lib/progression";
import { periodAt, standings as seasonStandings, timeLeft } from "@/lib/seasons";
import { arenaOfUser } from "@/lib/arena";
import { BadgeWall, PlayerLevelCard } from "@/components/Achievements";
import { RankEmblem } from "@/components/RankEmblem";
import { AreaChart, EmptyState, Heatmap, PALETTE, Radar, StatTile } from "@/components/charts";
import { rivalFor } from "@/lib/rivals";
import { Avatar } from "@/components/Avatar";
import { avatarLooks } from "@/lib/avatars";
import { AvatarPicker } from "@/components/AvatarPicker";
import { listFor, now } from "@/lib/competitions";
import { CompetitionCard } from "@/components/CompetitionCard";
import { SubjectArt } from "@/components/SubjectArt";
import { Ring } from "@/components/Ring";
import { requirementsFor, scopesOf } from "@/lib/paths";
import { careerFor } from "@/lib/careers";
import { goalOf, roleLabel } from "@/lib/journey";
import { pendingFor } from "@/lib/freshness";
import { coverageFor, hasNoRolePath } from "@/lib/roles";
import { enroll, toggleChecklist } from "@/app/actions";
import { ManagerGlance } from "@/components/ManagerGlance";
import { OnboardingPhases } from "@/components/OnboardingPhases";
import { onboardingFor } from "@/lib/onboarding";
import { BookOpen, CircleCheck, Zap, AlertTriangle, ArrowUpRight, BellRing, Compass, CheckCircle2, CircleDashed, TrendingUp as Climb, CheckSquare, ClipboardList, Flame, ShieldCheck, Square, Sparkles, Swords, Target, TrendingDown, TrendingUp, Trophy, Medal, Equal, Mountain, Activity, Radar as RadarIcon, Rocket } from "lucide-react";

export default async function Dashboard() {
  const user = await requireUser();
  const looks = await avatarLooks();
  const mine = db.select({ e: enrollments, t: tracks, b: brands }).from(enrollments)
    .innerJoin(tracks, eq(tracks.id, enrollments.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId))
    .where(eq(enrollments.userId, user.id)).all();
  const todo = db.select().from(checklistItems).where(eq(checklistItems.userId, user.id)).all();
  const stats = mine.map((m) => ({ ...m, s: trackStats(user.id, m.t, m.e.startedAt) }));
  const prog = progressionFor(user.id);
  const week = periodAt("week"), weekRows = seasonStandings(week, user.audience, undefined, arenaOfUser(user.id)), weekMe = weekRows.find((r) => r.userId === user.id);
  const totalXp = prog.facts.xp;
  const bestStreak = prog.streak.current;
  const contests = listFor(user, { mineOnly: true }).filter((x) => x.state === "live" || x.state === "upcoming" || x.invited).slice(0, 6);
  const questsDone = stats.reduce((a, m) => a + m.s.doneToday.size, 0), questsTotal = stats.length ? 3 : 0; // the daily goal is three quests, on any subjects
  const levelsPassed = stats.reduce((a, m) => a + m.s.passed, 0);
  const checkDone = todo.filter((c) => c.done).length;
  const required = requirementsFor(user, scopesOf(user.id));
  const requiredOpen = required.filter((r) => !r.done), overdue = requiredOpen.filter((r) => r.overdue);
  const onboarding = onboardingFor(user);
  const career = careerFor(user);
  const goal = goalOf(user.id);
  const unread = pendingFor(user.id);
  const noRolePath = user.audience === "staff" && !(user.role !== "learner" && user.jobRole === "general") && hasNoRolePath(coverageFor(user.jobRole)); // an admin account with no job role is not missing a learning path
  const enrolledIds = new Set(mine.map((m) => m.t.id));
  const activity = activityFor(user.id, 24);
  const last30 = activity.slice(-30).map((d) => ({ label: d.day.slice(5), value: d.value }));
  const weekXp = activity.slice(-7).reduce((a, d) => a + d.value, 0);
  const activeDays = activity.filter((d) => d.value > 0).length;
  const radarPick = [...stats].sort((a, b) => b.s.passed - a.s.passed).slice(0, 6);
  const shortName = (n: string) => n.replace(/^\d+\.\s*/, "").replace(/:.*$/, "");
  const radarAxes = radarPick.map((m) => ({ // the short form can collide ("Tools: plan" / "Tools: build"): fall back to the full name so labels stay unique
    label: radarPick.filter((o) => shortName(o.t.name) === shortName(m.t.name)).length > 1 ? m.t.name.replace(/^\d+\.\s*/, "") : shortName(m.t.name), value: m.s.passed / MAX_LEVEL }));

  const daysLeft = (sec: number) => Math.ceil((sec - now()) / 86400);
  const statByTrack = new Map(stats.map((m) => [m.t.id, m]));
  // the one thing to do next: the most urgent required subject, otherwise the subject you have earned the most XP in
  const focusReq = [...requiredOpen].sort((x, y) => Number(y.overdue) - Number(x.overdue) || x.dueAt - y.dueAt)[0];
  const focusStat = (focusReq && statByTrack.get(focusReq.track.id)) ?? stats.find((m) => m.s.passed < MAX_LEVEL);
  const focusTrack = focusReq?.track ?? focusStat?.t;
  const focusPassed = focusStat?.s.passed ?? focusReq?.passed ?? 0;
  const focusNext = Math.min(MAX_LEVEL, focusPassed + 1);
  const bestLevel = Math.max(0, ...stats.map((m) => m.s.passed));
  const bestTier = TIERS[tierOf(bestLevel)];

  const dueChip = (r: (typeof required)[number]) => {
    if (r.done) return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">Passed</span>;
    const d = daysLeft(r.dueAt);
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.overdue ? "bg-rose-500/15 text-rose-300" : d <= 7 ? "bg-amber-500/15 text-amber-300" : "bg-black/5 text-slate-400"}`}>{r.overdue ? `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue` : d <= 0 ? "Due today" : `${d} day${d === 1 ? "" : "s"} left`}</span>;
  };
  const reqRow = (r: (typeof required)[number]) => (
    <li key={r.track.id}>
      <Link href={`/tracks/${r.track.slug}`} className="group flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-black/[.03]">
        <SubjectArt slug={r.track.slug} name={r.track.name} kind={r.track.kind} size={34} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-semibold ${r.done ? "text-slate-500" : ""}`}>{r.track.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (r.passed / r.track.requiredLevel) * 100)}%`, background: r.done ? "#10b981" : r.overdue ? "#f43f5e" : "#6366f1" }} /></span>
            <span className="shrink-0 text-[11px] text-slate-400">L{Math.min(r.passed, r.track.requiredLevel)}/{r.track.requiredLevel}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">{dueChip(r)}<span className="text-[10px] uppercase tracking-wide text-slate-500">{r.why === "mandatory" ? "mandatory" : "your role"}</span></div>
      </Link>
    </li>
  );

  const raceCard = ({ e, t, b, s }: (typeof stats)[number], idx = 0) => {
    const rv = rivalFor(t.slug), tier = TIERS[tierOf(s.passed)];
    const lead = s.passed - s.rival.level;
    return (
      <Link key={e.id} href={`/tracks/${t.slug}`} className="card card-hover rise p-4" style={{ "--i": idx } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <Avatar kind="human" level={s.passed} size={56} look={looks.me} photoUrl={looks.photoUrl} />
          <span className="text-xs font-black text-slate-500">VS</span>
          <Avatar kind="rival" level={s.rival.level} hue={rv.hue} size={56} look={looks.rival} />
          <div className="ml-auto text-right">
            <div className={`flex items-center justify-end gap-1 text-sm font-bold ${lead > 0 ? "text-emerald-300" : lead === 0 ? "text-amber-300" : "text-rose-300"}`}>
              {lead > 0 ? <TrendingUp size={15} /> : lead === 0 ? <Equal size={15} /> : <TrendingDown size={15} />}
              {lead > 0 ? `+${lead} ahead` : lead === 0 ? "Tied" : `${-lead} behind`}
            </div>
            <div className="text-xs text-slate-400">{rv.name} · L{s.rival.level}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={36} />
          <div><div className="text-xs text-slate-400">{b.name}</div><div className="font-semibold">{t.name}</div></div>
        </div>
        <div className="relative mt-2">
          <div className="bar"><i style={{ width: `${(s.passed / MAX_LEVEL) * 100}%` }} /></div>
          <span className="absolute -top-1 h-3.5 w-1 rounded bg-rose-400" title={`${rv.name} · L${s.rival.level}`} style={{ left: `${(s.rival.level / MAX_LEVEL) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>{s.passed === 0 ? (s.xp > 0 ? "Level 1 in progress" : "Not started") : `Level ${s.passed} · ${LEVELS[s.passed - 1]} · ${tier.name}`}</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-orange-300"><Flame size={12} />{s.streak}</span>
            <span className="flex items-center gap-0.5"><Sparkles size={12} className="text-sky-300" />{s.xp}</span>
            <span className="flex gap-0.5" title={`${s.doneToday.size}/3 quests today`}>{[0, 1, 2].map((n) => <i key={n} className={`h-2 w-2 rounded-full ${n < s.doneToday.size ? "bg-emerald-400" : "bg-white/20"}`} />)}</span>
          </span>
        </div>
        {e.goal && <div className="mt-1 flex items-center gap-1 text-xs text-slate-300"><Target size={12} className="text-pink-300" />{e.goal}</div>}
      </Link>
    );
  };

  const heading = (Icon: typeof Swords, tone: string, title: string, aside?: React.ReactNode) => (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon size={17} /></span>{title}</h2>
      {aside}
    </div>
  );
  const goalDone = Math.min(3, questsDone);
  const firstVisit = totalXp === 0 && levelsPassed === 0;

  return (
    <div className="space-y-6">
      {/* hero: who you are, your rank, and today's goal */}
      <header className="card pop relative flex flex-wrap items-center justify-between gap-x-5 gap-y-3 overflow-hidden p-6" style={{ background: `linear-gradient(120deg, hsl(${bestTier.hue} 85% 55% / .2), #4f46e514 50%, #ffffff 80%)` }}>
        <svg className="pointer-events-none absolute -right-8 -top-12 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke="#4f46e5" strokeOpacity=".12" /><circle cx="120" cy="80" r="60" fill="none" stroke="#9333ea" strokeOpacity=".18" strokeDasharray="4 6" className="march" /></svg>
        <Avatar kind="human" level={bestLevel} size={92} className="bob" look={looks.me} photoUrl={looks.photoUrl} />
        <div className="relative order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-widest" style={{ color: `hsl(${bestTier.hue} 70% 42%)` }}>
            <span>{bestTier.name} rank</span>
            {bestStreak > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] normal-case tracking-normal text-orange-500"><Flame size={12} fill="#f97316" />{bestStreak}-day streak</span>}
          </div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{firstVisit ? "Welcome" : "Welcome back"}, {user.name}</h1>
          <p className="text-sm text-slate-400">{firstVisit ? (focusTrack ? "Your first step is below: it takes about five minutes." : "Pick a subject below to start your first level.") : goalDone >= questsTotal && questsTotal > 0 ? "Today's goal is done. Anything more is a bonus." : "Finish today's quests to keep the streak and stay ahead of your rivals."}</p>
          <AvatarPicker me={looks.me} rival={looks.rival} photoUrl={looks.photoUrl} signedIn level={bestLevel} className="mt-2" />
        </div>
        {questsTotal > 0 && <div className="relative text-center"><Ring pct={goalDone / questsTotal} label={`${goalDone}/${questsTotal}`} sub="daily goal" size={104} color={goalDone === questsTotal ? "#34d399" : "#38bdf8"} /></div>}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile i={0} Icon={Sparkles} label="Total XP" value={totalXp.toLocaleString("en-GB")} color={PALETTE.sky} spark={activity.slice(-14).map((d) => d.value)} />
        <StatTile i={1} Icon={Flame} label="Day streak" value={bestStreak} color="#ea580c" spark={activity.slice(-14).map((d) => (d.value ? 1 : 0))} />
        <StatTile i={2} Icon={Mountain} label="Levels passed" value={levelsPassed} color={PALETTE.violet} />
        <StatTile i={3} Icon={Swords} label="Live contests" value={contests.filter((x) => x.state === "live").length} color={PALETTE.pink} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* main column: what to do next */}
        <div className="min-w-0 space-y-6">
          {user.role !== "learner" && <ManagerGlance admin={user.role === "admin"} viewer={user} />}
          {focusTrack && (
            <section aria-label="Continue" className="card relative overflow-hidden p-5" style={{ background: `linear-gradient(125deg, hsl(${TIERS[tierOf(focusNext)].hue} 85% 55% / .16), #fff 60%)` }}>
              <div className="flex flex-wrap items-center gap-4">
                <SubjectArt slug={focusTrack.slug} name={focusTrack.name} kind={focusTrack.kind} size={64} className="shadow-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-indigo-300">
                    {focusReq?.overdue ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 normal-case tracking-normal text-rose-300"><AlertTriangle size={12} />Overdue</span> : focusReq ? <span>Required next</span> : <span>Pick up where you left off</span>}
                    {focusReq && !focusReq.overdue && dueChip(focusReq)}
                  </div>
                  <h2 className="truncate text-xl font-extrabold">{focusTrack.name}</h2>
                  <p className="text-sm text-slate-400">{focusPassed === 0 ? "You have not passed a level yet" : `Level ${focusPassed} · ${LEVELS[focusPassed - 1]} passed`}{focusPassed < MAX_LEVEL && <> · next up <b className="text-slate-300">{LEVELS[focusNext - 1]}</b></>}</p>
                </div>
                <RankEmblem level={focusNext} state="current" size={56} />
              </div>
              {focusStat ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {([
                    { k: "study", Icon: BookOpen, label: "Study guide", href: `/tracks/${focusTrack.slug}/learn/${focusNext}` },
                    { k: "drill", Icon: Zap, label: "Quick drill", href: `/tracks/${focusTrack.slug}/drill` },
                    { k: "exam", Icon: Trophy, label: "Take an exam", href: `/tracks/${focusTrack.slug}#levels` },
                  ] as const).map(({ k, Icon, label, href }) => {
                    const done = focusStat.s.doneToday.has(k);
                    return (
                      <Link key={k} href={href} className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md ${done ? "border-emerald-400/50 bg-emerald-500/10" : "border-black/10 bg-[#fff]"}`}>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${done ? "bg-emerald-500/20 text-emerald-300" : "bg-indigo-500/12 text-indigo-300"}`}>{done ? <CircleCheck size={17} /> : <Icon size={17} />}</span>
                        <span className="min-w-0 flex-1 leading-tight">{label}</span>
                        <span className="flex items-center gap-0.5 text-xs text-sky-300"><Sparkles size={11} />+{QUEST_XP[k]}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4"><Link href={`/tracks/${focusTrack.slug}`} className="btn">Start this subject<ArrowUpRight size={16} /></Link></div>
              )}
            </section>
          )}

          {!focusTrack && (
            <section aria-label="Start here" className="card relative overflow-hidden border-indigo-300/40 p-5" style={{ background: "linear-gradient(125deg, rgba(99,102,241,.14), #fff 60%)" }}>
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-400"><Rocket size={26} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">Start here</div>
                  <h2 className="text-xl font-extrabold">{user.audience === "customer" ? "Pick the product you want to learn" : "Choose your first subject"}</h2>
                  <p className="text-sm text-slate-400">{user.audience === "customer" ? "Nothing has been assigned to you yet, so choose a getting-started subject. It takes a minute to find your level." : "Nothing is required of you yet. Pick any subject: we find your level, then you climb."}</p>
                </div>
                <Link href="/start" className="btn">Choose a subject<ArrowUpRight size={16} /></Link>
              </div>
            </section>
          )}

          {unread.length > 0 && (
            <Link href="/updates" className={`card flex items-center gap-3 p-4 transition hover:border-amber-300/60 ${unread.some((u) => u.overdue) ? "border-rose-400/40" : "border-amber-300/40"}`}>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15"><BellRing size={18} className="text-amber-300" /></span>
              <span className="flex-1 text-sm"><b>{unread.length} update{unread.length === 1 ? "" : "s"} to read:</b> {unread.slice(0, 2).map((u) => u.change.title).join(", ")}{unread.length > 2 && ` and ${unread.length - 2} more`}</span>
              <ArrowUpRight size={16} className="text-slate-400" />
            </Link>
          )}

          {noRolePath && (
            <section role="status" className="card flex items-start gap-3 border-amber-300/40 p-4 text-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15"><Compass size={18} className="text-amber-300" /></span>
              <div>
                <b>Nothing is set up for your role yet.</b> Your role is “{user.jobRole}”, and the academy has no learning or promotion path for it, so you only see company-wide courses. Ask your manager to check your role, or pick something to learn from <Link href="/start" className="underline">Start a journey</Link>.
              </div>
            </section>
          )}

          {required.length > 0 && (
            <section className={`card p-5 ${overdue.length ? "border-rose-400/40" : ""}`}>
              {heading(ShieldCheck, overdue.length ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300", "Required for you", <span className="text-xs text-slate-400">{required.length - requiredOpen.length}/{required.length} passed</span>)}
              <div className="bar mb-3"><i style={{ width: `${((required.length - requiredOpen.length) / required.length) * 100}%`, background: overdue.length ? "#fb7185" : undefined }} /></div>
              {overdue.length > 0 && <p role="alert" className="mb-2 flex items-center gap-1.5 text-sm text-rose-300"><AlertTriangle size={15} />{overdue.length} overdue. Please finish {overdue.length === 1 ? "it" : "these"} first.</p>}
              <ul className="space-y-0.5">{required.slice(0, 6).map(reqRow)}</ul>
              {required.length > 6 && (
                <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs font-semibold text-sky-300">Show the other {required.length - 6}</summary>
                  <ul className="mt-2 space-y-0.5">{required.slice(6).map(reqRow)}</ul></details>
              )}
            </section>
          )}

          {career && (
            <section className="card p-5">
              {heading(Climb, "bg-violet-500/15 text-violet-300", "Your career", <Link href="/journey" className="text-xs text-sky-300 underline">{goal ? `Goal: ${goal.targetRole === career.role ? "" : roleLabel(goal.targetRole) + ", "}${new Date(goal.targetDate * 1000).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "Set a career goal"}</Link>)}
              {!career.next ? (
                <p className="text-sm text-slate-300">You are at the top of the {career.role} path: {career.current.title}. Keep sharpening, and help others climb.</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-4">
                    {career.total > 0 && <Ring pct={career.done / career.total} label={`${career.done}/${career.total}`} sub="steps" size={84} color={career.ready ? "#34d399" : "#8b5cf6"} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold"><span>{career.current.title}</span><ArrowUpRight size={14} className="text-slate-400" /><span className="text-violet-300">{career.next.title}</span></div>
                      <p className="text-xs text-slate-400">{career.total ? `${career.done} of ${career.total} steps done towards ${career.next.title}` : `Steps to ${career.next.title} are still being written`}</p>
                      {career.ready && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300"><CheckCircle2 size={12} />Ready for promotion review</span>}
                    </div>
                  </div>
                  {career.hold === "role-check" && <p role="alert" className="mb-2 flex items-center gap-1.5 text-sm text-amber-300"><AlertTriangle size={15} />You have met every step. Pass a <Link href="/journey" className="underline">role check</Link> (valid for {ROLE_CHECK_VALID_DAYS} days) to be considered.</p>}
                  {career.hold === "overdue" && <p role="alert" className="mb-2 flex items-center gap-1.5 text-sm text-amber-300"><AlertTriangle size={15} />You have met every step, but required learning is overdue. Finish it to be considered.</p>}
                  <ul className="space-y-1.5 text-sm">
                    {career.next.steps.map((st) => (
                      <li key={st.reqId} className="flex items-center gap-2">
                        {st.met ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> : st.countable ? <Square size={16} className="shrink-0 text-slate-500" /> : <CircleDashed size={16} className="shrink-0 text-slate-600" />}
                        <span className={`min-w-0 flex-1 truncate ${st.met ? "text-slate-500" : st.countable ? "" : "text-slate-500"}`}>{st.track.name}</span>
                        {st.countable && <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-black/10" aria-hidden><i className="block h-full rounded-full bg-violet-400" style={{ width: `${(Math.min(st.passed, st.need) / st.need) * 100}%` }} /></span>}
                        <span className="w-12 shrink-0 text-right text-xs text-slate-500">{st.countable ? `${Math.min(st.passed, st.need)}/${st.need}` : "soon"}</span>
                        {st.countable && !st.met && (enrolledIds.has(st.track.id)
                          ? <Link href={`/tracks/${st.track.slug}`} className="shrink-0 text-xs text-sky-300 underline">Continue</Link>
                          : <form action={enroll} className="shrink-0"><input type="hidden" name="trackId" value={st.track.id} /><input type="hidden" name="goal" value={`Towards ${career.next!.title}`} /><button className="text-xs text-sky-300 underline">Start</button></form>)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {onboarding.gated && onboarding.phases.length > 0 && (
            <section className="card p-5">
              {heading(Rocket, "bg-violet-500/15 text-violet-300", "Onboarding phases", <span className="text-xs text-slate-400">a manager signs each one off</span>)}
              <OnboardingPhases o={onboarding} />
            </section>
          )}

          {todo.length > 0 && (
            <section className="card p-5">
              {heading(ClipboardList, "bg-indigo-500/15 text-indigo-300", "Onboarding checklist", <span className="text-xs text-slate-400">{checkDone}/{todo.length} done</span>)}
              <div className="bar mb-3"><i style={{ width: `${(checkDone / todo.length) * 100}%` }} /></div>
              <ul className="space-y-1.5 text-sm text-slate-300">{todo.map((c) => (
                <li key={c.id}>
                  <form action={toggleChecklist.bind(null, c.id)}>
                    <button aria-pressed={c.done} className={`flex items-center gap-2 text-left transition hover:text-white ${c.done ? "text-slate-500 line-through" : ""}`}>
                      {c.done ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} className="text-slate-500" />}{c.label}
                    </button>
                  </form>
                </li>
              ))}</ul>
            </section>
          )}

          <section>
            {heading(Swords, "bg-pink-500/15 text-pink-300", "My races")}
            {mine.length === 0 && <EmptyState Icon={Swords} title="No rival yet" tone="pink">Pick a subject and meet the rival who trains it every day. <Link href="/" className="underline">Browse subjects</Link>.</EmptyState>}
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.slice(0, 6).map(raceCard)}
            </div>
            {stats.length > 6 && (
              <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-sky-300">Show the other {stats.length - 6} races</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">{stats.slice(6).map((x, i) => raceCard(x, i + 6))}</div></details>
            )}
          </section>
        </div>

        {/* side column: how you are doing */}
        <aside className="min-w-0 space-y-6">
          <section className="card p-5">
            {heading(Activity, "bg-indigo-500/15 text-indigo-300", "Your activity")}
            <div className="mb-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-black/[.03] p-2"><div className="text-xl font-extrabold">{weekXp}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">XP this week</div></div>
              <div className="rounded-xl bg-black/[.03] p-2"><div className="text-xl font-extrabold">{activeDays}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">active days</div></div>
            </div>
            <AreaChart data={last30} height={120} />
            <div className="mt-3"><div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Last 24 weeks</div><Heatmap days={activity} /></div>
          </section>

          <section className="card p-5">
            {heading(RadarIcon, "bg-violet-500/15 text-violet-300", "Skill map")}
            <div className="flex justify-center">
              {radarAxes.length >= 3 ? <Radar axes={radarAxes} color={PALETTE.violet} size={230} /> : (
                <EmptyState Icon={Rocket} title="Your skill map grows here">Enrol in three or more subjects and your level in each is plotted as a shape.</EmptyState>
              )}
            </div>
          </section>

          <section className="card p-5">
            {heading(Trophy, "bg-amber-500/15 text-amber-300", "Contests", <Link href="/competitions" className="text-xs text-sky-300 underline">See all</Link>)}
            {contests.length === 0 ? (
              <p className="text-sm text-slate-400">Race a bot, a friend or a group on any topic. <Link href="/start" className="underline">Start a journey</Link>.</p>
            ) : (
              <div className="space-y-3">{contests.slice(0, 3).map((x) => <CompetitionCard key={x.c.id} card={x} />)}</div>
            )}
          </section>

          <Link href="/seasons" className="card card-hover block p-5" aria-label="This week's season">
            {heading(Trophy, "bg-violet-500/15 text-violet-300", "This week", <span className="text-xs text-slate-400">ends in {timeLeft(week.end - now())}</span>)}
            {weekMe ? <div className="flex items-baseline gap-3"><span className="text-3xl font-extrabold">#{weekMe.rank}</span><span className="text-sm text-slate-400">of {weekRows.length} · {weekMe.points} pts</span></div> : <p className="text-sm text-slate-400">No points yet this week. Pass a level or finish a quest to get on the board.</p>}
          </Link>

          <section className="card p-5">
            {heading(Medal, "bg-yellow-500/15 text-yellow-500", "Level and badges", <span className="text-xs text-slate-400">{prog.earned}/{prog.badges.length} earned</span>)}
            <div className="mb-4"><PlayerLevelCard p={prog.player} compact /></div>
            <BadgeWall p={prog} max={8} />
          </section>
        </aside>
      </div>
    </div>
  );
}

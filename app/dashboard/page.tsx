import { eq } from "drizzle-orm";
import Link from "next/link";
import { brands, checklistItems, db, enrollments, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, TIERS, tierOf } from "@/lib/levels";
import { activityFor, badgesFor, trackStats } from "@/lib/stats";
import { AreaChart, EmptyState, Heatmap, PALETTE, Radar, StatTile } from "@/components/charts";
import { rivalFor } from "@/lib/rivals";
import { Avatar } from "@/components/Avatar";
import { listFor } from "@/lib/competitions";
import { CompetitionCard } from "@/components/CompetitionCard";
import { SubjectArt } from "@/components/SubjectArt";
import { Ring } from "@/components/Ring";
import { requirementsFor, scopesOf } from "@/lib/paths";
import { careerFor } from "@/lib/careers";
import { goalOf, roleLabel } from "@/lib/journey";
import { pendingFor } from "@/lib/freshness";
import { coverageFor, hasNoRolePath } from "@/lib/roles";
import { enroll, toggleChecklist } from "@/app/actions";
import { AlertTriangle, ArrowUpRight, BellRing, Compass, CheckCircle2, CircleDashed, TrendingUp as Climb, CheckSquare, ClipboardList, Flame, Lock, Plus, ShieldCheck, Square, Sparkles, Swords, Target, TrendingDown, TrendingUp, Trophy, Medal, Equal, Mountain, Activity, Radar as RadarIcon, Rocket } from "lucide-react";

export default async function Dashboard() {
  const user = await requireUser();
  const mine = db.select({ e: enrollments, t: tracks, b: brands }).from(enrollments)
    .innerJoin(tracks, eq(tracks.id, enrollments.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId))
    .where(eq(enrollments.userId, user.id)).all();
  const todo = db.select().from(checklistItems).where(eq(checklistItems.userId, user.id)).all();
  const stats = mine.map((m) => ({ ...m, s: trackStats(user.id, m.t, m.e.startedAt) }));
  const totalXp = stats.reduce((a, m) => a + m.s.xp, 0);
  const bestStreak = Math.max(0, ...stats.map((m) => m.s.streak));
  const contests = listFor(user, { mineOnly: true }).filter((x) => x.state === "live" || x.state === "upcoming" || x.invited).slice(0, 6);
  const questsDone = stats.reduce((a, m) => a + m.s.doneToday.size, 0), questsTotal = stats.length * 3;
  const levelsPassed = stats.reduce((a, m) => a + m.s.passed, 0);
  const checkDone = todo.filter((c) => c.done).length;
  const required = requirementsFor(user, scopesOf(user.id));
  const requiredOpen = required.filter((r) => !r.done), overdue = requiredOpen.filter((r) => r.overdue);
  const career = careerFor(user);
  const goal = goalOf(user.id);
  const unread = pendingFor(user.id);
  const noRolePath = user.audience === "staff" && hasNoRolePath(coverageFor(user.jobRole));
  const enrolledIds = new Set(mine.map((m) => m.t.id));
  const activity = activityFor(user.id, 24);
  const last30 = activity.slice(-30).map((d) => ({ label: d.day.slice(5), value: d.value }));
  const weekXp = activity.slice(-7).reduce((a, d) => a + d.value, 0);
  const activeDays = activity.filter((d) => d.value > 0).length;
  const radarAxes = [...stats].sort((a, b) => b.s.passed - a.s.passed).slice(0, 6).map((m) => ({ label: m.t.name.replace(/^\d+\.\s*/, "").replace(/:.*$/, ""), value: m.s.passed / MAX_LEVEL }));
  const badges = stats.length ? badgesFor(stats.sort((a, b) => b.s.xp - a.s.xp)[0].s) : [];

  const reqRow = (r: (typeof required)[number]) => (
    <li key={r.track.id}>
      <Link href={`/tracks/${r.track.slug}`} className="flex flex-wrap items-center gap-2 transition hover:text-white">
        {r.done ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Square size={16} className={r.overdue ? "text-rose-400" : "text-slate-500"} />}
        <span className={r.done ? "text-slate-500" : r.overdue ? "text-rose-300" : "text-slate-200"}>{r.track.name}</span>
        <span className="text-xs text-slate-500">
          {r.done ? "passed" : `level ${r.passed}/${r.track.requiredLevel} · due ${new Date(r.dueAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${r.overdue ? " · overdue" : ""}`}
          {" · "}{r.why === "mandatory" ? "mandatory" : "for your role"}
        </span>
      </Link>
    </li>
  );

  const raceCard = ({ e, t, b, s }: (typeof stats)[number], idx = 0) => {
    const rv = rivalFor(t.slug), tier = TIERS[tierOf(s.passed)];
    const lead = s.passed - s.rival.level;
    return (
      <Link key={e.id} href={`/tracks/${t.slug}`} className="card card-hover rise p-4" style={{ "--i": idx } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <Avatar kind="human" level={s.passed} size={56} />
          <span className="text-xs font-black text-slate-500">VS</span>
          <Avatar kind="rival" level={s.rival.level} hue={rv.hue} size={56} />
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
          <span>{s.passed === 0 ? "Not started" : `Level ${s.passed} · ${LEVELS[s.passed - 1]} · ${tier.name}`}</span>
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

  return (
    <div className="space-y-8">
      <div className="card pop relative flex flex-wrap items-center gap-6 overflow-hidden p-6" style={{ background: "linear-gradient(120deg,#4f46e51f,#ffffff 60%)" }}>
        <svg className="pointer-events-none absolute -right-8 -top-12 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke="#4f46e5" strokeOpacity=".12" /><circle cx="120" cy="80" r="60" fill="none" stroke="#9333ea" strokeOpacity=".18" strokeDasharray="4 6" className="march" /></svg>
        <Avatar kind="human" level={Math.max(0, ...stats.map((m) => m.s.passed))} size={96} className="bob" />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">Welcome back, {user.name}</h1>
          <p className="text-slate-400">Your quest log: finish today&apos;s quests to keep the streak and stay ahead of your rivals.</p>
        </div>
        {questsTotal > 0 && <Ring pct={questsDone / questsTotal} label={`${questsDone}/${questsTotal}`} sub="quests today" size={104} color={questsDone === questsTotal ? "#34d399" : "#38bdf8"} />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile i={0} Icon={Sparkles} label="Total XP" value={totalXp} color={PALETTE.sky} spark={activity.slice(-14).map((d) => d.value)} />
        <StatTile i={1} Icon={Flame} label="Day streak" value={bestStreak} color="#ea580c" spark={activity.slice(-14).map((d) => (d.value ? 1 : 0))} />
        <StatTile i={2} Icon={Mountain} label="Levels passed" value={levelsPassed} color={PALETTE.violet} />
        <StatTile i={3} Icon={Swords} label="Live contests" value={contests.filter((x) => x.state === "live").length} color={PALETTE.pink} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold"><Activity size={18} className="text-indigo-300" />XP, last 30 days</h2>
            <span className="text-xs text-slate-400"><b className="text-slate-200">{weekXp}</b> XP this week · <b className="text-slate-200">{activeDays}</b> active days of 168</span>
          </div>
          <AreaChart data={last30} />
          <div className="mt-3"><div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Last 24 weeks</div><Heatmap days={activity} /></div>
        </div>
        <div className="card flex flex-col items-center p-5">
          <h2 className="flex items-center gap-2 self-start font-bold"><RadarIcon size={18} className="text-violet-300" />Skill map</h2>
          {radarAxes.length >= 3 ? <Radar axes={radarAxes} color={PALETTE.violet} /> : (
            <div className="my-auto w-full py-4"><EmptyState Icon={Rocket} title="Your skill map grows here">Enrol in three or more subjects and your level in each is plotted as a shape.</EmptyState></div>
          )}
        </div>
      </section>

      {unread.length > 0 && (
        <Link href="/updates" className={`card flex items-center gap-3 p-4 transition hover:border-amber-300/60 ${unread.some((u) => u.overdue) ? "border-rose-400/40" : "border-amber-300/40"}`}>
          <BellRing size={20} className="text-amber-300" />
          <span className="flex-1 text-sm"><b>{unread.length} update{unread.length === 1 ? "" : "s"} to read:</b> {unread.slice(0, 2).map((u) => u.change.title).join(", ")}{unread.length > 2 && ` and ${unread.length - 2} more`}</span>
          <ArrowUpRight size={16} className="text-slate-400" />
        </Link>
      )}

      {noRolePath && (
        <section role="status" className="card flex items-start gap-3 border-amber-300/40 p-4 text-sm">
          <Compass size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <b>Nothing is set up for your role yet.</b> Your role is “{user.jobRole}”, and the academy has no learning or promotion path for it, so you only see company-wide courses. Ask your manager to check your role, or pick something to learn from <Link href="/start" className="underline">Start a journey</Link>.
          </div>
        </section>
      )}

      {required.length > 0 && (
        <section className={`card p-4 ${overdue.length ? "border-rose-400/40" : ""}`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className={overdue.length ? "text-rose-300" : "text-emerald-300"} />Required for you</h2>
            <span className="text-xs text-slate-400">{required.length - requiredOpen.length}/{required.length} passed</span>
          </div>
          <div className="bar mb-3"><i style={{ width: `${((required.length - requiredOpen.length) / required.length) * 100}%`, background: overdue.length ? "#fb7185" : undefined }} /></div>
          {overdue.length > 0 && <p role="alert" className="mb-2 flex items-center gap-1.5 text-sm text-rose-300"><AlertTriangle size={15} />{overdue.length} overdue. Please finish {overdue.length === 1 ? "it" : "these"} first.</p>}
          <ul className="space-y-1.5 text-sm">
            {required.slice(0, 6).map(reqRow)}
          </ul>
          {required.length > 6 && (
            <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs font-semibold text-sky-300">Show the other {required.length - 6}</summary>
              <ul className="mt-2 space-y-1.5">{required.slice(6).map(reqRow)}</ul></details>
          )}
        </section>
      )}

      {career && (
        <section className="card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Climb size={18} className="text-violet-300" />Your career</h2>
            <span className="flex items-center gap-3 text-xs text-slate-400">
              <span>{career.current.title}{career.next && <> <ArrowUpRight size={12} className="inline" /> {career.next.title}</>}</span>
              <Link href="/journey" className="text-sky-300 underline">{goal ? `Goal: ${goal.targetRole === career.role ? "" : roleLabel(goal.targetRole) + ", "}${new Date(goal.targetDate * 1000).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "Set a career goal"}</Link>
            </span>
          </div>
          {!career.next ? (
            <p className="text-sm text-slate-300">You are at the top of the {career.role} path: {career.current.title}. Keep sharpening, and help others climb.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>{career.total ? `${career.done}/${career.total} steps to ${career.next.title}` : `Steps to ${career.next.title} are still being written`}</span>
                {career.ready && <span className="font-semibold text-emerald-300">Ready for promotion review</span>}
              </div>
              {career.total > 0 && <div className="bar mb-3"><i style={{ width: `${(career.done / career.total) * 100}%`, background: career.ready ? "#34d399" : undefined }} /></div>}
              {career.hold === "overdue" && <p role="alert" className="mb-2 flex items-center gap-1.5 text-sm text-amber-300"><AlertTriangle size={15} />You have met every step, but required learning is overdue. Finish it to be considered.</p>}
              <ul className="space-y-1.5 text-sm">
                {career.next.steps.map((st) => (
                  <li key={st.reqId} className="flex flex-wrap items-center gap-2">
                    {st.met ? <CheckCircle2 size={16} className="text-emerald-400" /> : st.countable ? <Square size={16} className="text-slate-500" /> : <CircleDashed size={16} className="text-slate-600" />}
                    <span className={st.met ? "text-slate-500" : st.countable ? "text-slate-200" : "text-slate-500"}>{st.track.name}</span>
                    <span className="text-xs text-slate-500">{st.countable ? `level ${Math.min(st.passed, st.need)}/${st.need}` : "coming soon"}</span>
                    {st.countable && !st.met && (enrolledIds.has(st.track.id)
                      ? <Link href={`/tracks/${st.track.slug}`} className="text-xs text-sky-300 underline">Continue</Link>
                      : <form action={enroll}><input type="hidden" name="trackId" value={st.track.id} /><input type="hidden" name="goal" value={`Towards ${career.next!.title}`} /><button className="text-xs text-sky-300 underline">Start</button></form>)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {todo.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><ClipboardList size={18} className="text-indigo-300" />Onboarding checklist</h2>
            <span className="text-xs text-slate-400">{checkDone}/{todo.length} done</span>
          </div>
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
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Swords size={20} className="text-pink-300" />My races</h2>
        {mine.length === 0 && <EmptyState Icon={Swords} title="No rival yet" tone="pink">Pick a subject and meet the rival who trains it every day. <Link href="/" className="underline">Browse subjects</Link>.</EmptyState>}
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.slice(0, 6).map(raceCard)}
        </div>
        {stats.length > 6 && (
          <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-sky-300">Show the other {stats.length - 6} races</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">{stats.slice(6).map((x, i) => raceCard(x, i + 6))}</div></details>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy size={20} className="text-amber-300" />Contests</h2>
          <Link href="/start" className="btn !py-1 text-sm"><Plus size={15} />Start a journey</Link>
        </div>
        {contests.length === 0 ? (
          <p className="text-slate-400">Race a bot, a friend or a group on any topic. <Link href="/competitions" className="underline">See what is running</Link>.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{contests.map((x) => <CompetitionCard key={x.c.id} card={x} />)}</div>
        )}
      </section>

      {badges.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Medal size={20} className="text-yellow-300" />Badges <span className="text-xs font-normal text-slate-400">{badges.filter((x) => x.earned).length}/{badges.length} earned</span></h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((x, i) => (
              <div key={x.key} title={x.desc} style={{ "--i": i } as React.CSSProperties} className={`card rise relative w-28 p-3 text-center ${x.earned ? "pop border-yellow-400/40" : "opacity-40 grayscale"}`}>
                {!x.earned && <Lock size={12} className="absolute right-2 top-2 text-slate-400" />}
                <div className="text-3xl">{x.icon}</div><div className="text-xs font-semibold">{x.name}</div><div className="text-[10px] text-slate-400">{x.desc}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

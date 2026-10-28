import { EmptyState, PageHero, PALETTE, Radar } from "@/components/charts";
import { Ring } from "@/components/Ring";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, enrollments } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOMAIN_KEYS, domainLabel, mixFor } from "@/lib/blueprint";
import { ladderFor } from "@/lib/careers";
import { dateBounds, journeyFor, levelCode, roleLabel, targetsFor, type Leg } from "@/lib/journey";
import { clearCareerGoal, enroll, setCareerGoal, startRoleExam } from "@/app/actions";
import { standingFor, type CareerStanding } from "@/lib/careerStanding";
import { assessmentFor } from "@/lib/route";
import { roleRouteSlug, roleTarget } from "@/lib/routeRole";
import { ROLE_EXAM_MIN, ROLE_EXAM_SIZE, latestFinishedRoleExam, openRoleExam, roleExamPlan } from "@/lib/roleExam";
import { ROLE_CHECK_VALID_DAYS, roleExamsAvailable } from "@/lib/roleCheck";
import { careerFor } from "@/lib/careers";
import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, CircleDashed, Flag, Gauge, MapPin, Mountain, Repeat, Rocket, Square, Target, Users } from "lucide-react";
import { JourneyMap, type MapNode } from "@/components/JourneyMap";
import { SubjectArt } from "@/components/SubjectArt";

export const metadata = { title: "My career journey — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const perWeek = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

/** How the questions for this level of this role are spread over the seven domains (content/blueprints). */
function QuestionMix({ leg }: { leg: Leg }) {
  const mix = mixFor(leg.role, leg.level, ladderFor(leg.role).length);
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Target size={17} /></span>What you will be asked</h2>
      <p className="mb-3 text-xs text-slate-400">For {leg.title}, out of every 100 exam questions. A different role, or a higher level, shifts the mix.</p>
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
      <ul className="space-y-1.5">
        {DOMAIN_KEYS.filter((d) => mix[d] > 0).sort((a, b) => mix[b] - mix[a]).map((d) => (
          <li key={d} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 text-slate-300">{domainLabel(d)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded bg-white/10"><span className="block h-full bg-violet-400" style={{ width: `${mix[d]}%` }} /></span>
            <span className="w-8 text-right tabular-nums text-slate-400">{mix[d]}</span>
          </li>
        ))}
      </ul>
      <div className="mx-auto"><Radar size={230} color={PALETTE.violet} axes={DOMAIN_KEYS.filter((d) => mix[d] > 0).map((d) => ({ label: domainLabel(d), value: mix[d] / Math.max(1, ...DOMAIN_KEYS.map((k) => mix[k])) }))} /></div>
      </div>
    </section>
  );
}


/** The title next to what exams prove, and the way into a level check for the goal. The title is a manager's decision and always stands; the exams are evidence beside it. */
function Standing({ st, goalTitle, slug, state }: { st: CareerStanding; goalTitle: string; slug: string | null; state: "none" | "in_progress" | "complete" }) {
  const title = st.titles.get(st.level) ?? `Level ${st.level}`;
  const proven = st.verified === null ? null : st.titles.get(st.verified) ?? `Level ${st.verified}`;
  const apart = `${st.rungsApart} level${st.rungsApart === 1 ? "" : "s"}`;
  const note = {
    agree: "Your exam results back up your title.",
    "title-ahead": `Exams prove ${apart} less than your title. Passing the tests on the way verifies it.`,
    "verified-ahead": `Your exams show ${apart} more than your title. That is a good case to put to your manager.`,
    unverified: "No exam results on this ladder yet, so nothing is verified.",
  }[st.agreement];
  return (
    <section className="card space-y-3 p-5" aria-label="Where you stand">
      <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><MapPin size={17} /></span>Where you stand</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Your title</div>
          <div className="font-bold">{title}</div>
          <div className="text-xs text-slate-400">{st.basis === "authority" ? "Set by your manager" : "Starting level, no promotion yet"}</div>
        </div>
        <div className="rounded-2xl border border-black/10 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Proven by exams</div>
          <div className="font-bold">{proven ?? "Nothing yet"}</div>
          <div className="text-xs text-slate-400">Real exam passes only, not placement</div>
        </div>
      </div>
      <p className="text-sm text-slate-300">{note}</p>
      {slug && (
        <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
          <p className="min-w-0 flex-1 text-sm text-slate-400">{state === "complete" ? <>You have checked where you stand for <b>{goalTitle}</b>.</> : <>A short check in each area on the way to <b>{goalTitle}</b> shows what is left to learn, then we plan it around your time.</>}</p>
          {state === "complete" && <Link href={`/route/${slug}/plan`} className="btn btn-ghost">My plan</Link>}
          <Link href={`/route/${slug}`} className="btn">{state === "none" ? "Check where I stand" : state === "in_progress" ? "Carry on the check" : "See results"}<ArrowRight size={15} /></Link>
        </div>
      )}
    </section>
  );
}

/** The role check: one exam across the tracks of the person's ladder in the proportions of their role's question mix. */
function RoleCheck({ user, unavailable }: { user: Awaited<ReturnType<typeof requireUser>>; unavailable: boolean }) {
  if (!roleExamsAvailable()) return null; // the role check tables are not in this database yet (npm run db:push)
  const plan = roleExamPlan(user);
  if (!plan) return null;
  const last = latestFinishedRoleExam(user.id);
  const open = openRoleExam(user.id, plan);
  const gate = careerFor(user)?.check;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Target size={17} /></span>Role check</h2>
      <p className="text-sm text-slate-300">One exam across everything your path to <b>{plan.title}</b> covers, weighted like your role (questions out of {ROLE_EXAM_SIZE}): {DOMAIN_KEYS.filter((d) => plan.planned[d] > 0).sort((a, b) => plan.planned[b] - plan.planned[a]).map((d) => `${domainLabel(d)} ${plan.planned[d]}`).join(", ")}. It shows where you are strong and where to focus, and does not change your track results.</p>
      {gate?.needed && <p className="text-sm">{gate.validUntil ? <span className="text-emerald-300">Promotion asks for a passing role check from the last {ROLE_CHECK_VALID_DAYS} days. Yours counts until {date(gate.validUntil)}.</span> : <span className="text-amber-300">Promotion asks for a passing role check from the last {ROLE_CHECK_VALID_DAYS} days. You do not have one yet.</span>}</p>}
      {unavailable && <p role="alert" className="text-sm text-amber-300">There are not enough questions in your path yet to make a fair check (at least {ROLE_EXAM_MIN} needed).</p>}
      {last && (
        <div className="flex items-center gap-4 rounded-2xl border border-black/5 p-3">
          <Ring pct={last.score ?? 0} label={`${Math.round((last.score ?? 0) * 100)}%`} size={64} color={(last.score ?? 0) >= 0.8 ? "#10b981" : "#f59e0b"} />
          <p className="text-sm text-slate-400">Your last check was on {date(last.finishedAt!)}. <Link href={`/role-exam/${last.id}`} className="underline">See the breakdown</Link></p>
        </div>
      )}
      <form action={startRoleExam}><button className="btn">{open ? "Continue your role check" : last ? "Take it again" : "Start the role check"}<ArrowRight size={15} /></button></form>
    </section>
  );
}

export default async function Journey({ searchParams }: { searchParams: Promise<{ roleExam?: string }> }) {
  const user = await requireUser();
  const j = journeyFor(user);
  const unavailable = (await searchParams).roleExam === "unavailable";
  const mine = new Set(db.select({ t: enrollments.trackId }).from(enrollments).where(eq(enrollments.userId, user.id)).all().map((e) => e.t));

  if (j.state === "no-ladder") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHero Icon={Mountain} tone="violet" title="My career journey" sub="Where you are, where you are heading, and what stands in between." />
        <EmptyState Icon={Mountain} tone="violet" title="No path to climb yet">
          There is no career path for {user.audience === "customer" ? "customer accounts" : <>the role <b>{user.jobRole}</b></>} yet.
          {user.audience === "staff" && " Ask an admin to add one at Careers, or to check that your job role matches a ladder."}
        </EmptyState>
      </div>
    );
  }
  if (j.state === "unreachable") {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Mountain className="text-violet-300" />My career journey</h1>
        <p role="alert" className="card flex items-start gap-2 p-4 text-amber-300"><AlertTriangle size={18} className="mt-0.5 shrink-0" />
          The route to {roleLabel(j.goal.targetRole)} (level {j.goal.targetLevel}) no longer exists from where you are. Ask an admin about the career bridges, or pick another goal.</p>
        <form action={clearCareerGoal}><button className="btn btn-ghost">Remove this goal</button></form>
      </div>
    );
  }

  const targets = targetsFor(user);
  const { tomorrow, nextYear } = dateBounds();
  const { goal, here, legs, pace, next } = j;
  const reached = !!goal && legs.length === 0;
  const st = standingFor(user);
  const slug = goal && !reached && roleTarget(roleRouteSlug(goal.targetRole, goal.targetLevel)) ? roleRouteSlug(goal.targetRole, goal.targetLevel) : null;
  const asmt = slug ? assessmentFor(user.id, slug) : null;

  const goalForm = (replace: boolean) => (
    <form action={setCareerGoal} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="grid gap-1">
        <span className="text-xs text-slate-400">I want to become</span>
        <select name="target" required defaultValue={goal ? `${goal.targetRole}|${goal.targetLevel}` : undefined} className={`${input} min-w-64`}>
          {!goal && <option value="">Choose a role and level…</option>}
          {targets.map((t) => (
            <optgroup key={t.role} label={t.role === here.role ? `${t.label} (your path)` : t.label}>
              {t.levels.map((l) => <option key={l.level} value={`${t.role}|${l.level}`}>{l.title} ({levelCode(l.level)})</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-slate-400">by</span>
        <input type="date" name="date" required min={tomorrow} defaultValue={goal ? iso(goal.targetDate) : nextYear} className={input} />
      </label>
      <button className="btn">{replace ? "Update goal" : "Plan my journey"}<ArrowRight size={15} /></button>
    </form>
  );

  const STATUS = {
    "on-track": { label: "On track", cls: "bg-emerald-500/15 text-emerald-300" },
    "learning-done": { label: "Learning done", cls: "bg-emerald-500/15 text-emerald-300" },
    behind: { label: "Behind", cls: "bg-amber-500/15 text-amber-300" },
    "not-started": { label: "Not started yet", cls: "bg-sky-500/15 text-sky-300" },
    "past-date": { label: "Date passed", cls: "bg-rose-500/15 text-rose-300" },
    "no-date": { label: "No date set", cls: "bg-black/5 text-slate-300" },
  } as const;
  const status = pace ? STATUS[pace.status] : null;
  const firstOpen = legs.findIndex((l) => !(l.done && l.counted > 0));
  const nodes: MapNode[] = [
    { title: here.title, sub: here.code, state: "here" },
    ...legs.map((l, i): MapNode => ({
      title: l.title, goal: i === legs.length - 1,
      sub: l.done && l.counted > 0 ? "Complete" : l.counted ? `${l.met}/${l.counted} steps` : "Manager's call",
      state: l.done && l.counted > 0 ? "done" : i === firstOpen ? "next" : "later",
    })),
  ];
  // where the pace puts you against the goal date, as a share of the time left (above 100% means after the date)
  const projectedShare = pace && pace.projectedAt && goal && pace.daysLeft > 0 ? (pace.daysLeft + (pace.projectedAt - goal.targetDate) / 86400) / pace.daysLeft : null;
  const maxRate = pace ? Math.max(pace.perWeekNeeded, pace.perWeekNow, 0.1) : 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* hero: from where to where, and how it is going */}
      <header className="card pop relative overflow-hidden p-6" style={{ background: "linear-gradient(125deg, rgba(139,92,246,.2), rgba(236,72,153,.1) 55%, #fff 85%)" }}>
        <svg className="pointer-events-none absolute -right-8 -top-12 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke="#8b5cf6" strokeOpacity=".18" /><circle cx="120" cy="80" r="58" fill="none" stroke="#ec4899" strokeOpacity=".25" strokeDasharray="4 6" className="march" /></svg>
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[#fff] shadow-lg" style={{ background: "linear-gradient(135deg,#8b5cf6,#8b5cf6aa)" }}><Mountain size={28} /></span>
          <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
            <h1 className="text-2xl font-extrabold sm:text-3xl">My career journey</h1>
            <p className="max-w-xl text-sm text-slate-400">Say where you want to get to and by when. We map the route, set the challenges in order and tell you honestly whether the date is realistic.</p>
          </div>
          {goal && !reached && pace && <Ring pct={j.counted ? j.met / j.counted : 0} label={`${j.met}/${j.counted}`} sub="steps" size={96} color={pace.status === "behind" || pace.status === "past-date" ? "#f59e0b" : "#10b981"} />}
        </div>
        <div className="relative mt-5 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-2xl border border-sky-400/30 bg-[#fff]/80 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-300"><MapPin size={12} />You are here</div>
            <div className="mt-0.5 font-bold">{here.title}</div>
            <div className="text-xs text-slate-400">{roleLabel(here.role)} · {here.code}{here.sub !== null && <span title="Computed from how many of the next level's steps you have met: .0 new, .1 established, .2 pushing for the next level"> · {["new to the level", "established", "pushing for the next level"][here.sub]}</span>}</div>
          </div>
          <div className="hidden place-items-center text-slate-400 sm:grid" aria-hidden><ArrowRight size={22} /></div>
          <div className="rounded-2xl border border-pink-400/30 bg-[#fff]/80 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-pink-300"><Flag size={12} />{goal ? "Your goal" : "Top of your path"}</div>
            <div className="mt-0.5 font-bold">{goal ? j.target.title : legs.length ? legs[legs.length - 1].title : here.title}</div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
              {goal ? <>{roleLabel(j.target.role)} · {levelCode(j.target.level)}<span className="inline-flex items-center gap-1"><CalendarClock size={12} />by {date(goal.targetDate)}</span></> : "Set a goal below to plan the route"}
              {status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${status.cls}`}>{status.label}</span>}
            </div>
          </div>
        </div>
      </header>

      {st && <Standing st={st} goalTitle={j.target.title} slug={slug} state={!asmt ? "none" : asmt.status} />}

      {legs.length > 0 && (
        <section className="card p-5" aria-label="Route at a glance">
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Mountain size={17} /></span>Your route <span className="text-xs font-normal text-slate-400">{legs.length} step{legs.length === 1 ? "" : "s"} to go</span></h2>
          <JourneyMap nodes={nodes} goalLabel={goal ? "Goal" : "Top"} />
        </section>
      )}

      {goal && !reached && pace && (
        <section className="card space-y-4 p-5">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Gauge size={17} /></span>Is the date realistic?</h2>
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400"><span>Today</span><span>Goal date · {date(goal.targetDate)}</span></div>
            <div className="relative h-4 rounded-full bg-black/[.06]">
              <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${projectedShare === null ? 0 : Math.min(100, projectedShare * 100)}%`, background: pace.status === "behind" ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#10b981,#34d399)" }} />
              {projectedShare !== null && projectedShare > 1 && <i className="absolute inset-y-0 right-0 w-[8%] rounded-r-full bg-rose-400/60" title="After the goal date" />}
              <span className="absolute -top-1 bottom-[-4px] w-1 rounded bg-pink-500" style={{ left: "calc(100% - 4px)" }} title="Goal date" />
            </div>
            <div className="mt-1 text-xs text-slate-400">{pace.projectedAt ? <>At your current pace the learning is done around <b className="text-slate-300">{date(pace.projectedAt)}</b>{projectedShare !== null && (projectedShare > 1 ? ", after your date." : ", before your date.")}</> : "You have not passed a level in the last four weeks, so there is no projection yet."} {pace.daysLeft > 0 ? `${pace.daysLeft} days left.` : "The date has passed."}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ l: "You need", v: pace.perWeekNeeded, c: "#6366f1" }, { l: "You are passing", v: pace.perWeekNow, c: pace.perWeekNow >= pace.perWeekNeeded ? "#10b981" : "#f59e0b" }].map(({ l, v, c }) => (
              <div key={l} className="rounded-xl border border-black/5 p-3">
                <div className="flex items-baseline justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{l}</span><span className="text-xl font-extrabold">{perWeek(v)}<span className="ml-1 text-xs font-medium text-slate-400">levels / week</span></span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${(v / maxRate) * 100}%`, background: c }} /></div>
              </div>
            ))}
          </div>
          <p role={pace.status === "behind" || pace.status === "past-date" ? "alert" : undefined}
            className={`flex items-start gap-2 rounded-xl p-3 text-sm ${pace.status === "on-track" || pace.status === "learning-done" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
            {pace.status === "on-track" || pace.status === "learning-done" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span>
              {pace.status === "learning-done" && "All the learning on this route is done. What is left is your manager's promotion decisions."}
              {pace.status === "on-track" && `On track. You need about ${perWeek(pace.perWeekNeeded)} level${perWeek(pace.perWeekNeeded) === 1 ? "" : "s"} a week and you are passing ${perWeek(pace.perWeekNow)}. ${pace.work} level${pace.work === 1 ? "" : "s"} still to pass.`}
              {pace.status === "behind" && `Behind. You need about ${perWeek(pace.perWeekNeeded)} levels a week and you are passing ${perWeek(pace.perWeekNow)}. Pick up the pace or move the date.`}
              {pace.status === "not-started" && `You need about ${perWeek(pace.perWeekNeeded)} level${perWeek(pace.perWeekNeeded) === 1 ? "" : "s"} a week. You have not passed a level in the last four weeks, so start with the first challenge below.`}
              {pace.status === "past-date" && "Your date has passed. Move it to a date you can keep."}
            </span>
          </p>
          {j.soon > 0 && <p className="text-xs text-slate-500">{j.soon} step{j.soon === 1 ? " is" : "s are"} still being written and not counted above. Promotion is always a manager&apos;s decision; this plan covers the learning.</p>}
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-sky-300">Change or remove this goal</summary>
            <div className="mt-3 space-y-3">{goalForm(true)}<form action={clearCareerGoal}><button className="text-xs text-slate-400 underline">Remove goal</button></form></div>
          </details>
        </section>
      )}

      {reached && (
        <section className="card flex items-center gap-3 border-emerald-400/40 p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={22} /></span>
          <div className="flex-1"><b className="text-emerald-300">You are there.</b> <span className="text-sm text-slate-300">Set a new goal to keep climbing.</span></div>
          <details className="text-sm"><summary className="cursor-pointer text-xs text-sky-300">New goal</summary><div className="mt-3">{goalForm(true)}</div></details>
        </section>
      )}

      {!goal && (
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Target size={17} /></span>Set your goal</h2>
          {targets.length ? goalForm(false) : <p className="text-sm text-slate-400">You are already at the top of the path for your role, and no other path leads on from here yet.</p>}
          <p className="text-xs text-slate-500">Examples: from Junior Developer to CTO in 5 years, from Social Media Assistant to Head of Social in 3. Only places you can actually reach from your role are listed.</p>
        </section>
      )}

      <RoleCheck user={user} unavailable={unavailable} />

      {next && (
        <section className="card relative overflow-hidden p-5" style={{ background: "linear-gradient(135deg, rgba(139,92,246,.1), #fff 60%)" }}>
          <h2 className="mb-1 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Rocket size={17} /></span>Your next challenges</h2>
          <p className="mb-3 text-xs text-slate-400">For {next.leg.title}{next.leg.dueAt ? `, ideally by ${date(next.leg.dueAt)}` : ""}.</p>
          <ul className="grid gap-2 sm:grid-cols-2">{next.steps.slice(0, 4).map((s) => <StepCard key={s.reqId} s={s} leg={next.leg} enrolled={mine.has(s.track.id)} />)}</ul>
        </section>
      )}

      {next && <QuestionMix leg={next.leg} />}

      {legs.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><Flag size={17} /></span>Step by step <span className="text-xs font-normal text-slate-400">from {here.title}</span></h2>
          <ol className="relative space-y-3 pl-10 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-0.5 before:bg-gradient-to-b before:from-violet-300 before:to-pink-300">
            {legs.map((l, i) => (
              <li key={`${l.role}|${l.level}`} className={`card relative p-4 ${l.done && l.counted > 0 ? "border-emerald-400/40" : i === firstOpen ? "border-violet-400/50 shadow-[0_0_28px_-10px_rgba(139,92,246,.8)]" : ""}`}>
                <span className={`absolute -left-10 top-4 grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-extrabold ${l.done && l.counted > 0 ? "border-emerald-400 bg-emerald-500 text-[#fff]" : "border-violet-300 bg-[#fff] text-violet-300"}`}>{l.done && l.counted > 0 ? <CheckCircle2 size={16} /> : i + 1}</span>
                {l.crossing && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-pink-300"><Repeat size={13} />A new path begins: you move from {roleLabel(legs[i - 1]?.role ?? here.role)} to {roleLabel(l.role)}. This is a change of role, agreed with your manager.</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold">{l.title} <span className="text-xs font-normal text-slate-400">{roleLabel(l.role)} · {l.code}</span></div>
                  <span className="text-xs text-slate-400">{l.counted ? `${l.met}/${l.counted} steps` : "judged by your manager"}{l.dueAt && !l.done ? ` · learn by ${date(l.dueAt)}` : ""}</span>
                </div>
                {l.counted > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${(l.met / l.counted) * 100}%`, background: l.done ? "#10b981" : "#8b5cf6" }} /></div>}
                <p className="mt-2 text-sm text-slate-400">{l.summary}</p>
                {l.steps.length > 0 && (
                  <ul className="mt-3 space-y-1.5">{l.steps.map((s) => <StepRow key={s.reqId} s={s} leg={l} enrolled={mine.has(s.track.id)} />)}</ul>
                )}
                {(l.knowledge || l.delivery || l.leadership) && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs text-sky-300">What this level looks like</summary>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                      {([["Knowledge", l.knowledge, BookOpen, "text-sky-300 bg-sky-500/12"], ["Delivery", l.delivery, Rocket, "text-emerald-300 bg-emerald-500/12"], ["Communication & leadership", l.leadership, Users, "text-pink-300 bg-pink-500/12"]] as const).map(([k, v, Icon, tone]) => (
                        <div key={k} className="rounded-xl border border-black/5 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><span className={`grid h-6 w-6 place-items-center rounded-lg ${tone}`}><Icon size={13} /></span>{k}</dt><dd className="mt-1.5 text-slate-300">{v}</dd></div>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function StepCard({ s, leg, enrolled }: { s: Leg["steps"][number]; leg: Leg; enrolled: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[#fff] p-3">
      <SubjectArt slug={s.track.slug} name={s.track.name} kind={s.track.kind} size={40} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-semibold ${s.met ? "text-slate-500" : ""}`}>{s.track.name}</div>
        <div className="mt-1 flex items-center gap-2">
          {s.countable ? <><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10" aria-hidden><i className="block h-full rounded-full" style={{ width: `${(Math.min(s.passed, s.need) / s.need) * 100}%`, background: s.met ? "#10b981" : "#8b5cf6" }} /></span><span className="text-[11px] text-slate-400">L{Math.min(s.passed, s.need)}/{s.need}</span></> : <span className="text-[11px] text-slate-500">Coming soon</span>}
        </div>
      </div>
      {s.met ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400" /> : s.open && (enrolled
        ? <Link href={`/tracks/${s.track.slug}`} className="btn !px-3 !py-1 text-xs">Continue</Link>
        : <form action={enroll}><input type="hidden" name="trackId" value={s.track.id} /><input type="hidden" name="goal" value={`Towards ${leg.title}`} /><button className="btn !px-3 !py-1 text-xs">Start</button></form>)}
    </li>
  );
}

function StepRow({ s, leg, enrolled }: { s: Leg["steps"][number]; leg: Leg; enrolled: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      {s.met ? <CheckCircle2 size={16} className="text-emerald-400" /> : s.countable ? <Square size={16} className="text-slate-500" /> : <CircleDashed size={16} className="text-slate-600" />}
      <SubjectArt slug={s.track.slug} name={s.track.name} kind={s.track.kind} size={22} />
      <span className={s.met ? "text-slate-500" : s.countable ? "text-slate-200" : "text-slate-500"}>{s.track.name}</span>
      {s.countable && <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10" aria-hidden><i className="block h-full rounded-full bg-violet-400" style={{ width: `${(Math.min(s.passed, s.need) / s.need) * 100}%` }} /></span>}
      <span className="text-xs text-slate-500">{s.countable ? `level ${Math.min(s.passed, s.need)}/${s.need}` : "coming soon"}</span>
      {s.open && (enrolled
        ? <Link href={`/tracks/${s.track.slug}`} className="text-xs text-sky-300 underline">Continue</Link>
        : <form action={enroll}><input type="hidden" name="trackId" value={s.track.id} /><input type="hidden" name="goal" value={`Towards ${leg.title}`} /><button className="text-xs text-sky-300 underline">Start</button></form>)}
    </li>
  );
}

import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, enrollments } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOMAIN_KEYS, domainLabel, mixFor } from "@/lib/blueprint";
import { ladderFor } from "@/lib/careers";
import { dateBounds, journeyFor, levelCode, roleLabel, targetsFor, type Leg } from "@/lib/journey";
import { clearCareerGoal, enroll, setCareerGoal } from "@/app/actions";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleDashed, Flag, MapPin, Mountain, Repeat, Square, Target } from "lucide-react";

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
      <h2 className="mb-1 font-semibold">What you will be asked</h2>
      <p className="mb-3 text-xs text-slate-400">For {leg.title}, out of every 100 exam questions. A different role, or a higher level, shifts the mix.</p>
      <ul className="space-y-1.5">
        {DOMAIN_KEYS.filter((d) => mix[d] > 0).sort((a, b) => mix[b] - mix[a]).map((d) => (
          <li key={d} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 text-slate-300">{domainLabel(d)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded bg-white/10"><span className="block h-full bg-violet-400" style={{ width: `${mix[d]}%` }} /></span>
            <span className="w-8 text-right tabular-nums text-slate-400">{mix[d]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Journey() {
  const user = await requireUser();
  const j = journeyFor(user);
  const mine = new Set(db.select({ t: enrollments.trackId }).from(enrollments).where(eq(enrollments.userId, user.id)).all().map((e) => e.t));

  if (j.state === "no-ladder") {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Mountain className="text-violet-300" />My career journey</h1>
        <p className="card p-4 text-slate-300">
          There is no career path for {user.audience === "customer" ? "customer accounts" : <>the role <b>{user.jobRole}</b></>} yet.
          {user.audience === "staff" && " Ask an admin to add one at Careers, or to check that your job role matches a ladder."}
        </p>
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Mountain className="shrink-0 text-violet-300" />My career <span className="gradient-text">journey</span></h1>
        <p className="mt-1 text-slate-300">Say where you want to get to and by when. We map the route from your current role, set the challenges in order and tell you honestly whether the date is realistic.</p>
      </div>

      <section className="card flex flex-wrap items-center gap-3 p-4">
        <MapPin size={20} className="shrink-0 text-sky-300" />
        <div className="flex-1">
          <div className="text-xs text-slate-400">You are here</div>
          <div className="font-semibold">{here.title} <span className="text-xs font-normal text-slate-400">{roleLabel(here.role)} · {here.code}</span></div>
        </div>
        {here.sub !== null && <span className="text-xs text-slate-400" title="Computed from how many of the next level's steps you have met: .0 new, .1 established, .2 pushing for the next level">{here.code} = {["new to the level", "established", "pushing for the next level"][here.sub]}</span>}
      </section>

      {!goal ? (
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Target size={18} className="text-pink-300" />Set your goal</h2>
          {targets.length ? goalForm(false) : <p className="text-sm text-slate-400">You are already at the top of the path for your role, and no other path leads on from here yet.</p>}
          <p className="text-xs text-slate-500">Examples: from Junior Developer to CTO in 5 years, from Social Media Assistant to Head of Social in 3. Only places you can actually reach from your role are listed.</p>
        </section>
      ) : (
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Flag size={18} className="text-pink-300" />Goal: {j.target.title} <span className="text-xs font-normal text-slate-400">{roleLabel(j.target.role)} · {levelCode(j.target.level)}</span></h2>
            <span className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock size={14} />by {date(goal.targetDate)}</span>
          </div>
          {reached ? (
            <p className="flex items-center gap-2 text-emerald-300"><CheckCircle2 size={18} />You are there. Set a new goal below.</p>
          ) : pace && (
            <>
              <div className="bar"><i style={{ width: `${j.counted ? (j.met / j.counted) * 100 : 0}%` }} /></div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                <span>{j.met}/{j.counted} steps passed on the way</span>
                <span>{pace.work} level{pace.work === 1 ? "" : "s"} still to pass · {pace.daysLeft > 0 ? `${pace.daysLeft} days left` : "date has passed"}</span>
              </div>
              <p role={pace.status === "behind" || pace.status === "past-date" ? "alert" : undefined}
                className={`text-sm ${pace.status === "on-track" || pace.status === "learning-done" ? "text-emerald-300" : "text-amber-300"}`}>
                {pace.status === "learning-done" && "All the learning on this route is done. What is left is your manager's promotion decisions."}
                {pace.status === "on-track" && `On track. You need about ${perWeek(pace.perWeekNeeded)} level${perWeek(pace.perWeekNeeded) === 1 ? "" : "s"} a week and you are passing ${perWeek(pace.perWeekNow)}. At this pace the learning is done around ${date(pace.projectedAt!)}.`}
                {pace.status === "behind" && `Behind. You need about ${perWeek(pace.perWeekNeeded)} levels a week and you are passing ${perWeek(pace.perWeekNow)}. At this pace the learning is done around ${date(pace.projectedAt!)}, after your date. Pick up the pace or move the date.`}
                {pace.status === "not-started" && `You need about ${perWeek(pace.perWeekNeeded)} level${perWeek(pace.perWeekNeeded) === 1 ? "" : "s"} a week. You have not passed a level in the last four weeks, so start with the first challenge below.`}
                {pace.status === "past-date" && "Your date has passed. Move it to a date you can keep."}
              </p>
              {j.soon > 0 && <p className="text-xs text-slate-500">{j.soon} step{j.soon === 1 ? " is" : "s are"} still being written and not counted above. Promotion is always a manager&apos;s decision; this plan covers the learning.</p>}
            </>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-sky-300">Change or remove this goal</summary>
            <div className="mt-3 space-y-3">{goalForm(true)}<form action={clearCareerGoal}><button className="text-xs text-slate-400 underline">Remove goal</button></form></div>
          </details>
        </section>
      )}

      {next && (
        <section className="card border-violet-400/40 p-5">
          <h2 className="mb-1 font-semibold">Your next challenges</h2>
          <p className="mb-3 text-xs text-slate-400">For {next.leg.title}{next.leg.dueAt ? `, ideally by ${date(next.leg.dueAt)}` : ""}.</p>
          <ul className="space-y-2">{next.steps.slice(0, 4).map((s) => <StepRow key={s.reqId} s={s} leg={next.leg} enrolled={mine.has(s.track.id)} />)}</ul>
        </section>
      )}

      {next && <QuestionMix leg={next.leg} />}

      {legs.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">The route <span className="text-xs font-normal text-slate-500">{legs.length} step{legs.length === 1 ? "" : "s"} from {here.title}</span></h2>
          <ol className="space-y-3">
            {legs.map((l, i) => (
              <li key={`${l.role}|${l.level}`} className={`card p-4 ${l.done && l.counted > 0 ? "border-emerald-400/40" : ""}`}>
                {l.crossing && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-pink-300"><Repeat size={13} />A new path begins: you move from {roleLabel(legs[i - 1]?.role ?? here.role)} to {roleLabel(l.role)}. This is a change of role, agreed with your manager.</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{l.title} <span className="text-xs font-normal text-slate-400">{roleLabel(l.role)} · {l.code}</span></div>
                  <span className="text-xs text-slate-400">{l.counted ? `${l.met}/${l.counted} steps` : "judged by your manager"}{l.dueAt && !l.done ? ` · learn by ${date(l.dueAt)}` : ""}</span>
                </div>
                <p className="text-sm text-slate-400">{l.summary}</p>
                {l.steps.length > 0 && (
                  <ul className="mt-2 space-y-1.5">{l.steps.map((s) => <StepRow key={s.reqId} s={s} leg={l} enrolled={mine.has(s.track.id)} />)}</ul>
                )}
                {(l.knowledge || l.delivery || l.leadership) && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs text-sky-300">What this level looks like</summary>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                      {([["Knowledge", l.knowledge], ["Delivery", l.delivery], ["Communication & leadership", l.leadership]] as const).map(([k, v]) => (
                        <div key={k} className="card-soft p-3"><dt className="text-xs font-semibold text-slate-400">{k}</dt><dd className="mt-1 text-slate-300">{v}</dd></div>
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

function StepRow({ s, leg, enrolled }: { s: Leg["steps"][number]; leg: Leg; enrolled: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      {s.met ? <CheckCircle2 size={16} className="text-emerald-400" /> : s.countable ? <Square size={16} className="text-slate-500" /> : <CircleDashed size={16} className="text-slate-600" />}
      <span className={s.met ? "text-slate-500" : s.countable ? "text-slate-200" : "text-slate-500"}>{s.track.name}</span>
      <span className="text-xs text-slate-500">{s.countable ? `level ${Math.min(s.passed, s.need)}/${s.need}` : "coming soon"}</span>
      {s.open && (enrolled
        ? <Link href={`/tracks/${s.track.slug}`} className="text-xs text-sky-300 underline">Continue</Link>
        : <form action={enroll}><input type="hidden" name="trackId" value={s.track.id} /><input type="hidden" name="goal" value={`Towards ${leg.title}`} /><button className="text-xs text-sky-300 underline">Start</button></form>)}
    </li>
  );
}

import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, CalendarClock, CheckCircle2, Flag, Gauge, MapPin, Mountain, Repeat, Target } from "lucide-react";
import { db, enrollments } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHero } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { SubjectArt } from "@/components/SubjectArt";
import { StandingCard } from "@/components/StandingCard";
import { GoalForm } from "@/components/GoalForm";
import { standingFor } from "@/lib/careerStanding";
import { journeyFor, levelCode, roleLabel, targetsFor, type Leg } from "@/lib/journey";
import { assessmentFor } from "@/lib/route";
import { roleRouteSlug, roleTarget } from "@/lib/routeRole";
import { clearCareerGoal, enroll } from "@/app/actions";

export const metadata = { title: "Goal assessment — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const PACE = {
  "on-track": { label: "On track", cls: "bg-emerald-500/15 text-emerald-300" },
  "learning-done": { label: "Learning done", cls: "bg-emerald-500/15 text-emerald-300" },
  behind: { label: "Behind", cls: "bg-amber-500/15 text-amber-300" },
  "not-started": { label: "Not started yet", cls: "bg-sky-500/15 text-sky-300" },
  "past-date": { label: "Date passed", cls: "bg-rose-500/15 text-rose-300" },
  "no-date": { label: "No date set", cls: "bg-black/5 text-slate-300" },
} as const;

type Gap = { step: Leg["steps"][number]; need: number; why: string };

/** The tracks still to pass on the way, each once at the highest level any rung asks, the widest gap first. */
function widestGaps(legs: Leg[], limit: number): Gap[] {
  const byTrack = new Map<number, Gap>();
  for (const l of legs) for (const s of l.steps) {
    if (!s.open) continue;
    const have = byTrack.get(s.track.id);
    if (!have) byTrack.set(s.track.id, { step: s, need: s.need, why: l.title });
    else if (s.need > have.need) have.need = s.need;
  }
  return [...byTrack.values()].sort((a, b) => (b.need - b.step.passed) - (a.need - a.step.passed)).slice(0, limit);
}

export default async function GoalAssessment() {
  const user = await requireUser();
  const j = journeyFor(user);
  const enrolled = new Set(db.select({ t: enrollments.trackId }).from(enrollments).where(eq(enrollments.userId, user.id)).all().map((e) => e.t));

  if (j.state === "no-ladder") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHero Icon={Gauge} tone="violet" title="Goal assessment" sub="Where you stand against the role you want, and what closes the gap." />
        <EmptyState Icon={Mountain} tone="violet" title="No path to assess yet">
          There is no career path for {user.audience === "customer" ? "customer accounts" : <>the role <b>{user.jobRole}</b></>} yet.
        </EmptyState>
      </div>
    );
  }
  if (j.state === "unreachable") {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <PageHero Icon={Gauge} tone="violet" title="Goal assessment" sub="Where you stand against the role you want, and what closes the gap." />
        <p role="alert" className="card p-4 text-amber-300">The route to {roleLabel(j.goal.targetRole)} (level {j.goal.targetLevel}) no longer exists from where you are. Pick another goal.</p>
        <form action={clearCareerGoal}><button className="btn btn-ghost">Remove this goal</button></form>
      </div>
    );
  }

  const { goal, here, legs, pace } = j;
  const targets = targetsFor(user);
  const st = standingFor(user);

  if (!goal) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={Gauge} tone="violet" title="Goal assessment" sub="Choose the role you want. We measure where you stand against it and what closes the gap." />
        {st && <StandingCard st={st} goalTitle="" slug={null} state="none" />}
        <section className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Target size={17} /></span>Set your goal</h2>
          {targets.length ? <GoalForm targets={targets} goal={null} hereRole={here.role} /> : <p className="text-sm text-slate-400">You are already at the top of the path for your role, and no other path leads on from here yet.</p>}
        </section>
      </div>
    );
  }

  const slug = roleTarget(roleRouteSlug(goal.targetRole, goal.targetLevel)) ? roleRouteSlug(goal.targetRole, goal.targetLevel) : null;
  const a = slug ? assessmentFor(user.id, slug) : null;
  const doneLegs = legs.filter((l) => l.done && l.counted > 0).length;
  const toGo = legs.length - doneLegs;
  const reached = legs.length === 0;
  const gaps = widestGaps(legs, 6);
  const crossing = legs.some((l) => l.crossing);
  const status = pace ? PACE[pace.status] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Gauge} tone="violet" title="Goal assessment" sub={`${here.title} to ${j.target.title}: how far you are, and what closes the gap.`} />

      <section className="card flex flex-wrap items-center gap-5 p-5" aria-label="Verdict">
        {!reached && <Ring pct={j.counted ? j.met / j.counted : 0} label={`${j.counted ? Math.round((j.met / j.counted) * 100) : 0}%`} sub="of steps" size={104} color={pace && (pace.status === "behind" || pace.status === "past-date") ? "#f59e0b" : "#10b981"} />}
        <div className="min-w-0 flex-1 space-y-1">
          {reached ? (
            <p className="text-lg font-bold">You are already at {j.target.title}.</p>
          ) : (
            <p className="text-lg font-bold">{toGo === 1 ? "One rung" : `${toGo} rungs`} from {j.target.title}{pace && pace.work > 0 ? <span className="font-normal text-slate-400"> · {pace.work} level{pace.work === 1 ? "" : "s"} still to pass</span> : null}</p>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{here.title} · {here.code}</span>
            <ArrowRight size={13} aria-hidden />
            <span className="inline-flex items-center gap-1"><Flag size={13} />{j.target.title} · {levelCode(j.target.level)}</span>
            <span className="inline-flex items-center gap-1"><CalendarClock size={13} />by {date(goal.targetDate)}</span>
            {status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${status.cls}`}>{status.label}</span>}
          </p>
          {pace?.projectedAt && pace.work > 0 && <p className="text-xs text-slate-400">At your current pace the learning is done around <b className="text-slate-300">{date(pace.projectedAt)}</b>.</p>}
        </div>
      </section>

      {st && <StandingCard st={st} goalTitle={j.target.title} slug={slug} state={!a ? "none" : a.status} />}

      {legs.length > 0 && (
        <section className="card space-y-3 p-5" aria-label="Rung by rung">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Mountain size={17} /></span>Rung by rung</h2>
          <ol className="space-y-2">
            {legs.map((l) => {
              const done = l.done && l.counted > 0;
              return (
                <li key={`${l.role}|${l.level}`} className="rounded-2xl border border-black/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{l.title} <span className="text-xs font-normal text-slate-400">{roleLabel(l.role)} · {l.code}</span>{l.crossing && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-pink-300"><Repeat size={12} />change of role</span>}</div>
                    <span className={`text-xs ${done ? "text-emerald-300" : "text-slate-400"}`}>{done ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} />Complete</span> : l.counted ? `${l.met}/${l.counted} steps · ${l.work} level${l.work === 1 ? "" : "s"} to pass` : "Judged by your manager"}</span>
                  </div>
                  {l.counted > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${(l.met / l.counted) * 100}%`, background: done ? "#10b981" : "#8b5cf6" }} /></div>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="card space-y-3 p-5" aria-label="Widest gaps">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Target size={17} /></span>Where to start <span className="text-xs font-normal text-slate-400">widest gaps first</span></h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {gaps.map(({ step: s, need, why }) => (
              <li key={s.track.id} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[#fff] p-3">
                <SubjectArt slug={s.track.slug} name={s.track.name} kind={s.track.kind} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.track.name}</div>
                  <div className="text-[11px] text-slate-400">level {Math.min(s.passed, need)} of {need} · for {why}</div>
                </div>
                {enrolled.has(s.track.id)
                  ? <Link href={`/tracks/${s.track.slug}`} className="btn !px-3 !py-1 text-xs">Continue</Link>
                  : <form action={enroll}><input type="hidden" name="trackId" value={s.track.id} /><input type="hidden" name="goal" value={`Towards ${j.target.title}`} /><button className="btn !px-3 !py-1 text-xs">Start</button></form>}
              </li>
            ))}
          </ul>
          {crossing && slug && <p className="text-xs text-slate-500">Your dated plan covers the steps on the {roleLabel(goal.targetRole)} ladder. The steps before the change of role are listed above, and in full on <Link href="/journey" className="underline">My career</Link>.</p>}
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Target size={17} /></span>Change your goal</h2>
        <GoalForm targets={targets} goal={goal} hereRole={here.role} />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/journey" className="text-sky-300 underline">Every step, in full</Link>
          <form action={clearCareerGoal}><button className="text-slate-400 underline">Remove this goal</button></form>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { Award, CalendarDays, CheckCircle2, ClipboardList, Compass, Eye, Flame, GraduationCap, Mail, NotebookPen, ShieldCheck, Target, TriangleAlert, UserCog, Users } from "lucide-react";
import { answers, certificates, checklistItems, dailyQuests, db, enrollments, handovers, levelCredits, questions, runVoids, runs, tracks, users } from "@/lib/db";
import { realUser, requireManager, viewAsState } from "@/lib/auth";
import { Initials, PageHero, PALETTE, StatTile } from "@/components/charts";
import { ActionForm } from "@/components/admin/ActionForm";
import { OnboardingPhases } from "@/components/OnboardingPhases";
import { certState } from "@/lib/certs";
import { EXTEND_DAYS, MANAGER_EXTEND_MAX, whyNotCorrect } from "@/lib/corrections";
import { EXPIRY_DAYS, MANAGER_CAP } from "@/lib/credits";
import { weekStats } from "@/lib/friends";
import { goalOf, roleLabel } from "@/lib/journey";
import { MAX_LEVEL } from "@/lib/levels";
import { menteesOf, mentorsOf } from "@/lib/mentoring";
import { onboardingFor } from "@/lib/onboarding";
import { catalog, requirementsFor, scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";
import { creditInForce } from "@/lib/progress";
import { routeSummaryFor } from "@/lib/routePlan";
import { recordProfileView } from "@/lib/securityLog";
import { activityFor, trackStats } from "@/lib/stats";
import { isSuperAdmin } from "@/lib/superAdmin";
import { clientIp } from "@/lib/rate-limit";
import { isGlobal, reachOf, userInReach } from "@/lib/tenancy";
import { extendDeadlineAction, grantCreditAction, reinstateCertAction, restoreRunAction, revokeCertAction, revokeCreditAction, voidRunAction } from "@/app/fix-actions";
import { NoteComposer } from "@/components/NoteControls";
import { NotesThread } from "@/components/NotesThread";
import { notesForAnswers, whyNotReview } from "@/lib/questionNotes";

export const metadata = { title: "Person — gglearn admin" };

const day = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const course = (name: string) => name.replace(/^\d+\.\s*/, "");
const sect = "card space-y-3 p-4", h = "flex items-center gap-2 text-base font-bold";
const field = "rounded border border-black/15 bg-[#fff] px-2 py-1.5 text-sm";
const sub = "cursor-pointer select-none text-xs font-semibold text-sky-700 underline";
const go = "btn btn-ghost !px-3 !py-1.5 text-sm";

/**
 * A person as their manager sees them, and where a manager corrects the record: who they are and where they belong, what they must learn and
 * how far they are, onboarding, every exam attempt with their answers, their goal and route, daily activity, starting levels, certificates,
 * mentoring, who runs them, and the notes kept about them.
 *
 * Reading never changes the person (the helpers that settle leagues or streak freezes as a side effect are not used here). Corrections are
 * forms that run the server actions in app/fix-actions.ts, which re-check everything (reach, role, reason) and log it; this page only decides
 * whether to show them. Only for people this viewer runs; a super admin's visit is logged.
 */
export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireManager();
  const id = Number((await params).id);
  const u = Number.isInteger(id) ? db.select().from(users).where(eq(users.id, id)).get() : undefined;
  if (!u || !userInReach(reachOf(me.id), u.id)) notFound(); // the same answer for "no such person" and "not yours", so ids cannot be probed
  const real = await realUser();
  if (real && isSuperAdmin(real)) recordProfileView(real.id, u.id, await clientIp());
  const viewing = (await viewAsState()) !== null;
  const canFix = !viewing && whyNotCorrect(me, u) === null; // corrections are made as yourself, never while viewing as someone
  const canNote = !viewing && whyNotReview(me, u.id) === null; // notes on their answers, likewise written as yourself

  const off = u.status === "offboarded", first = u.name.split(" ")[0];
  const scopes = scopesOf(u.id), opts = scopeOptions(), places = scopeLabels(scopes, opts);
  const cat = catalog();
  const reqs = off ? [] : requirementsFor(u, scopes, cat).sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt - b.dueAt);
  const done = reqs.filter((r) => r.done).length, overdue = reqs.filter((r) => !r.done && r.overdue).length;
  const onboarding = off ? null : onboardingFor(u, scopes, { cat });
  const enrolled = db.select({ e: enrollments, t: tracks }).from(enrollments).innerJoin(tracks, eq(tracks.id, enrollments.trackId)).where(eq(enrollments.userId, u.id)).all()
    .map(({ e, t }) => ({ t, s: trackStats(u.id, t, e.startedAt) })).sort((a, b) => b.s.passed - a.s.passed || b.s.xp - a.s.xp);
  const certs = db.select({ c: certificates, t: tracks }).from(certificates).innerJoin(tracks, eq(tracks.id, certificates.trackId)).where(eq(certificates.userId, u.id)).orderBy(desc(certificates.issuedAt)).all();
  const validCerts = certs.filter((x) => x.c.revokedAt == null && certState(x.c).state !== "expired").length;
  const week = weekStats([u.id]).get(u.id) ?? { weekXp: 0, streak: 0 };
  const activity = activityFor(u.id, 12), activeDays = activity.filter((d) => d.value > 0).length;
  const last = db.select({ at: sql<number | null>`max(${runs.finishedAt})` }).from(runs).where(and(eq(runs.userId, u.id), isNotNull(runs.finishedAt))).get()?.at ?? null;
  const mentors = mentorsOf(u.id), mentees = menteesOf(u.id);
  const items = db.select().from(checklistItems).where(eq(checklistItems.userId, u.id)).all();
  const notes = db.select().from(handovers).where(eq(handovers.userId, u.id)).orderBy(desc(handovers.createdAt)).all();
  const trackName = new Map(cat.map((t) => [t.id, t.name]));
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((x) => [x.id, x.name]));

  // every finished exam attempt (newest 30) with the answers given, and which of them a manager has marked as not counting
  const attempts = db.select({ r: runs, t: tracks }).from(runs).innerJoin(tracks, eq(tracks.id, runs.trackId)).where(and(eq(runs.userId, u.id), isNotNull(runs.finishedAt))).orderBy(desc(runs.finishedAt)).limit(30).all();
  const runIds = attempts.map((a) => a.r.id);
  const givenBy = new Map<number, { a: typeof answers.$inferSelect; q: typeof questions.$inferSelect }[]>();
  if (runIds.length) for (const x of db.select({ a: answers, q: questions }).from(answers).innerJoin(questions, eq(questions.id, answers.questionId)).where(inArray(answers.runId, runIds)).all()) givenBy.set(x.a.runId, [...(givenBy.get(x.a.runId) ?? []), x]);
  const qnotes = notesForAnswers([...givenBy.values()].flat().map((x) => x.a.id));
  const voided = new Map(runIds.length ? db.select().from(runVoids).where(and(inArray(runVoids.runId, runIds), isNull(runVoids.restoredAt))).all().map((v) => [v.runId, v]) : []);

  // where they want to go, and the route they planned to get there
  const goal = goalOf(u.id), route = off ? null : routeSummaryFor(u);
  // the last two weeks, day by day, from quests and exams
  const quests = db.select().from(dailyQuests).where(and(eq(dailyQuests.userId, u.id), sql`${dailyQuests.day} >= ${new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)}`)).all();
  const questsByDay = new Map<string, string[]>();
  for (const q of quests) questsByDay.set(q.day, [...(questsByDay.get(q.day) ?? []), `${q.kind} ${q.xp} XP`]);
  const recentDays = activity.slice(-14).reverse();
  // starting levels in force
  const credits = db.select().from(levelCredits).where(and(eq(levelCredits.userId, u.id), creditInForce())).orderBy(desc(levelCredits.id)).all();
  const pickable = [...new Map([...reqs.map((r) => [r.track.id, course(r.track.name)] as const), ...enrolled.map(({ t }) => [t.id, course(t.name)] as const)]).entries()];

  // who runs them: managers and admins whose places cover this person (a super admin or platform owner runs everyone, so is named once, not listed)
  const runners = db.select().from(users).where(eq(users.status, "active")).all().filter((m) => m.id !== u.id && m.role !== "learner" && userInReach(reachOf(m.id), u.id));
  const scopedRunners = runners.filter((m) => !isGlobal(reachOf(m.id)));
  const everyoneRunner = runners.length - scopedRunners.length;

  const tiles = [
    { Icon: Target, label: "Required done", value: reqs.length ? `${done}/${reqs.length}` : "None" },
    { Icon: TriangleAlert, label: "Overdue", value: overdue },
    { Icon: Flame, label: "Day streak", value: week.streak },
    { Icon: Award, label: "Certificates", value: validCerts },
  ];
  const reasonField = <input name="reason" required minLength={8} maxLength={300} placeholder="Why (kept on record; they are told)" className={`${field} min-w-56 flex-1`} autoComplete="off" />;

  return (
    <div className="space-y-6">
      <PageHero Icon={Users} title={u.name} sub={<>{u.email} · {u.audience === "customer" ? "customer" : roleLabel(u.jobRole)}</>}>
        <Link href={`/admin/people?edit=${u.id}`} className="btn btn-ghost !py-1 text-sm"><UserCog size={15} />Edit or place</Link>
        <Link href="/admin/people" className="btn btn-ghost !py-1 text-sm">All people</Link>
      </PageHero>

      {viewing && <p className="card border-l-4 border-amber-500 p-3 text-sm text-amber-900">You are viewing as someone else, so corrections are switched off here. Exit the view (red bar) to make them as yourself.</p>}

      <section className={sect} aria-label="Who">
        <div className="flex flex-wrap items-center gap-3">
          <Initials name={u.name} size={56} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-800"><ShieldCheck size={10} aria-hidden />{u.role}</span>
              {u.guest === "yes" && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-sky-800">guest</span>}
              {u.audience === "customer" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-800">customer</span>}
              {off ? <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-800">offboarded</span> : <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-800">active</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><Mail size={13} aria-hidden />{u.email}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden />Joined {day(u.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><GraduationCap size={13} aria-hidden />{last ? `Last finished a level ${day(last)}` : "Has not finished a level yet"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {places.length ? places.map((p) => <span key={p} className="rounded-full bg-black/5 px-2 py-0.5 text-slate-600">{p}</span>) : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-800">Not placed in any company, brand or project</span>}
            </div>
          </div>
          {real && isSuperAdmin(real) && !viewing && !off && u.id !== real.id && !isSuperAdmin(u) && <Link href={`/admin/people?edit=${u.id}`} className="btn btn-ghost !py-1 text-sm"><Eye size={15} />View as {first}</Link>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, value }, i) => <StatTile key={label} i={i} Icon={Icon} label={label} value={value} color={[PALETTE.emerald, PALETTE.rose, PALETTE.amber, PALETTE.sky][i]} />)}
      </div>

      <section className={sect} aria-labelledby="p-required">
        <h2 id="p-required" className={h}><Target size={16} aria-hidden />Required learning</h2>
        {off ? <p className="text-sm text-slate-400">{first} has been offboarded.</p> : reqs.length === 0 ? <p className="text-sm text-slate-400">{u.guest === "yes" ? "Guests are not put through required courses." : scopes.length === 0 ? "Nothing is required until they are placed in a company, brand or project." : "Nothing is required of them right now."}</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {reqs.map((r) => (
              <li key={r.track.id} className="space-y-1.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-medium">{course(r.track.name)}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{r.why === "mandatory" ? "mandatory" : "role"}</span>
                  <span className="text-slate-500">level {r.passed}/{r.track.requiredLevel}</span>
                  {r.done ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} aria-hidden />Done</span>
                    : r.overdue ? <span className="font-semibold text-rose-600">Overdue, was due {day(r.dueAt)}</span>
                    : <span className="text-slate-500">Due {day(r.dueAt)}</span>}
                  {r.extendedTo != null && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">extended</span>}
                </div>
                {canFix && !r.done && (
                  <details>
                    <summary className={sub}>Give more time</summary>
                    <ActionForm action={extendDeadlineAction} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="trackId" value={r.track.id} />
                      <label className="block space-y-1"><span className="block text-xs font-semibold text-slate-400">Extra time</span>
                        <select name="days" className={field} defaultValue="14">{EXTEND_DAYS.filter((d) => me.role === "admin" || d <= MANAGER_EXTEND_MAX).map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
                      {reasonField}
                      <button className={go}>Extend</button>
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {onboarding && onboarding.gated && onboarding.phases.length > 0 && (
        <section className={sect} aria-labelledby="p-onboarding">
          <h2 id="p-onboarding" className={h}><ClipboardList size={16} aria-hidden />Onboarding phases</h2>
          <OnboardingPhases o={onboarding} />
          <p className="text-xs text-slate-400">Signing a phase off is done from their panel in People.</p>
        </section>
      )}

      <section className={sect} aria-labelledby="p-goal">
        <h2 id="p-goal" className={h}><Compass size={16} aria-hidden />Goal and route</h2>
        {!goal && !route ? <p className="text-sm text-slate-400">{first} has not set a career goal or started a route plan. A goal gives them dates and a weekly pace, so it is worth asking.</p> : (
          <div className="space-y-1 text-sm">
            {goal && <p>Goal: <b>{roleLabel(goal.targetRole)}</b> by {day(goal.targetDate)}.</p>}
            {route?.state === "planned" && route.progress && route.view && <p>Route to <b>{route.target.title}</b>: {route.progress.stepsDone} of {route.progress.stepsTotal} steps done, {route.progress.status === "done" ? "finished" : route.progress.status === "on-track" ? "on track" : route.progress.status === "behind" ? "behind" : "over time"}, finishing {day(route.view.row.endsOn)}.</p>}
            {route && route.state !== "planned" && <p>Route to <b>{route.target.title}</b>: {route.state === "checking" ? "started the check, not finished" : "checked, no plan made yet"}.</p>}
          </div>
        )}
      </section>

      <section className={sect} aria-labelledby="p-exams">
        <h2 id="p-exams" className={h}><GraduationCap size={16} aria-hidden />Exam history</h2>
        {attempts.length === 0 ? <p className="text-sm text-slate-400">No finished exams yet.</p> : (
          <ul className="space-y-1.5 text-sm">
            {attempts.map(({ r, t }) => {
              const v = voided.get(r.id), given = givenBy.get(r.id) ?? [];
              const pct = Math.round((v?.originalScore ?? r.score ?? 0) * 100), wasPassed = v ? v.originalPassed : r.passed;
              return (
                <li key={r.id} className={`rounded-lg border border-black/5 p-2 ${v ? "bg-amber-500/5" : ""}`}>
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                      <span className="text-slate-500">{day(r.finishedAt ?? 0)}</span>
                      <span className="min-w-0 flex-1 font-medium">{course(t.name)} · level {r.level}</span>
                      <span className="text-slate-500">{pct}%</span>
                      {v ? <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">not counting</span>
                        : <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${wasPassed ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"}`}>{wasPassed ? "passed" : "not passed"}</span>}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {v && <p className="text-xs text-amber-900">Marked as not counting by {names.get(v.voidedBy) ?? "someone"} on {day(v.voidedAt)}: {v.reason}. It scored {pct}% and {wasPassed ? "passed" : "did not pass"}.</p>}
                      {given.length === 0 ? <p className="text-xs text-slate-400">No answers were kept for this attempt.</p> : (
                        <ol className="list-decimal space-y-1.5 pl-5 text-xs">
                          {given.map(({ a, q }) => {
                            const chosen = q.options?.find((o) => o.key === a.response), right = q.options?.find((o) => o.key === q.answer);
                            return (
                              <li key={a.id} id={`q${a.id}`}>
                                <p className="font-medium">{short(q.prompt, 220)}</p>
                                <p className={a.score >= 0.5 ? "text-emerald-700" : "text-rose-700"}>Answered: {chosen ? `${chosen.key}. ${chosen.text}` : short(a.response || "(no answer)", 240)} · {Math.round(a.score * 100)}%</p>
                                {q.type === "mcq" && right && a.score < 0.5 && <p className="text-slate-500">Correct: {right.key}. {right.text}</p>}
                                {a.feedback && <p className="text-slate-500">{short(a.feedback, 240)}</p>}
                                <div className="mt-1.5 space-y-2"><NotesThread notes={qnotes.get(a.id) ?? []} as="reviewer" meId={me.id} mayModerate={canNote && me.role !== "learner"} />{canNote && <NoteComposer answerId={a.id} />}</div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {canFix && (
                        <ActionForm action={v ? restoreRunAction : voidRunAction} className="flex flex-wrap items-end gap-2 border-t border-black/5 pt-2">
                          <input type="hidden" name="runId" value={r.id} />
                          {reasonField}
                          <button className={go}>{v ? "Count this attempt again" : "Mark as not counting"}</button>
                        </ActionForm>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-slate-400">Newest 30 attempts. An attempt marked as not counting keeps its record and can be counted again.</p>
      </section>

      <section className={sect} aria-labelledby="p-learning">
        <h2 id="p-learning" className={h}><GraduationCap size={16} aria-hidden />What they are learning</h2>
        <p className="text-sm text-slate-500">{week.weekXp.toLocaleString("en-GB")} XP this week · active on {activeDays} of the last 84 days</p>
        {enrolled.length === 0 ? <p className="text-sm text-slate-400">Not enrolled in anything yet.</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {enrolled.slice(0, 15).map(({ t, s }) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5"><span className="min-w-0 flex-1 truncate">{course(t.name)}</span><span className="text-slate-500">{s.passed} levels passed · {s.xp.toLocaleString("en-GB")} XP</span></li>
            ))}
            {enrolled.length > 15 && <li className="py-1.5 text-xs text-slate-400">and {enrolled.length - 15} more</li>}
          </ul>
        )}
        <details>
          <summary className={sub}>Last 14 days, day by day</summary>
          <ul className="mt-2 divide-y divide-black/5 text-xs">
            {recentDays.map((d) => <li key={d.day} className="flex gap-3 py-1"><span className="w-24 text-slate-500">{day(Date.parse(d.day) / 1000)}</span><span className={d.value ? "font-medium" : "text-slate-400"}>{d.value ? `${d.value} XP` : "nothing"}</span><span className="text-slate-400">{(questsByDay.get(d.day) ?? []).join(" · ")}</span></li>)}
          </ul>
        </details>
      </section>

      <section className={sect} aria-labelledby="p-credits">
        <h2 id="p-credits" className={h}><Award size={16} aria-hidden />Starting levels</h2>
        <p className="text-xs text-slate-400">A starting level lifts where someone begins a course and unlocks what comes next. It is never an exam pass. Only an admin can mark one as counting for required learning.</p>
        {credits.length === 0 ? <p className="text-sm text-slate-400">None given.</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {credits.map((c) => (
              <li key={c.id} className="space-y-1 py-1.5">
                <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{course(trackName.get(c.trackId) ?? "A course")} · level {c.level}{c.countsAsComplete ? " · counts as complete" : ""}</span><span className="text-xs text-slate-500">by {names.get(c.grantedBy) ?? "someone"}{c.expiresAt ? ` · until ${day(c.expiresAt)}` : ""}: {c.reason}</span></div>
                {canFix && <ActionForm action={revokeCreditAction} className="flex items-center gap-2"><input type="hidden" name="creditId" value={c.id} /><button className="text-xs font-semibold text-rose-700 underline">Take it back</button></ActionForm>}
              </li>
            ))}
          </ul>
        )}
        {canFix && pickable.length > 0 && (
          <details>
            <summary className={sub}>Give a starting level</summary>
            <ActionForm action={grantCreditAction} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <label className="block space-y-1"><span className="block text-xs font-semibold text-slate-400">Course</span><select name="trackId" className={field}>{pickable.map(([tid, name]) => <option key={tid} value={tid}>{name}</option>)}</select></label>
              <label className="block space-y-1"><span className="block text-xs font-semibold text-slate-400">Level</span><input name="level" type="number" min={1} max={me.role === "admin" ? MAX_LEVEL : MANAGER_CAP} defaultValue={1} className={`${field} w-20`} /></label>
              <label className="block space-y-1"><span className="block text-xs font-semibold text-slate-400">Lasts</span><select name="days" className={field} defaultValue=""><option value="">No end</option>{EXPIRY_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
              {me.role === "admin" && <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="counts" />Counts for required learning</label>}
              {reasonField}
              <button className={go}>Give</button>
            </ActionForm>
          </details>
        )}
      </section>

      <section className={sect} aria-labelledby="p-certs">
        <h2 id="p-certs" className={h}><Award size={16} aria-hidden />Certificates</h2>
        {certs.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {certs.map(({ c, t }) => {
              const st = c.revokedAt != null ? "revoked" : certState(c).state;
              return (
                <li key={c.id} className="space-y-1 py-1.5">
                  <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{course(t.name)} · level {c.level}</span><span className="text-slate-500">issued {day(c.issuedAt)}{c.expiresAt ? ` · expires ${day(c.expiresAt)}` : ""}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st === "valid" || st === "permanent" ? "bg-emerald-500/15 text-emerald-700" : st === "expiring" ? "bg-amber-500/20 text-amber-800" : "bg-rose-500/15 text-rose-700"}`}>{st}</span></div>
                  {canFix && me.role === "admin" && (
                    <details>
                      <summary className={sub}>{c.revokedAt != null ? "Reinstate" : "Revoke"}</summary>
                      <ActionForm action={c.revokedAt != null ? reinstateCertAction : revokeCertAction} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={c.id} />{reasonField}<button className={go}>{c.revokedAt != null ? "Reinstate" : "Revoke"}</button>
                      </ActionForm>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canFix && me.role !== "admin" && certs.length > 0 && <p className="text-xs text-slate-400">Only an admin can revoke or reinstate a certificate.</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={sect} aria-labelledby="p-runs">
          <h2 id="p-runs" className={h}><UserCog size={16} aria-hidden />Who runs {first}</h2>
          {scopedRunners.length === 0 && everyoneRunner === 0 ? <p className="text-sm text-slate-400">Nobody: they are not in a company yet.</p> : (
            <ul className="space-y-1 text-sm">
              {scopedRunners.map((m) => <li key={m.id}><Link href={`/admin/people/${m.id}`} className="text-sky-700 underline">{m.name}</Link> <span className="text-slate-400">· {m.role}</span></li>)}
              {everyoneRunner > 0 && <li className="text-slate-400">and {everyoneRunner} {everyoneRunner === 1 ? "person who runs" : "people who run"} the whole academy</li>}
            </ul>
          )}
        </section>
        <section className={sect} aria-labelledby="p-mentor">
          <h2 id="p-mentor" className={h}><Users size={16} aria-hidden />Mentoring</h2>
          {mentors.length === 0 && mentees.length === 0 ? <p className="text-sm text-slate-400">No mentors or mentees.</p> : (
            <ul className="space-y-1 text-sm">
              {mentors.map((m) => <li key={`a${m.id}`}>{m.name} <span className="text-slate-400">· {m.kind === "parent" ? "follows" : "mentors"} {first}</span></li>)}
              {mentees.map((m) => <li key={`b${m.id}`}>{m.name} <span className="text-slate-400">· {m.kind === "parent" ? "followed by" : "mentored by"} {first}</span></li>)}
            </ul>
          )}
        </section>
      </div>

      <section className={sect} aria-labelledby="p-notes">
        <h2 id="p-notes" className={h}><NotebookPen size={16} aria-hidden />Checklist and handover notes</h2>
        {items.length === 0 && notes.length === 0 && <p className="text-sm text-slate-400">Nothing recorded.</p>}
        {items.length > 0 && <ul className="space-y-1 text-sm">{items.map((c) => <li key={c.id} className={c.done ? "text-slate-400 line-through" : ""}>{c.done ? "✓" : "○"} <span className="text-[10px] uppercase text-slate-400">{c.kind}</span> {c.label}</li>)}</ul>}
        {notes.map((n) => <p key={n.id} className="whitespace-pre-wrap rounded-lg bg-sky-500/10 p-2.5 text-sm">{n.trackId != null && <b>{trackName.get(n.trackId) ?? "A track"}: </b>}{n.notes} <span className="text-xs text-slate-400">· {day(n.createdAt)}</span></p>)}
        <p className="text-xs text-slate-400">Add or tick things from their panel in People.</p>
      </section>
    </div>
  );
}

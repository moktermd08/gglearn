import { and, asc, eq } from "drizzle-orm";
import { db, routeAssessments, routePlans, routeTasks, users } from "@/lib/db";
import { levelsPassed } from "@/lib/progress";
import { type Plan, type PlanAction, type PlanArea, type PlanItem, DEFAULT_HOURS_PER_LEVEL, WEEK, addMonths, buildPlan, overdue, progressOf, weeksSince } from "@/lib/roadmap";
import { type ResolvedArea, type Target, TARGETS, areaRows, assessmentFor, resolveAreas, targetBySlug } from "@/lib/route";

type Person = typeof users.$inferSelect;
type Assessment = NonNullable<ReturnType<typeof assessmentFor>>;
export type PlanRow = typeof routePlans.$inferSelect;

const now = () => Math.floor(Date.now() / 1000);

export const planFor = (assessmentId: number) => db.select().from(routePlans).where(eq(routePlans.assessmentId, assessmentId)).get() ?? null;
export const doneTasks = (assessmentId: number) => new Set(db.select({ k: routeTasks.actionKey }).from(routeTasks).where(eq(routeTasks.assessmentId, assessmentId)).all().map((r) => r.k));

/** Where the person is in each checked area now: what the check found, or more if they have since passed levels. */
export function currentLevels(person: Person, areas: ResolvedArea[], assessmentId: number): Map<string, number> {
  const placed = new Map(areaRows(assessmentId).map((r) => [r.areaKey, r.placed]));
  const out = new Map<string, number>();
  for (const a of areas) {
    const p = placed.get(a.key);
    if (p === null || p === undefined || !a.trackId) continue;
    out.set(a.key, Math.min(a.target, Math.max(p, levelsPassed(person.id, a.trackId))));
  }
  return out;
}

/** Plan inputs from what is known about the person and the job. Exported so checks can see exactly what the generator is given. */
export function planInput(person: Person, target: Target, a: Assessment, weeks: number) {
  const areas = resolveAreas(target, person);
  const levels = currentLevels(person, areas, a.id);
  const done = doneTasks(a.id);
  const planAreas: PlanArea[] = areas.filter((r) => levels.has(r.key)).map((r, i) => ({
    key: r.key, label: r.label, trackSlug: r.trackSlug, current: levels.get(r.key)!, target: r.target,
    hoursPerLevel: r.hoursPerLevel ?? DEFAULT_HOURS_PER_LEVEL, stage: r.stage ?? 1, priority: r.priority ?? i + 1,
    rating: r.confidence === "digital" ? a.answers.digital : r.confidence === "writing" ? a.answers.writing : undefined,
  }));
  const actions: PlanAction[] = (target.actions ?? []).map((x) => ({
    key: x.key, label: x.label, detail: x.detail, hours: x.hours, done: done.has(x.key),
    // an eligibility question that is open comes before anything else, and is the last thing to give up
    ...(x.earlyIf?.workRights.includes(a.answers.workRights) ? { stage: 1, priority: 0 } : { stage: x.stage, priority: x.priority ?? 5 }),
  }));
  return { weeks, hoursPerWeek: a.hoursPerWeek, areas: planAreas, actions };
}

/**
 * Makes (or re-makes) the plan for a finished assessment, starting today. A first plan runs for the timeframe they chose. A re-plan keeps the
 * finish date they were working to, so falling behind shows up honestly as a tighter plan instead of quietly moving the goalposts, unless that
 * date is a week or less away, when it starts the timeframe again.
 */
export function createPlan(person: Person, target: Target, a: Assessment, at = now()): PlanRow | null {
  if (a.status !== "complete") return null;
  const old = planFor(a.id);
  const endsOn = old && old.endsOn - at > WEEK ? old.endsOn : addMonths(at, a.horizonMonths);
  const plan = buildPlan(planInput(person, target, a, (endsOn - at) / WEEK));
  db.insert(routePlans).values({ assessmentId: a.id, startsOn: at, endsOn, plan, createdAt: at })
    .onConflictDoUpdate({ target: routePlans.assessmentId, set: { startsOn: at, endsOn, plan, createdAt: at } }).run();
  return planFor(a.id);
}

/** Ticks an action off (or on again). Only keys the target actually lists are accepted. */
export function setTask(a: Assessment, target: Target, key: string, done: boolean) {
  if (!(target.actions ?? []).some((x) => x.key === key)) return;
  if (done) db.insert(routeTasks).values({ assessmentId: a.id, actionKey: key }).onConflictDoNothing().run();
  else db.delete(routeTasks).where(and(eq(routeTasks.assessmentId, a.id), eq(routeTasks.actionKey, key))).run();
}

export type ItemState = PlanItem & { done: boolean; current?: number };
export type PlanView = {
  row: PlanRow; plan: Plan; items: ItemState[];
  weeksNow: number; behind: boolean; weeksLate: number;
  /** the plan ended: its finish date has passed */
  over: boolean;
};

/** The stored plan with today's progress laid over it. */
export function viewPlan(person: Person, target: Target, a: Assessment, at = now()): PlanView | null {
  const row = planFor(a.id);
  if (!row) return null;
  const areas = resolveAreas(target, person);
  const levels = currentLevels(person, areas, a.id);
  const tasks = doneTasks(a.id);
  const items: ItemState[] = row.plan.items.map((i) => i.kind === "learn"
    ? { ...i, current: levels.get(i.key), done: (levels.get(i.key) ?? 0) >= i.toLevel }
    : { ...i, done: tasks.has(i.key) });
  const weeksNow = weeksSince(row.startsOn, at);
  const o = overdue(items, (i) => (i as ItemState).done, weeksNow);
  return { row, plan: row.plan, items, weeksNow, behind: o.behind, weeksLate: o.weeksLate, over: at >= row.endsOn };
}

export type RouteSummary = {
  target: Target;
  state: "checking" | "checked" | "planned";
  /** only when planned */
  progress?: ReturnType<typeof progressOf>;
  view?: PlanView;
};

/** Where a person is with one target job: not started (null), mid-check, checked but no plan, or planned with progress laid over it. */
export function routeSummary(person: Person, target: Target, at = now()): RouteSummary | null {
  const a = assessmentFor(person.id, target.slug);
  if (!a) return null;
  if (a.status !== "complete") return { target, state: "checking" };
  const view = viewPlan(person, target, a, at);
  if (!view) return { target, state: "checked" };
  return { target, state: "planned", view, progress: progressOf(view.items, (i) => (i as ItemState).done, view.weeksNow, (view.row.endsOn - view.row.startsOn) / WEEK) };
}

/** The first target job this person has started, for places that show one line about it (the dashboard, a mentor's view). */
export function routeSummaryFor(person: Person, at = now()): RouteSummary | null {
  for (const t of TARGETS) { const s = routeSummary(person, t, at); if (s) return s; }
  // a route to a rung of a career ladder is not in the list: find it from what this person started
  for (const row of db.select({ slug: routeAssessments.targetSlug }).from(routeAssessments).where(eq(routeAssessments.userId, person.id)).orderBy(asc(routeAssessments.id)).all()) {
    const t = TARGETS.some((x) => x.slug === row.slug) ? null : targetBySlug(row.slug);
    const s = t && routeSummary(person, t, at);
    if (s) return s;
  }
  return null;
}

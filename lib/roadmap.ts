/**
 * Turns the gaps found by a route assessment into a dated plan, given how long someone gives themselves and how many hours a week they have.
 * Pure: no database, no clock. The plan is stored when it is made (lib/routePlan.ts), so later dates do not shift every time it is viewed.
 */

export const WEEK = 7 * 86400;
/** Share of the hours a person says they have that the plan uses; the rest absorbs life getting in the way. */
export const USABLE = 0.9;
/** Hours per week, over the whole timeframe, at which a plan is called tight and too tight. */
export const COMFORTABLE_AT = 0.85;
/** Learning hours a level takes when the target does not say. */
export const DEFAULT_HOURS_PER_LEVEL = 4;
/** Extra time for an area when the person rated the skill behind it 1 or 2 out of 5. */
export const LOW_CONFIDENCE = 1.3;

export type PlanArea = {
  key: string; label: string; trackSlug: string;
  /** where the person is now, and the level the job asks for */
  current: number; target: number;
  hoursPerLevel: number; stage: number;
  /** 1 is most important to getting the job; decides what is kept when time is short */
  priority: number;
  /** their self-rating (1 to 5) of the skill behind the area, when there is one */
  rating?: number;
};
/** priority works like an area's: 1 is most important, and a smaller number is kept first when time is short (an action is kept whole or not at all) */
export type PlanAction = { key: string; label: string; detail: string; stage: number; hours: number; priority: number; done: boolean };
export type PlanInput = { weeks: number; hoursPerWeek: number; areas: PlanArea[]; actions: PlanAction[] };

export type LearnItem = { kind: "learn"; key: string; label: string; trackSlug: string; stage: number; fromLevel: number; toLevel: number; targetLevel: number; hours: number; startWeek: number; endWeek: number };
export type ActionItem = { kind: "action"; key: string; label: string; detail: string; stage: number; hours: number; startWeek: number; endWeek: number };
export type PlanItem = LearnItem | ActionItem;
export type Verdict = "comfortable" | "tight" | "too-tight";
export type Deferred = { kind: "learn" | "action"; key: string; label: string; trackSlug?: string; levels: number; hours: number };

export type Plan = {
  verdict: Verdict;
  totalWeeks: number;
  /** weeks kept at the end for applying */
  applyWeeks: number;
  /** when the last learning item finishes, in weeks from the start: the earliest sensible time to start applying */
  readyWeek: number;
  hoursPerWeek: number;
  neededHours: number; plannedHours: number; capacityHours: number;
  items: PlanItem[];
  /** areas, or the later levels of an area, that did not fit */
  deferred: Deferred[];
  /** actions already ticked off when the plan was made */
  doneActions: string[];
  /** what would make it fit, when it does not */
  advice: { months: number; hoursPerWeek: number } | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const WEEKS_PER_MONTH = 52 / 12;

/** The weeks kept at the end for applying: a fifth of the timeframe, never less than a week or more than twelve. */
export const applyWeeksFor = (total: number) => Math.min(12, Math.max(1, total * 0.2));

/** Hours one level of this area is expected to take this person. */
export const hoursForLevel = (a: Pick<PlanArea, "hoursPerLevel" | "rating">) => a.hoursPerLevel * (a.rating !== undefined && a.rating <= 2 ? LOW_CONFIDENCE : 1);

export function buildPlan(input: PlanInput): Plan {
  const { weeks: total, hoursPerWeek: hpw } = input;
  const applyWeeks = applyWeeksFor(total);
  const capacityHours = Math.max(0, (total - applyWeeks) * hpw * USABLE);

  const todo = input.actions.filter((a) => !a.done);
  const actionHours = todo.reduce((n, a) => n + a.hours, 0);
  const gaps = input.areas.filter((a) => a.current < a.target);
  const fullHours = gaps.reduce((n, a) => n + (a.target - a.current) * hoursForLevel(a), 0);
  const neededHours = round1(fullHours + actionHours);

  // fill the hours in order of importance, learning and actions together; the last area that fits may be partly done, the rest wait
  let budget = capacityHours;
  const planned = new Map<string, number>(); // area key -> level to plan up to
  const keptActions = new Set<string>();
  const deferred: Deferred[] = [];
  type Cand = { priority: number; isAction: boolean; area?: PlanArea; action?: PlanAction; gap: number };
  const cands: Cand[] = [
    ...gaps.map((a) => ({ priority: a.priority, isAction: false, area: a, gap: a.target - a.current })),
    ...todo.map((a) => ({ priority: a.priority, isAction: true, action: a, gap: 0 })),
  ].sort((x, y) => x.priority - y.priority || Number(y.isAction) - Number(x.isAction) || y.gap - x.gap);
  for (const c of cands) {
    if (c.action) {
      if (c.action.hours <= budget + 1e-9) { keptActions.add(c.action.key); budget -= c.action.hours; }
      else deferred.push({ kind: "action", key: c.action.key, label: c.action.label, levels: 0, hours: c.action.hours });
      continue;
    }
    const a = c.area!, per = hoursForLevel(a), want = a.target - a.current;
    const can = Math.max(0, Math.min(want, Math.floor((budget + 1e-9) / per)));
    if (can > 0) { planned.set(a.key, a.current + can); budget -= can * per; }
    if (can < want) deferred.push({ kind: "learn", key: a.key, label: a.label, trackSlug: a.trackSlug, levels: want - can, hours: round1((want - can) * per) });
  }

  type Raw = { stage: number; order: number; make: (start: number) => PlanItem };
  const raws: Raw[] = [];
  for (const a of todo.filter((x) => keptActions.has(x.key))) {
    raws.push({ stage: a.stage, order: -1, make: (s) => ({ kind: "action", key: a.key, label: a.label, detail: a.detail, stage: a.stage, hours: a.hours, startWeek: s, endWeek: s + a.hours / hpw }) });
  }
  for (const a of gaps) {
    const to = planned.get(a.key);
    if (to === undefined) continue;
    const hours = (to - a.current) * hoursForLevel(a);
    raws.push({ stage: a.stage, order: a.priority, make: (s) => ({ kind: "learn", key: a.key, label: a.label, trackSlug: a.trackSlug, stage: a.stage, fromLevel: a.current, toLevel: to, targetLevel: a.target, hours: round1(hours), startWeek: s, endWeek: s + hours / hpw }) });
  }
  // by stage, quick set-up actions first, then the areas that matter most
  raws.sort((x, y) => x.stage - y.stage || x.order - y.order);
  const items: PlanItem[] = [];
  let at = 0;
  for (const r of raws) { const it = r.make(at); items.push(it); at = it.endWeek; }

  const plannedHours = round1(items.reduce((n, i) => n + i.hours, 0));
  const ratio = capacityHours > 0 ? neededHours / capacityHours : Infinity;
  const verdict: Verdict = deferred.length || ratio > 1 ? "too-tight" : ratio > COMFORTABLE_AT ? "tight" : "comfortable";

  let advice: Plan["advice"] = null;
  if (verdict === "too-tight") {
    const perWeekToFit = Math.ceil(neededHours / (Math.max(total - applyWeeks, 0.5) * USABLE));
    // the shortest timeframe, at the same hours a week, whose learning weeks hold everything
    let months = 1;
    while (months < 600 && (months * WEEKS_PER_MONTH - applyWeeksFor(months * WEEKS_PER_MONTH)) * hpw * USABLE < neededHours) months++;
    advice = { months, hoursPerWeek: perWeekToFit };
  }

  return { verdict, totalWeeks: round1(total), applyWeeks: round1(applyWeeks), readyWeek: round1(at), hoursPerWeek: hpw, neededHours, plannedHours, capacityHours: round1(capacityHours), items, deferred, doneActions: input.actions.filter((a) => a.done).map((a) => a.key), advice };
}

/** Weeks since the plan started, for placing today on it. */
export const weeksSince = (startsOn: number, nowSec: number) => Math.max(0, (nowSec - startsOn) / WEEK);

/** The unix time of a point in the plan. */
export const dateAt = (startsOn: number, week: number) => Math.round(startsOn + week * WEEK);

/** Same wall-clock day `months` later, in UTC. */
export function addMonths(sec: number, months: number): number {
  const d = new Date(sec * 1000);
  d.setUTCMonth(d.getUTCMonth() + months);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Items that should be finished by now but are not, and by how many weeks the oldest is late. Someone is "behind" when something
 * is two or more weeks overdue: a few days either way is ordinary.
 */
export function overdue(items: PlanItem[], isDone: (i: PlanItem) => boolean, weeksNow: number): { late: PlanItem[]; weeksLate: number; behind: boolean } {
  const late = items.filter((i) => i.endWeek <= weeksNow && !isDone(i));
  const weeksLate = late.length ? Math.max(...late.map((i) => weeksNow - i.endWeek)) : 0;
  return { late, weeksLate: round1(weeksLate), behind: weeksLate >= 2 };
}

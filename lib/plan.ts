import { type users } from "@/lib/db";
import { diagnose } from "@/lib/careerDoctor";
import { type Goal, type Journey, journeyFor, roleLabel } from "@/lib/journey";
import { requirementsFor, scopesOf } from "@/lib/paths";
import { factsOf } from "@/lib/progression";
import { manualItemsFor } from "@/lib/planItems";
import { plansOf } from "@/lib/planSets";
import { topicLabel } from "@/lib/topicName";

type Person = typeof users.$inferSelect;

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const shortDate = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
/** Active days in a week we ask for: enough to build the habit, not so many that a missed day feels like failure. */
export const WEEKLY_DAYS_TARGET = 4;

export type PlanSource = "required" | "goal" | "doctor" | "manual" | "habit";
export type PlanStatus = "done" | "overdue" | "behind" | "on-track" | "open";
export type PlanItem = {
  key: string;
  /** set for manual items: the plan_items row, and whether the person added it themself (they may remove it) */
  manual?: { id: number; mine: boolean; period: "once" | "weekly"; signedOff: boolean };
  /** the subject, when the item is one: the same subject in two plans counts once in the overall total */
  track?: number;
  source: PlanSource;
  title: string;
  /** why this is on the plan, in a few words */
  why: string;
  /** how much is done of how much is asked, in the item's own unit */
  have: number;
  need: number;
  unit: string;
  /** how often / by when, in words */
  cadence: string;
  dueAt: number | null;
  status: PlanStatus;
  href: string;
};
export type PlanGoal = { title: string; from: string; status: string | null; perWeekNeeded: number; perWeekNow: number; targetDate: number | null };
export type Plan = {
  items: PlanItem[];
  /** the few things to do first */
  focus: PlanItem[];
  done: number;
  total: number;
  /** 0..1: how much of everything asked is done, each item counting for its share (3 of 5 levels is 60%), so partial progress shows */
  progress: number;
  week: { activeDays: number; target: number; streakDays: number[] };
  goal: PlanGoal | null;
};
/** One plan on the overview: the built-in required and main plans, and each extra plan a person or manager made. */
export type PlanCard = {
  /** "required", "main" or "p<id>": what /plan?plan= takes */
  key: string;
  kind: "required" | "main" | "extra";
  id: number | null;
  name: string;
  blurb: string;
  /** an extra plan the person made themself, so they may remove it */
  mine: boolean;
  plan: Plan;
};
export type PlanSet = { all: Plan; cards: PlanCard[] };

const RANK: Record<PlanStatus, number> = { overdue: 0, behind: 1, open: 2, "on-track": 3, done: 4 };
const byUrgency = (a: PlanItem, b: PlanItem) => RANK[a.status] - RANK[b.status] || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.title.localeCompare(b.title);

type Week = Plan["week"];
function build(list: PlanItem[], week: Week, goal: PlanGoal | null): Plan {
  const items = [...list].sort(byUrgency);
  const work = items.filter((i) => i.source !== "habit");
  const progress = work.length ? work.reduce((n, i) => n + (i.need ? Math.min(1, i.have / i.need) : 0), 0) / work.length : 0;
  return { items, focus: items.filter((i) => i.status !== "done" && i.source !== "habit").slice(0, 3), done: items.filter((i) => i.status === "done").length, total: items.length, progress, week, goal };
}

/** The plan items a journey says: each subject still to pass, once, at the highest level any step asks. */
function goalItems(j: Extract<Journey, { state: "ok" }>, keyPrefix: string): { items: PlanItem[]; goal: PlanGoal | null } {
  const items: PlanItem[] = [];
  const behind = j.pace?.status === "behind" || j.pace?.status === "past-date";
  const byTrack = new Map<number, { s: (typeof j.legs)[number]["steps"][number]; need: number; dueAt: number | null; leg: string }>();
  for (const l of j.legs) for (const s of l.steps) {
    if (!s.countable) continue;
    const have = byTrack.get(s.track.id);
    if (!have || s.need > have.need) byTrack.set(s.track.id, { s, need: s.need, dueAt: have?.dueAt ?? l.dueAt, leg: have?.leg ?? l.title });
  }
  for (const { s, need, dueAt, leg } of byTrack.values()) {
    const done = s.passed >= need;
    if (done && !j.goal) continue; // without a goal there is nothing to celebrate yet
    items.push({
      key: `${keyPrefix}goal-${s.track.id}`, track: s.track.id, source: "goal", title: topicLabel(s.track.name),
      why: `For ${leg}${j.goal ? ` on the way to ${j.target.title}` : ""}`,
      have: Math.min(s.passed, need), need, unit: "levels",
      cadence: j.goal && dueAt ? `Finish by ${shortDate(dueAt)}` : "Pass at your own pace",
      dueAt: j.goal ? dueAt : null, status: done ? "done" : behind ? "behind" : j.pace?.status === "on-track" ? "on-track" : "open", href: `/tracks/${s.track.slug}`,
    });
  }
  const goal = j.goal && j.pace ? { title: `${j.here.title} → ${j.target.title}`, from: roleLabel(j.here.role), status: j.pace.status, perWeekNeeded: j.pace.perWeekNeeded, perWeekNow: j.pace.perWeekNow, targetDate: j.goal.targetDate } : null;
  return { items, goal };
}

function manualAsItems(person: Person, at: number, planId: number | null, keyPrefix: string): PlanItem[] {
  return manualItemsFor(person.id, at, planId).map((m) => {
    const date = m.dueAt ? shortDate(m.dueAt) : null;
    return {
      key: `${keyPrefix}man-${m.id}`, source: "manual" as const, title: m.title, why: m.note ? `${m.setBy}: ${m.note}` : `Set by ${m.setBy}`,
      have: m.have, need: m.need, unit: m.period === "weekly" ? "this week" : m.need === 1 ? "time" : "times",
      cadence: m.signedOff ? "Signed off" : m.period === "weekly" ? `${m.need} a week, every week` : date ? `${m.need} in total, by ${date}` : `${m.need} in total`,
      dueAt: m.dueAt, status: m.done ? "done" as const : m.overdue ? "overdue" as const : "open" as const, href: "/plan",
      manual: { id: m.id, mine: m.mine, period: m.period, signedOff: m.signedOff },
    };
  });
}

/**
 * All of a person's plans, worked out from data the app already keeps (goal, required learning, exam results, activity, the items people added).
 * There are three kinds: the required-learning plan (always there), the main plan (the career goal, or the Career doctor's pointers when there is none,
 * plus the study-days habit), and any extra plans, each with its own optional target. `all` is every item together, a subject shared by two plans counted once.
 * Nothing about progress is stored, so it cannot drift from what really happened.
 */
export function planSetFor(person: Person, at = now()): PlanSet {
  // the habit: how often you showed up this week, from the activity the app already records
  const days = factsOf(person.id).days;
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date((at - (6 - i) * DAY) * 1000).toISOString().slice(0, 10));
  const hits = weekDays.filter((d) => days.has(d)).length;
  const week: Week = { activeDays: hits, target: WEEKLY_DAYS_TARGET, streakDays: weekDays.map((d, i) => (days.has(d) ? i : -1)).filter((i) => i >= 0) };
  const habit: PlanItem = {
    key: "habit", source: "habit", title: "Study days this week", why: "Little and often beats long and rare",
    have: Math.min(hits, WEEKLY_DAYS_TARGET), need: WEEKLY_DAYS_TARGET, unit: "days",
    cadence: `${WEEKLY_DAYS_TARGET} days a week`, dueAt: null, status: hits >= WEEKLY_DAYS_TARGET ? "done" : hits === 0 ? "behind" : "on-track", href: "/dashboard",
  };

  // 1. required learning: has a due date, so overdue is a real status
  const required: PlanItem[] = requirementsFor(person, scopesOf(person.id)).map((r) => {
    const daysLeft = Math.ceil((r.dueAt - at) / DAY);
    return {
      key: `req-${r.track.id}`, track: r.track.id, source: "required" as const, title: topicLabel(r.track.name),
      why: r.why === "role" ? "Required for your role" : "Required for everyone",
      have: Math.min(r.passed, r.track.requiredLevel), need: r.track.requiredLevel, unit: "levels",
      cadence: r.done ? "Complete" : r.overdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue` : `Due in ${Math.max(daysLeft, 0)} day${daysLeft === 1 ? "" : "s"}`,
      dueAt: r.dueAt, status: r.done ? "done" as const : r.overdue ? "overdue" as const : "open" as const, href: `/tracks/${r.track.slug}`,
    };
  });

  // 2. the main plan: the career goal's route, or with no goal the Career doctor's strongest direction
  const j = journeyFor(person);
  let main: PlanItem[] = [], mainGoal: PlanGoal | null = null;
  if (j.state === "ok") ({ items: main, goal: mainGoal } = goalItems(j, ""));
  if (j.state !== "ok" || !j.goal) {
    const top = diagnose(person).families[0]?.roles[0];
    const seen = new Set(main.map((i) => i.track));
    if (top) for (const a of top.areas) {
      if (seen.has(a.trackId)) continue;
      seen.add(a.trackId);
      main.push({
        key: `doc-${a.slug}`, track: a.trackId, source: "doctor", title: topicLabel(a.name), why: `Career doctor: needed for ${top.name}`,
        have: Math.min(a.have, a.need), need: a.need, unit: "levels", cadence: a.tested ? "Keep climbing" : "Not tried yet: find your level",
        dueAt: null, status: a.have >= a.need ? "done" : "open", href: `/tracks/${a.slug}`,
      });
    }
  }
  main = [...main, ...manualAsItems(person, at, null, ""), habit];

  const cards: PlanCard[] = [
    { key: "required", kind: "required", id: null, name: "Required learning", blurb: "What you must pass, with due dates", mine: false, plan: build(required, week, null) },
    { key: "main", kind: "main", id: null, name: "Main plan", blurb: mainGoal ? mainGoal.title : "Your career goal and what the Career doctor points to", mine: false, plan: build(main, week, mainGoal) },
  ];

  // 3. extra plans: each with its own target (worked out like the main goal) and its own items
  for (const p of plansOf(person.id)) {
    let items: PlanItem[] = [], goal: PlanGoal | null = null, blurb = "A list of things to do";
    if (p.targetRole && p.targetLevel != null && p.targetDate != null) {
      const own: Goal = { id: 0, userId: person.id, targetRole: p.targetRole, targetLevel: p.targetLevel, targetDate: p.targetDate, createdAt: p.createdAt };
      const pj = journeyFor(person, undefined, at, own);
      if (pj.state === "ok") { ({ items, goal } = goalItems(pj, `p${p.id}-`)); blurb = `${goal?.title ?? pj.target.title} by ${new Date(p.targetDate * 1000).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`; }
      else blurb = "The route to this target no longer exists from where you are";
    }
    items = [...items, ...manualAsItems(person, at, p.id, `p${p.id}-`)];
    cards.push({ key: `p${p.id}`, kind: "extra", id: p.id, name: p.name, blurb, mine: p.createdBy === person.id, plan: build(items, week, goal) });
  }

  // everything together: a subject in two plans counts once, under its most urgent row
  const seenTrack = new Set<number>(), all: PlanItem[] = [];
  for (const i of cards.flatMap((c) => c.plan.items).sort(byUrgency)) {
    if (i.track != null) { if (seenTrack.has(i.track)) continue; seenTrack.add(i.track); }
    all.push(i);
  }
  return { all: build(all, week, mainGoal), cards };
}

/** One plan with everything in it: what most places that only need the total use. */
export const planFor = (person: Person, at = now()): Plan => planSetFor(person, at).all;

/** Subjects that are overdue or behind in any plan, so a plan never calls one of them a strength while another plan has it late. */
export function lateTracksOf(cards: PlanCard[]): Set<number> {
  const out = new Set<number>();
  for (const c of cards) for (const i of c.plan.items) if (i.track != null && (i.status === "overdue" || i.status === "behind")) out.add(i.track);
  return out;
}

/** The plan that most needs attention: the most overdue, then the most behind, then the least done. Plans with nothing left to do are ignored. */
export function needsMost(cards: PlanCard[]): PlanCard | null {
  const open = cards.filter((c) => c.plan.items.some((i) => i.status !== "done" && i.source !== "habit"));
  const score = (c: PlanCard) => [c.plan.items.filter((i) => i.status === "overdue").length, c.plan.items.filter((i) => i.status === "behind").length, -(c.plan.done / Math.max(c.plan.total, 1))];
  return open.sort((a, b) => { const x = score(a), y = score(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; })[0] ?? null;
}

const GLANCE_TTL = 60;
const glance = new Map<number, { at: number; set: PlanSet }>();
/**
 * The plans for the small summary on the dashboard, reused for a minute per person so every page view does not redo the work.
 * The full /plan page always works them out fresh, so what someone just did there is never stale where it matters.
 */
export function planGlanceFor(person: Person, at = now()): PlanSet {
  const hit = glance.get(person.id);
  if (hit && at - hit.at < GLANCE_TTL) return hit.set;
  if (glance.size > 2000) glance.clear(); // a small bound: this is a cache, not a store
  const set = planSetFor(person, at);
  glance.set(person.id, { at, set });
  return set;
}

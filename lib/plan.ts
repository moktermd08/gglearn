import { type users } from "@/lib/db";
import { diagnose } from "@/lib/careerDoctor";
import { journeyFor, roleLabel } from "@/lib/journey";
import { requirementsFor, scopesOf } from "@/lib/paths";
import { factsOf } from "@/lib/progression";
import { manualItemsFor } from "@/lib/planItems";

type Person = typeof users.$inferSelect;

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
/** Active days in a week we ask for: enough to build the habit, not so many that a missed day feels like failure. */
export const WEEKLY_DAYS_TARGET = 4;

export type PlanSource = "required" | "goal" | "doctor" | "manual" | "habit";
export type PlanStatus = "done" | "overdue" | "behind" | "on-track" | "open";
export type PlanItem = {
  key: string;
  /** set for manual items: the plan_items row, and whether the person added it themself (they may remove it) */
  manual?: { id: number; mine: boolean; period: "once" | "weekly"; signedOff: boolean };
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
export type Plan = {
  items: PlanItem[];
  /** the few things to do first */
  focus: PlanItem[];
  done: number;
  total: number;
  week: { activeDays: number; target: number; streakDays: number[] };
  goal: { title: string; from: string; status: string | null; perWeekNeeded: number; perWeekNow: number; targetDate: number | null } | null;
};

const RANK: Record<PlanStatus, number> = { overdue: 0, behind: 1, open: 2, "on-track": 3, done: 4 };

/**
 * Everything someone has to do, in one list, worked out from data the app already keeps (goal, required learning, exam results, activity).
 * Nothing is stored, so it cannot drift from what really happened and costs a few reads per page view.
 */
export function planFor(person: Person, at = now()): Plan {
  const items: PlanItem[] = [];
  const seen = new Set<number>(); // a subject shown once, under the most urgent reason

  // 1. required learning: has a due date, so overdue is a real status
  for (const r of requirementsFor(person, scopesOf(person.id))) {
    seen.add(r.track.id);
    const daysLeft = Math.ceil((r.dueAt - at) / DAY);
    items.push({
      key: `req-${r.track.id}`, source: "required", title: r.track.name,
      why: r.why === "role" ? "Required for your role" : "Required for everyone",
      have: Math.min(r.passed, r.track.requiredLevel), need: r.track.requiredLevel, unit: "levels",
      cadence: r.done ? "Complete" : r.overdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue` : `Due in ${Math.max(daysLeft, 0)} day${daysLeft === 1 ? "" : "s"}`,
      dueAt: r.dueAt, status: r.done ? "done" : r.overdue ? "overdue" : "open", href: `/tracks/${r.track.slug}`,
    });
  }

  // 2. the goal: each subject still to pass on the way, once, at the highest level any step asks
  const j = journeyFor(person);
  let goal: Plan["goal"] = null;
  if (j.state === "ok") {
    const behind = j.pace?.status === "behind" || j.pace?.status === "past-date";
    const byTrack = new Map<number, { s: (typeof j.legs)[number]["steps"][number]; need: number; dueAt: number | null; leg: string }>();
    for (const l of j.legs) for (const s of l.steps) {
      if (!s.countable) continue;
      const have = byTrack.get(s.track.id);
      if (!have || s.need > have.need) byTrack.set(s.track.id, { s, need: s.need, dueAt: have?.dueAt ?? l.dueAt, leg: have?.leg ?? l.title });
    }
    for (const { s, need, dueAt, leg } of byTrack.values()) {
      if (seen.has(s.track.id) && s.passed < need) { /* also asked by the goal: keep the required row, it is the stricter one */ continue; }
      const done = s.passed >= need;
      if (done && !j.goal) continue; // without a goal there is nothing to celebrate yet
      seen.add(s.track.id);
      items.push({
        key: `goal-${s.track.id}`, source: "goal", title: s.track.name,
        why: `For ${leg}${j.goal ? ` on the way to ${j.target.title}` : ""}`,
        have: Math.min(s.passed, need), need, unit: "levels",
        cadence: j.goal && dueAt ? `Finish by ${new Date(dueAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Pass at your own pace",
        dueAt: j.goal ? dueAt : null, status: done ? "done" : behind ? "behind" : j.pace?.status === "on-track" ? "on-track" : "open", href: `/tracks/${s.track.slug}`,
      });
    }
    if (j.goal && j.pace) {
      goal = {
        title: `${j.here.title} → ${j.target.title}`, from: roleLabel(j.here.role), status: j.pace.status,
        perWeekNeeded: j.pace.perWeekNeeded, perWeekNow: j.pace.perWeekNow, targetDate: j.goal.targetDate,
      };
    }
  }

  // 3. no goal yet: the Career doctor's strongest direction says what to try first
  if (j.state !== "ok" || !j.goal) {
    const fam = diagnose(person).families[0];
    const top = fam?.roles[0];
    if (top) for (const a of top.areas) {
      if (seen.has(a.trackId)) continue;
      seen.add(a.trackId);
      items.push({
        key: `doc-${a.slug}`, source: "doctor", title: a.name, why: `Career doctor: needed for ${top.name}`,
        have: Math.min(a.have, a.need), need: a.need, unit: "levels", cadence: a.tested ? "Keep climbing" : "Not tried yet: find your level",
        dueAt: null, status: a.have >= a.need ? "done" : "open", href: `/tracks/${a.slug}`,
      });
    }
  }

  // 4. things a manager set, or the person added, that the app cannot detect
  for (const m of manualItemsFor(person.id, at)) {
    const date = m.dueAt ? new Date(m.dueAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
    items.push({
      key: `man-${m.id}`, source: "manual", title: m.title, why: m.note ? `${m.setBy}: ${m.note}` : `Set by ${m.setBy}`,
      have: m.have, need: m.need, unit: m.period === "weekly" ? "this week" : m.need === 1 ? "time" : "times",
      cadence: m.signedOff ? "Signed off" : m.period === "weekly" ? `${m.need} a week, every week` : date ? `${m.need} in total, by ${date}` : `${m.need} in total`,
      dueAt: m.dueAt, status: m.done ? "done" : m.overdue ? "overdue" : "open", href: "/plan",
      manual: { id: m.id, mine: m.mine, period: m.period, signedOff: m.signedOff },
    });
  }

  // 5. the habit: how often you showed up this week, from the activity the app already records
  const days = factsOf(person.id).days;
  const week = Array.from({ length: 7 }, (_, i) => new Date((at - (6 - i) * DAY) * 1000).toISOString().slice(0, 10));
  const hits = week.filter((d) => days.has(d)).length;
  items.push({
    key: "habit", source: "habit", title: "Study days this week", why: "Little and often beats long and rare",
    have: Math.min(hits, WEEKLY_DAYS_TARGET), need: WEEKLY_DAYS_TARGET, unit: "days",
    cadence: `${WEEKLY_DAYS_TARGET} days a week`, dueAt: null, status: hits >= WEEKLY_DAYS_TARGET ? "done" : hits === 0 ? "behind" : "on-track", href: "/dashboard",
  });

  items.sort((a, b) => RANK[a.status] - RANK[b.status] || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.title.localeCompare(b.title));
  const open = items.filter((i) => i.status !== "done" && i.source !== "habit");
  return {
    items, focus: open.slice(0, 3), done: items.filter((i) => i.status === "done").length, total: items.length,
    week: { activeDays: hits, target: WEEKLY_DAYS_TARGET, streakDays: week.map((d, i) => (days.has(d) ? i : -1)).filter((i) => i >= 0) },
    goal,
  };
}

const GLANCE_TTL = 60;
const glance = new Map<number, { at: number; plan: Plan }>();
/**
 * The plan for the small summary on the dashboard, reused for a minute per person so every page view does not redo the work.
 * The full /plan page always works it out fresh, so what someone just did there is never stale where it matters.
 */
export function planGlanceFor(person: Person, at = now()): Plan {
  const hit = glance.get(person.id);
  if (hit && at - hit.at < GLANCE_TTL) return hit.plan;
  if (glance.size > 2000) glance.clear(); // a small bound: this is a cache, not a store
  const plan = planFor(person, at);
  glance.set(person.id, { at, plan });
  return plan;
}

import { and, eq, gte } from "drizzle-orm";
import { careerBridges, careerGoals, careerLevels, db, runs, users } from "@/lib/db";
import { levelsEarned } from "@/lib/progress";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { careerFor, ladderFor, type Step } from "@/lib/careers";

type Person = typeof users.$inferSelect;
export type Goal = typeof careerGoals.$inferSelect;

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const PACE_WINDOW_DAYS = 28;

const SPECIAL: Record<string, string> = { devops: "DevOps", cto: "CTO", ceo: "CEO", hr: "HR" };
/** "hr manager" -> "HR Manager" */
export const roleLabel = (role: string) => role.split(" ").map((w) => SPECIAL[w] ?? w[0].toUpperCase() + w.slice(1)).join(" ");

/** Level N of a ladder. On an individual-contributor ladder it is ICN in the career framework. The sub-level says how far through the level someone is. */
export const levelCode = (level: number, sub?: 0 | 1 | 2) => `L${level}${sub === undefined ? "" : `.${sub}`}`;
export const subLevelOf = (done: number, total: number): 0 | 1 | 2 => (total === 0 ? 0 : done / total >= 0.75 ? 2 : done / total >= 0.5 ? 1 : 0);

type Node = { role: string; level: number };
const key = (n: Node) => `${n.role}|${n.level}`;

/**
 * Every place someone can get to from `from`: up their own ladder one level at a time, and across a bridge into another
 * role's ladder (from any level at or above the bridge's). Breadth first, so each place is reached by the fewest moves.
 */
function reach(from: Node): Map<string, Node | null> {
  const levels = db.select({ r: careerLevels.jobRole, l: careerLevels.level }).from(careerLevels).all();
  const exists = new Set(levels.map((l) => key({ role: l.r, level: l.l })));
  const bridges = db.select().from(careerBridges).all();
  const parent = new Map<string, Node | null>([[key(from), null]]);
  const queue: Node[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    const out: Node[] = [{ role: n.role, level: n.level + 1 }];
    for (const b of bridges) if (b.fromRole === n.role && n.level >= b.fromLevel) out.push({ role: b.toRole, level: b.toLevel });
    for (const o of out) if (exists.has(key(o)) && !parent.has(key(o))) { parent.set(key(o), n); queue.push(o); }
  }
  return parent;
}

const pathTo = (parent: Map<string, Node | null>, to: Node): Node[] | null => {
  if (!parent.has(key(to))) return null;
  const path: Node[] = [];
  for (let n: Node | null = to; n; n = parent.get(key(n)) ?? null) path.unshift(n);
  return path;
};

/** The places to pass through from where this person is to `role` at `level` (their own first), or null when it cannot be reached. */
export function pathFor(person: Person, role: string, level: number, cat = catalog()): { role: string; level: number }[] | null {
  const c = careerFor(person, cat);
  return c ? pathTo(reach({ role: c.role, level: c.current.level }), { role, level }) : null;
}

export type Target = { role: string; label: string; levels: { level: number; title: string }[] };

/** The places this person could aim for, grouped by role. Excludes where they already are. */
export function targetsFor(person: Person): Target[] {
  const c = careerFor(person);
  if (!c) return [];
  const parent = reach({ role: c.role, level: c.current.level });
  const titles = new Map(db.select().from(careerLevels).all().map((l) => [key({ role: l.jobRole, level: l.level }), l.title]));
  const byRole = new Map<string, Target>();
  for (const k of parent.keys()) {
    const [role, lv] = k.split("|"), level = Number(lv);
    if (role === c.role && level <= c.current.level) continue;
    const t = byRole.get(role) ?? { role, label: roleLabel(role), levels: [] };
    t.levels.push({ level, title: titles.get(k) ?? `Level ${level}` });
    byRole.set(role, t);
  }
  return [...byRole.values()].map((t) => ({ ...t, levels: t.levels.sort((a, b) => a.level - b.level) }))
    .sort((a, b) => Number(b.role === c.role) - Number(a.role === c.role) || a.label.localeCompare(b.label));
}

/** The earliest and a default goal date, as yyyy-mm-dd for a date input. */
export function dateBounds(at = now()) {
  const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
  return { tomorrow: iso(at + DAY), nextYear: iso(at + 365 * DAY) };
}

export const goalOf = (userId: number): Goal | undefined => db.select().from(careerGoals).where(eq(careerGoals.userId, userId)).get();

export type LegStep = Step & { open: boolean };
export type Leg = {
  role: string;
  level: number;
  code: string;
  title: string;
  summary: string;
  knowledge: string;
  delivery: string;
  leadership: string;
  /** this leg moves the person onto another role's ladder */
  crossing: boolean;
  steps: LegStep[];
  /** passable steps, and how many are met */
  counted: number;
  met: number;
  /** steps whose questions do not reach the needed level yet */
  soon: number;
  /** levels still to pass in this leg that no earlier leg already asks for */
  work: number;
  /** when to have this leg's learning finished to stay on the goal date */
  dueAt: number | null;
  done: boolean;
};

export type Pace = {
  /** levels still to pass across the whole route (a level needed twice is counted once) */
  work: number;
  daysLeft: number;
  perWeekNeeded: number;
  /** levels passed per week over the last four weeks */
  perWeekNow: number;
  /** when the learning would be done at the current pace */
  projectedAt: number | null;
  status: "no-date" | "learning-done" | "on-track" | "behind" | "not-started" | "past-date";
};

export type Journey =
  | { state: "no-ladder" }
  | { state: "unreachable"; goal: Goal }
  | {
      state: "ok";
      goal: Goal | null;
      /** shown when they have not set a goal: the top of their own ladder */
      target: { role: string; level: number; title: string };
      here: { role: string; level: number; title: string; code: string; sub: 0 | 1 | 2 | null };
      legs: Leg[];
      met: number;
      counted: number;
      soon: number;
      pace: Pace | null;
      /** the next things to do: open steps of the first leg that still has any */
      next: { leg: Leg; steps: LegStep[] } | null;
    };

/** Levels passed in the last few weeks, counting each track and level once. */
function recentPace(userId: number, at: number): number {
  const rows = db.select({ t: runs.trackId, l: runs.level }).from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.passed, true), gte(runs.finishedAt, at - PACE_WINDOW_DAYS * DAY))).all();
  return new Set(rows.map((r) => `${r.t}:${r.l}`)).size / (PACE_WINDOW_DAYS / 7);
}

/** The route from where this person is to their goal, with what is done, what is next and whether the date is realistic. */
export function journeyFor(person: Person, cat = catalog(), at = now()): Journey {
  const c = careerFor(person, cat);
  if (!c) return { state: "no-ladder" };
  const goal = goalOf(person.id) ?? null;
  const from: Node = { role: c.role, level: c.current.level };
  const top = c.ladder[c.ladder.length - 1];
  const to: Node = goal ? { role: goal.targetRole, level: goal.targetLevel } : { role: c.role, level: top.level };
  const nodes = pathTo(reach(from), to);
  if (!nodes) return goal ? { state: "unreachable", goal } : { state: "no-ladder" };

  const scopes = scopesOf(person.id);
  const ladders = new Map<string, ReturnType<typeof ladderFor>>();
  const ladder = (role: string) => ladders.get(role) ?? (ladders.set(role, ladderFor(role, cat)), ladders.get(role)!);
  const earned = new Map<number, number>();
  const passedIn = (trackId: number) => earned.get(trackId) ?? (earned.set(trackId, levelsEarned(person.id, trackId)), earned.get(trackId)!);

  const planned = new Map<number, number>(); // track -> level that earlier legs already ask for
  const legs: Leg[] = nodes.slice(1).map((n, i) => {
    const rung = ladder(n.role).find((r) => r.level === n.level)!;
    // a company's own tracks only count for the people who can see them
    const steps: LegStep[] = rung.steps.filter((s) => inScope(s.track, person.audience, scopes)).map((s) => {
      const passed = passedIn(s.track.id);
      return { ...s, passed, met: passed >= s.need, open: s.countable && passed < s.need };
    });
    const counted = steps.filter((s) => s.countable);
    let work = 0;
    for (const s of counted) {
      work += Math.max(0, s.need - Math.max(passedIn(s.track.id), planned.get(s.track.id) ?? 0));
      planned.set(s.track.id, Math.max(planned.get(s.track.id) ?? 0, s.need));
    }
    return {
      role: n.role, level: n.level, code: levelCode(n.level), title: rung.title, summary: rung.summary,
      knowledge: rung.knowledge, delivery: rung.delivery, leadership: rung.leadership,
      crossing: n.role !== nodes[i].role, steps, counted: counted.length, met: counted.filter((s) => s.met).length,
      soon: steps.length - counted.length, work, dueAt: null, done: counted.every((s) => s.met),
    };
  });

  const work = legs.reduce((a, l) => a + l.work, 0);
  let pace: Pace | null = null;
  if (goal) {
    const daysLeft = Math.ceil((goal.targetDate - at) / DAY), weeks = Math.max(daysLeft, 0) / 7;
    const now7 = recentPace(person.id, at);
    const projectedAt = work === 0 ? at : now7 > 0 ? at + Math.ceil((work / now7) * 7) * DAY : null;
    const status: Pace["status"] = work === 0 ? "learning-done" : daysLeft <= 0 ? "past-date"
      : now7 === 0 ? "not-started" : projectedAt! <= goal.targetDate ? "on-track" : "behind";
    pace = { work, daysLeft, perWeekNeeded: weeks > 0 ? work / weeks : work, perWeekNow: now7, projectedAt: work === 0 ? null : projectedAt, status };
    // spread the dates by how much learning each leg holds
    let cum = 0;
    for (const l of legs) { cum += l.work; l.dueAt = work === 0 ? goal.targetDate : at + Math.round(((goal.targetDate - at) * cum) / work); }
  }

  const first = legs.find((l) => l.steps.some((s) => s.open));
  const nextLegIdx = first ? legs.indexOf(first) : -1;
  const sub = c.next ? subLevelOf(c.done, c.total) : null;
  return {
    state: "ok", goal, target: { role: to.role, level: to.level, title: legs.at(-1)?.title ?? c.current.title },
    here: { role: c.role, level: c.current.level, title: c.current.title, code: levelCode(c.current.level, sub ?? undefined), sub },
    legs, met: legs.reduce((a, l) => a + l.met, 0), counted: legs.reduce((a, l) => a + l.counted, 0), soon: legs.reduce((a, l) => a + l.soon, 0),
    pace, next: nextLegIdx >= 0 ? { leg: legs[nextLegIdx], steps: legs[nextLegIdx].steps.filter((s) => s.open) } : null,
  };
}

/** Is `role|level` somewhere this person can actually get to? Used to check a goal before saving it. */
export function canReach(person: Person, role: string, level: number): boolean {
  const c = careerFor(person);
  if (!c) return false;
  if (role === c.role && level <= c.current.level) return false;
  return reach({ role: c.role, level: c.current.level }).has(key({ role, level }));
}

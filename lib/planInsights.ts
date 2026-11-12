import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db, planItems, planLogs, runs, tracks, type users } from "@/lib/db";
import { factsOf } from "@/lib/progression";
import type { Plan, PlanItem } from "@/lib/plan";
import { topicLabel } from "@/lib/topicName";

type Person = typeof users.$inferSelect;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

/**
 * What a plan says about someone, read off its items and their activity: where they are strong, where the gaps are, what falls today, this week
 * and this month, and what they have just done. Nothing here is stored: it is worked out from the plan and from exams and logs already recorded.
 */
export type Insight = { title: string; detail: string; href: string };
export type Insights = {
  summary: string;
  strengths: Insight[];
  weaknesses: Insight[];
  today: { studied: boolean; items: PlanItem[] };
  week: { due: PlanItem[]; levels: number; levelsNeeded: number | null; days: { active: number; target: number } };
  month: { due: PlanItem[]; levels: number; levelsNeeded: number | null };
};
export type Activity = { at: number; text: string; href: string; ago: string };
const agoText = (sec: number, at: number) => { const d = Math.floor((at - sec) / DAY); return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`; };

const isWork = (i: PlanItem) => i.source !== "habit";
const ratio = (i: PlanItem) => (i.need ? i.have / i.need : 0);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Distinct subject levels passed in the last `days` days: how much real progress was made. */
export function levelsPassedSince(userId: number, days: number, at = now()): number {
  const rows = db.select({ t: runs.trackId, l: runs.level }).from(runs).where(and(eq(runs.userId, userId), eq(runs.passed, true), gte(runs.finishedAt, at - days * DAY))).all();
  return new Set(rows.map((r) => `${r.t}:${r.l}`)).size;
}

/** The best exam score and the latest pass in each of these subjects: what breaks a tie between two equally advanced strengths. */
function bestResults(userId: number, trackIds: number[]): Map<number, { score: number; last: number }> {
  if (!trackIds.length) return new Map();
  const rows = db.select({ t: runs.trackId, score: sql<number>`max(${runs.score})`, last: sql<number>`max(${runs.finishedAt})` }).from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.passed, true), inArray(runs.trackId, trackIds))).groupBy(runs.trackId).all();
  return new Map(rows.map((r) => [r.t, { score: Number(r.score ?? 0), last: Number(r.last ?? 0) }]));
}

/**
 * `late` is the subjects that are overdue or behind in ANY of the person's plans: a subject that is late somewhere is never called a strength,
 * even in a plan where it looks fine, so two plans cannot disagree about it.
 */
export function insightsFor(person: Person, plan: Plan, at = now(), late: ReadonlySet<number> = new Set()): Insights {
  const work = plan.items.filter(isWork);
  const open = work.filter((i) => i.status !== "done");
  const overdue = work.filter((i) => i.status === "overdue"), behind = work.filter((i) => i.status === "behind");
  const isLate = (i: PlanItem) => i.status === "overdue" || i.status === "behind" || (i.track != null && late.has(i.track));
  const best = bestResults(person.id, work.flatMap((i) => (i.track != null ? [i.track] : [])));
  const bestOf = (i: PlanItem) => (i.track != null ? best.get(i.track) : undefined);

  // strengths: what is done or well on the way, and not late anywhere. Ties go to the better exam score, then the more recent pass.
  const strengths: Insight[] = work.filter((i) => i.have > 0 && !isLate(i))
    .sort((a, b) => ratio(b) - ratio(a) || (bestOf(b)?.score ?? 0) - (bestOf(a)?.score ?? 0) || (bestOf(b)?.last ?? 0) - (bestOf(a)?.last ?? 0) || b.have - a.have || a.title.localeCompare(b.title)).slice(0, 3)
    .map((i) => ({ title: i.title, detail: `${i.status === "done" ? `Done: ${i.have} of ${i.need} ${i.unit}` : `${i.have} of ${i.need} ${i.unit}${ratio(i) >= 0.5 ? ", well on the way" : ", making progress"}`}${bestOf(i) ? ` · best score ${Math.round(bestOf(i)!.score * 100)}%` : ""}`, href: i.href }));
  const habit = plan.items.find((i) => i.source === "habit");
  if (habit && habit.status === "done") strengths.push({ title: "Study habit", detail: `${habit.have} of ${habit.need} days this week`, href: habit.href });

  // weaknesses: late first, then the widest gaps (an untried area is a gap too)
  const gap = (i: PlanItem) => (i.need - i.have) * (i.have === 0 ? 1.2 : 1);
  const weaknesses: Insight[] = [...overdue, ...behind, ...open.filter((i) => isLate(i) && i.status !== "overdue" && i.status !== "behind"), ...open.filter((i) => !isLate(i)).sort((a, b) => gap(b) - gap(a))]
    .filter((i, n, all) => all.indexOf(i) === n && !strengths.some((s) => s.title === i.title)).slice(0, 3) // nobody is both a strength and a gap
    .map((i) => ({ title: i.title, detail: `${i.have} of ${i.need} ${i.unit} · ${i.cadence}${i.have === 0 && i.status !== "overdue" ? " · not started" : ""}`, href: i.href }));
  if (habit && habit.status === "behind") weaknesses.push({ title: "Study habit", detail: `${habit.have} of ${habit.need} days this week: little and often beats long and rare`, href: habit.href });

  const dueBy = (days: number) => open.filter((i) => i.dueAt != null && i.dueAt <= at + days * DAY).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)).slice(0, 8);
  const weekDue = dueBy(7), monthDue = dueBy(30);
  const needed = plan.goal && plan.goal.perWeekNeeded > 0 ? plan.goal.perWeekNeeded : null;
  const today = new Date(at * 1000).toISOString().slice(0, 10);

  const weekLevels = levelsPassedSince(person.id, 7, at), nothingStarted = work.every((i) => i.have === 0), quiet = plan.week.activeDays === 0 && weekLevels === 0;
  const lead = overdue.length ? `${plural(overdue.length, "item")} overdue` : behind.length ? `${plural(behind.length, "item")} behind` : work.length && !open.length ? "Everything done" : nothingStarted ? "Not started yet" : plan.goal ? "On track" : "Making progress"; // "on track" needs a goal to be on track to
  const bits = [lead, strengths[0] && `strongest: ${strengths[0].title}`, weaknesses[0] && `weakest: ${weaknesses[0].title}`, weekDue.length && `${weekDue.length} due this week or already late`, quiet && !nothingStarted && "no activity in the last 7 days"].filter(Boolean) as string[];
  return {
    summary: bits.join(" · "),
    strengths, weaknesses,
    today: { studied: factsOf(person.id).days.has(today), items: plan.focus.slice(0, 2) },
    week: { due: weekDue, levels: weekLevels, levelsNeeded: needed, days: { active: plan.week.activeDays, target: plan.week.target } },
    month: { due: monthDue, levels: levelsPassedSince(person.id, 28, at), levelsNeeded: needed ? needed * 4 : null },
  };
}

/** The last things this person did: exams finished and plan items logged, newest first. */
export function recentActivityFor(person: Person, limit = 10, at = now()): Activity[] {
  const since = at - 30 * DAY;
  const exams = db.select({ t: runs.trackId, l: runs.level, score: runs.score, passed: runs.passed, at: runs.finishedAt }).from(runs)
    .where(and(eq(runs.userId, person.id), isNotNull(runs.finishedAt), gte(runs.finishedAt, since))).orderBy(desc(runs.finishedAt)).limit(limit * 4).all(); // more than shown, because repeats of one exam are folded into one line
  const names = new Map(exams.length ? db.select({ id: tracks.id, name: tracks.name, slug: tracks.slug }).from(tracks).where(inArray(tracks.id, [...new Set(exams.map((e) => e.t))])).all().map((t) => [t.id, t]) : []);
  // the same subject and level, with the same outcome, is one line: the latest time, the best score, and how many times
  const folded = new Map<string, { e: (typeof exams)[number]; best: number | null; n: number }>();
  for (const e of exams) {
    const k = `${e.t}:${e.l}:${e.passed ? 1 : 0}`, f = folded.get(k);
    if (!f) folded.set(k, { e, best: e.score, n: 1 });
    else { f.n++; if (e.score != null) f.best = Math.max(f.best ?? 0, e.score); }
  }
  const out: Activity[] = [...folded.values()].map(({ e, best, n }) => {
    const t = names.get(e.t), pct = best != null ? ` (${n > 1 ? "best " : ""}${Math.round(best * 100)}%)` : "";
    return { at: e.at!, text: `${e.passed ? "Passed" : "Tried"} ${t ? topicLabel(t.name) : "a subject"} level ${e.l}${pct}${n > 1 ? ` · ${n} times` : ""}`, href: t ? `/tracks/${t.slug}` : "/dashboard", ago: agoText(e.at!, at) };
  });
  const logs = db.select({ at: planLogs.at, title: planItems.title }).from(planLogs).innerJoin(planItems, eq(planLogs.itemId, planItems.id))
    .where(and(eq(planItems.userId, person.id), gte(planLogs.at, since))).orderBy(desc(planLogs.at)).limit(limit).all();
  for (const l of logs) out.push({ at: l.at, text: `Logged: ${l.title}`, href: "/plan", ago: agoText(l.at, at) });
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

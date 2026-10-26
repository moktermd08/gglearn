import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, questions, routeAreaResults, routeAssessments, routePlans, routeTasks, tracks, users } from "@/lib/db";
import type { RouteAnswers } from "@/lib/db/schema";
import { levelsPassed } from "@/lib/progress";
import { scoreBatch, nextProbe } from "@/lib/placement";
import { openTo } from "@/lib/paths";
import fs from "node:fs";
import path from "node:path";
import { roleTarget } from "@/lib/routeRole";

type Person = typeof users.$inferSelect;
type Assessment = typeof routeAssessments.$inferSelect;
type AreaRow = typeof routeAreaResults.$inferSelect;

/** A route check asks fewer questions than a placement check, so a person can finish in one sitting. Both must be right to move up a level. */
export const ROUTE_BATCH = 2;

export type TargetArea = {
  key: string; label: string; why: string; trackSlug: string; target: number;
  /** used by the roadmap (lib/roadmap.ts): learning hours a level takes, which stage it belongs to, how much it matters (1 = most), and the self-rating that slows it down */
  hoursPerLevel?: number; stage?: number; priority?: number; confidence?: string; // "digital" or "writing", a key of the questionnaire answers
};
export type TargetStage = { n: number; label: string; blurb: string };
export type TargetAction = { key: string; label: string; detail: string; stage: number; hours: number; priority?: number; earlyIf?: { workRights: string[] } };
/** Only for jobs that depend on the right to work somewhere: the question is asked, and these are the warnings for "no" and "not sure". Leave it out and the question is not asked. */
export type RightToWork = { ask: string; why: string; no: string; unsure: string };
/** "entry" (the default) asks about education and work history; "promotion" is for someone already in work, so those questions are not asked. */
export type TargetKind = "entry" | "promotion";
export type Target = {
  slug: string; title: string; short: string; summary: string; kind?: TargetKind; areas: TargetArea[]; rightToWork?: RightToWork;
  stages?: TargetStage[]; actions?: TargetAction[]; apply?: { label: string; detail: string };
};

/** The jobs someone can check themselves against: every content/targets/<slug>.json. A file that does not parse, or has no areas, is simply not offered. */
function loadTargets(): Target[] {
  const dir = path.join(process.cwd(), "content", "targets");
  const out: Target[] = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json") && !n.startsWith("_")).sort()) {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Target;
      if (t.slug === f.slice(0, -5) && t.title && t.areas?.length) out.push(t);
    } catch { /* not offered */ }
  }
  return out;
}
export const TARGETS: Target[] = loadTargets();
/** A listed job, or a route to a rung of any career ladder (slug role--<role>--<level>, see lib/routeRole.ts). */
export const targetBySlug = (slug: string) => TARGETS.find((t) => t.slug === slug) ?? roleTarget(slug);

/** Kinds of unpaid experience offered in the questionnaire. */
export const UNPAID: { key: string; label: string }[] = [
  { key: "parenting", label: "Bringing up children" },
  { key: "caring", label: "Caring for a relative or neighbour" },
  { key: "household", label: "Running a household budget" },
  { key: "volunteering", label: "Volunteering" },
  { key: "school", label: "Helping at a school, nursery or club" },
  { key: "committee", label: "Community group, committee or fundraising" },
  { key: "study", label: "Courses or study" },
];

/** Can every level from 1 to `target` be checked? A topic missing a level would leave the person placed lower than they really are, so it is not checked at all. */
function checkable(trackId: number, target: number): boolean {
  const have = new Map(db.select({ l: questions.level, n: sql<number>`count(*)` }).from(questions)
    .where(and(eq(questions.trackId, trackId), eq(questions.type, "mcq"), eq(questions.status, "active"))).groupBy(questions.level).all().map((r) => [r.l, r.n]));
  for (let l = 1; l <= target; l++) if ((have.get(l) ?? 0) < ROUTE_BATCH) return false;
  return true;
}

export type ResolvedArea = TargetArea & { trackId: number | null; trackName: string | null;
  /** false while the topic does not exist here or has too few multiple-choice questions to check someone fairly; the area is left out of the check */
  available: boolean };

/** Each area of the target tied to its topic, and whether it can be checked here. */
export function resolveAreas(target: Target, person: Pick<Person, "audience">): ResolvedArea[] {
  const slugs = target.areas.map((a) => a.trackSlug);
  const rows = new Map(db.select({ id: tracks.id, slug: tracks.slug, name: tracks.name, audience: tracks.audience }).from(tracks).where(inArray(tracks.slug, slugs)).all().map((t) => [t.slug, t]));
  return target.areas.map((a) => {
    const t = rows.get(a.trackSlug);
    const open = !!t && openTo(person.audience, t.audience);
    const ok = open && checkable(t.id, a.target);
    return { ...a, trackId: open ? t.id : null, trackName: open ? t.name : null, available: ok };
  });
}

export const assessmentFor = (userId: number, slug: string) =>
  db.select().from(routeAssessments).where(and(eq(routeAssessments.userId, userId), eq(routeAssessments.targetSlug, slug))).get() ?? null;

export const areaRows = (assessmentId: number) => db.select().from(routeAreaResults).where(eq(routeAreaResults.assessmentId, assessmentId)).orderBy(asc(routeAreaResults.id)).all();

const now = () => Math.floor(Date.now() / 1000);

/** Settle an area: pending cleared and the level recorded. */
function settle(row: AreaRow, placed: number) {
  db.update(routeAreaResults).set({ placed, lo: placed, hi: placed, pending: null }).where(eq(routeAreaResults.id, row.id)).run();
}

/** Draws the next batch for an area, or settles it when the search has narrowed to one level or no more levels can be tested. */
function probeOrSettle(row: AreaRow, trackId: number) {
  const probe = row.lo < row.hi ? nextProbe({ lo: row.lo, hi: row.hi, trackId }, ROUTE_BATCH) : null;
  if (probe) db.update(routeAreaResults).set({ round: row.round + 1, pending: probe.ids }).where(eq(routeAreaResults.id, row.id)).run();
  else settle(row, row.lo);
}

/**
 * Makes sure the first unfinished area has a batch waiting, and marks the assessment complete when every area is done.
 * Called after anything that could change which area is next, so a page never has to write.
 */
export function advance(a: Assessment, areas: ResolvedArea[]) {
  const byKey = new Map(areaRows(a.id).map((r) => [r.areaKey, r]));
  for (const area of areas) {
    const row = byKey.get(area.key);
    if (!row || row.placed !== null || !area.trackId) continue;
    if (!row.pending?.length) probeOrSettle(row, area.trackId);
    // a batch may have settled the area straight away (nothing to test); keep looking for one that needs asking
    const fresh = db.select().from(routeAreaResults).where(eq(routeAreaResults.id, row.id)).get()!;
    if (fresh.placed === null) return;
  }
  db.update(routeAssessments).set({ status: "complete", completedAt: now(), updatedAt: now() }).where(eq(routeAssessments.id, a.id)).run();
}

export type StartInput = { horizonMonths: number; hoursPerWeek: number; answers: RouteAnswers };

/** Creates (or restarts) the assessment: one row per area that can be checked. Levels someone has already passed by exam are the floor of each search. */
export function startAssessment(person: Person, target: Target, input: StartInput): Assessment {
  const areas = resolveAreas(target, person);
  const a = db.transaction((tx) => {
    const have = tx.select().from(routeAssessments).where(and(eq(routeAssessments.userId, person.id), eq(routeAssessments.targetSlug, target.slug))).get();
    const values = { horizonMonths: input.horizonMonths, hoursPerWeek: input.hoursPerWeek, answers: input.answers, status: "in_progress" as const, completedAt: null, updatedAt: now() };
    const row = have
      ? (tx.update(routeAssessments).set(values).where(eq(routeAssessments.id, have.id)).returning().get())
      : tx.insert(routeAssessments).values({ userId: person.id, targetSlug: target.slug, ...values }).returning().get();
    tx.delete(routeAreaResults).where(eq(routeAreaResults.assessmentId, row.id)).run();
    tx.delete(routePlans).where(eq(routePlans.assessmentId, row.id)).run(); // a plan belongs to the results it was made from
    tx.delete(routeTasks).where(eq(routeTasks.assessmentId, row.id)).run();
    for (const area of areas) {
      if (!area.trackId) continue;
      if (!area.available) continue;
      const known = Math.min(levelsPassed(person.id, area.trackId), area.target);
      tx.insert(routeAreaResults).values({ assessmentId: row.id, areaKey: area.key, lo: known, hi: area.target, placed: known >= area.target ? known : null }).run();
    }
    return row;
  });
  advance(a, areas);
  return db.select().from(routeAssessments).where(eq(routeAssessments.id, a.id)).get()!;
}

/** The area being asked about now: first unfinished one with a batch waiting. */
export function currentArea(areas: ResolvedArea[], rows: AreaRow[]): { area: ResolvedArea; row: AreaRow } | null {
  const byKey = new Map(rows.map((r) => [r.areaKey, r]));
  for (const area of areas) {
    const row = byKey.get(area.key);
    if (row && row.placed === null) return { area, row };
  }
  return null;
}

/** Marks the posted answers for the current area and moves the search on. */
export function answerCurrent(a: Assessment, areas: ResolvedArea[], answerFor: (id: number) => string) {
  const cur = currentArea(areas, areaRows(a.id));
  if (!cur || !cur.row.pending?.length) return;
  const { right, level } = scoreBatch(cur.row.pending, answerFor);
  let { lo, hi } = cur.row;
  if (level >= 1) { if (right >= ROUTE_BATCH) lo = Math.max(lo, level); else hi = Math.min(hi, level - 1); }
  db.update(routeAreaResults).set({ lo, hi, pending: null }).where(eq(routeAreaResults.id, cur.row.id)).run();
  advance(a, areas);
}

/** "I do not know this at all": leaves the area at what exams have already proven and moves on. */
export function skipCurrent(a: Assessment, areas: ResolvedArea[]) {
  const cur = currentArea(areas, areaRows(a.id));
  if (cur) settle(cur.row, cur.row.lo);
  advance(a, areas);
}

export type AreaResult = ResolvedArea & { placed: number | null };

/** Every area with where the person stands in it (null while unchecked or when the area cannot be checked here). */
export function resultsFor(a: Assessment, areas: ResolvedArea[]): AreaResult[] {
  const byKey = new Map(areaRows(a.id).map((r) => [r.areaKey, r.placed]));
  return areas.map((area) => ({ ...area, placed: byKey.get(area.key) ?? null }));
}

/** The questions of a waiting batch, in the order drawn. */
export function batchQuestions(ids: number[]) {
  const rows = ids.length ? db.select().from(questions).where(inArray(questions.id, ids)).all() : [];
  const byId = new Map(rows.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
}


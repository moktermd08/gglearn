/** Checks the career route roadmap: npm run check:roadmap (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { brands, db, mentorships, questions, routeAreaResults, routeAssessments, routePlans, routeTasks, tracks, users } from "../lib/db";
import type { RouteAnswers } from "../lib/db/schema";
import { LOW_CONFIDENCE, WEEK, addMonths, applyWeeksFor, buildPlan, hoursForLevel, overdue, progressOf, type PlanAction, type PlanArea, type PlanInput } from "../lib/roadmap";
import { TARGETS, answerCurrent, areaRows, assessmentFor, currentArea, resolveAreas, startAssessment, type Target } from "../lib/route";
import { createPlan, planFor, routeSummary, routeSummaryFor, setTask, viewPlan } from "../lib/routePlan";
import { menteeSummary } from "../lib/mentoring";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const area = (key: string, current: number, target: number, over: Partial<PlanArea> = {}): PlanArea =>
  ({ key, label: key, trackSlug: `t-${key}`, current, target, hoursPerLevel: 4, stage: 1, priority: 1, ...over });
const action = (key: string, stage: number, hours: number, done = false, priority = 0): PlanAction => ({ key, label: key, detail: "", stage, hours, priority, done });
const input = (weeks: number, hoursPerWeek: number, areas: PlanArea[], actions: PlanAction[] = []): PlanInput => ({ weeks, hoursPerWeek, areas, actions });
const gapAreas = () => [area("a", 0, 4, { stage: 1, priority: 3 }), area("b", 0, 6, { stage: 2, priority: 1, hoursPerLevel: 5 }), area("c", 2, 5, { stage: 3, priority: 2 }), area("d", 0, 5, { stage: 4, priority: 4 })];

// plenty of time: everything fits and ends well before the finish
const easy = buildPlan(input(156, 8, gapAreas(), [action("x", 1, 2)]));
check("with three years the plan is comfortable", easy.verdict === "comfortable" && easy.deferred.length === 0);
check("every gap is planned up to its target", easy.items.filter((i) => i.kind === "learn").every((i) => i.kind === "learn" && i.toLevel === i.targetLevel));
check("items run one after another with no overlap", easy.items.every((it, i) => i === 0 ? it.startWeek === 0 : Math.abs(it.startWeek - easy.items[i - 1].endWeek) < 1e-9));
check("stages stay in order", easy.items.every((it, i) => i === 0 || it.stage >= easy.items[i - 1].stage));
check("it is ready to apply well before the end", easy.readyWeek < easy.totalWeeks - easy.applyWeeks);
check("a plan never plans more than the hours the person has", easy.plannedHours <= easy.capacityHours + 1e-6);

// not enough time: the most important area is kept, the rest are deferred, and the plan says what would fit
const squeeze = buildPlan(input(4.3, 5, gapAreas(), [action("x", 1, 1)]));
check("one month with these gaps is too tight", squeeze.verdict === "too-tight");
check("something is deferred, not silently dropped", squeeze.deferred.length > 0 && squeeze.deferred.every((d) => d.hours > 0 && (d.kind === "action" || d.levels > 0)));
check("the plan fits the hours it does keep", squeeze.plannedHours <= squeeze.capacityHours + 1e-6);
check("the most important area is kept first", squeeze.items.some((i) => i.kind === "learn" && i.key === "b"));
check("it says how many months or hours a week would fit", !!squeeze.advice && squeeze.advice.months > 1 && squeeze.advice.hoursPerWeek > 5);
const months = squeeze.advice!.months;
check("the advised timeframe really is comfortable or tight, not too tight", buildPlan(input(months * 52 / 12, 5, gapAreas(), [action("x", 1, 1)])).verdict !== "too-tight");
check("one month shorter than advised is still too tight", buildPlan(input((months - 1) * 52 / 12, 5, gapAreas(), [action("x", 1, 1)])).verdict === "too-tight");
const hrs = squeeze.advice!.hoursPerWeek;
check("the advised hours a week fit the original timeframe", buildPlan(input(4.3, hrs, gapAreas(), [action("x", 1, 1)])).deferred.length === 0);

// actions compete with learning when time is short, so a long list of set-up steps cannot crowd all the learning out
const crowded = buildPlan(input(4.3, 5, gapAreas(), [action("big", 1, 12, false, 9), action("small", 1, 1, false, 0)]));
check("a low-priority action is deferred before the most important learning", crowded.deferred.some((d) => d.kind === "action" && d.key === "big") && crowded.items.some((i) => i.kind === "learn" && i.key === "b"));
check("a top-priority action is kept", crowded.items.some((i) => i.kind === "action" && i.key === "small"));
check("some learning is planned even when many actions exist", crowded.items.some((i) => i.kind === "learn"));

// in between
const verdicts = [20, 30, 38, 40, 42, 60, 100].map((w) => buildPlan(input(w, 3, gapAreas(), [action("x", 1, 1)])).verdict);
check("as the timeframe grows the verdict goes too tight, tight, comfortable", verdicts[0] === "too-tight" && verdicts.includes("tight") && verdicts[verdicts.length - 1] === "comfortable" && verdicts.indexOf("tight") < verdicts.indexOf("comfortable"));
check("more hours a week means ready to apply sooner", buildPlan(input(52, 12, gapAreas())).readyWeek < buildPlan(input(52, 6, gapAreas())).readyWeek);
check("a longer timeframe never defers more", buildPlan(input(52, 6, gapAreas())).deferred.length <= buildPlan(input(26, 6, gapAreas())).deferred.length);

// details
check("low confidence makes a level take longer", Math.abs(hoursForLevel({ hoursPerLevel: 4, rating: 2 }) - 4 * LOW_CONFIDENCE) < 1e-9 && hoursForLevel({ hoursPerLevel: 4, rating: 3 }) === 4);
check("an area already at its bar is not planned", !buildPlan(input(52, 6, [area("a", 4, 4), area("b", 0, 2)])).items.some((i) => i.key === "a"));
const doneOnly = buildPlan(input(52, 6, [area("a", 4, 4)], [action("x", 1, 2, true), action("y", 2, 1)]));
check("actions already done are left out and listed", !doneOnly.items.some((i) => i.key === "x") && doneOnly.doneActions.join() === "x");
check("with nothing left to learn the plan is ready after the actions", doneOnly.readyWeek > 0 && doneOnly.items.length === 1);
check("the apply time is a fifth of the timeframe within a week and twelve", applyWeeksFor(2) === 1 && applyWeeksFor(30) === 6 && applyWeeksFor(260) === 12);
check("dates add whole months", new Date(addMonths(Date.UTC(2026, 0, 31) / 1000, 1) * 1000).getUTCMonth() === 2 || new Date(addMonths(Date.UTC(2026, 0, 15) / 1000, 1) * 1000).getUTCMonth() === 1);

// behind schedule
const items = easy.items;
const nothingDone = () => false;
check("on day one nobody is behind", !overdue(items, nothingDone, 0).behind);
check("two weeks past an unfinished item is behind", overdue(items, nothingDone, items[0].endWeek + 2.1).behind);
check("a few days past is not behind", !overdue(items, nothingDone, items[0].endWeek + 0.5).behind);
check("finished items are never late", !overdue(items, () => true, 500).behind);

// progress laid over a plan
const none = () => false;
const p0 = progressOf(items, none, 0, easy.totalWeeks);
check("a new plan has nothing done and is on track", p0.stepsDone === 0 && p0.stepsTotal === items.length && p0.status === "on-track" && p0.doneShare === 0 && p0.timeShare === 0);
check("the focus is what starts in the next four weeks, soonest first, at most four", p0.focus.length > 0 && p0.focus.length <= 4 && p0.focus.every((i) => i.startWeek <= 4) && p0.focus.every((i, n) => n === 0 || i.startWeek >= p0.focus[n - 1].startWeek));
const half = new Set(items.slice(0, Math.floor(items.length / 2)).map((i) => i.key));
const p1 = progressOf(items, (i) => half.has(i.key), 1, easy.totalWeeks);
check("done share counts hours, so it is not just steps over steps", p1.doneShare > 0 && p1.doneShare < 1 && p1.stepsDone === half.size);
check("the focus skips what is done", p1.focus.every((i) => !half.has(i.key)));
check("when nothing starts soon the next step is still shown", progressOf(items.map((i) => ({ ...i, startWeek: i.startWeek + 50, endWeek: i.endWeek + 50 })), none, 0, easy.totalWeeks).focus.length === 1);
check("everything done means done, with no focus needed", progressOf(items, () => true, 3, easy.totalWeeks).status === "done");
check("two weeks late is behind", progressOf(items, none, items[0].endWeek + 2.5, easy.totalWeeks).status === "behind");
check("past the finish line it is over", progressOf(items, none, easy.totalWeeks + 1, easy.totalWeeks).status === "over");
check("time share never passes one", progressOf(items, none, 9999, easy.totalWeeks).timeShare === 1);

// the stored plan, against the database
const MAIL = "%@roadmap.check", SLUG = "roadmap-check";
function sweep() {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, MAIL)).all().map((r) => r.id);
  if (ids.length) {
    db.delete(mentorships).where(inArray(mentorships.menteeId, ids)).run();
    const aids = db.select({ id: routeAssessments.id }).from(routeAssessments).where(inArray(routeAssessments.userId, ids)).all().map((r) => r.id);
    if (aids.length) { db.delete(routePlans).where(inArray(routePlans.assessmentId, aids)).run(); db.delete(routeTasks).where(inArray(routeTasks.assessmentId, aids)).run(); db.delete(routeAreaResults).where(inArray(routeAreaResults.assessmentId, aids)).run(); }
    db.delete(routeAssessments).where(inArray(routeAssessments.userId, ids)).run();
    db.delete(users).where(inArray(users.id, ids)).run();
  }
  const ts = db.select({ id: tracks.id }).from(tracks).where(like(tracks.slug, `${SLUG}-%`)).all().map((t) => t.id);
  if (ts.length) { db.delete(questions).where(inArray(questions.trackId, ts)).run(); db.delete(tracks).where(inArray(tracks.id, ts)).run(); }
  db.delete(brands).where(eq(brands.slug, SLUG)).run();
}
sweep();
try {
  const brand = db.insert(brands).values({ slug: SLUG, name: "Roadmap check", kind: "shared" }).returning().get();
  for (const s of ["one", "two"]) {
    const t = db.insert(tracks).values({ brandId: brand.id, slug: `${SLUG}-${s}`, name: s, kind: "process", audience: "staff" }).returning().get();
    for (let l = 1; l <= 4; l++) for (let i = 0; i < 2; i++) db.insert(questions).values({ trackId: t.id, level: l, type: "mcq", prompt: `${s} L${l} Q${i}`, options: [{ key: "a", text: "right" }, { key: "b", text: "wrong" }], answer: "a" }).run();
  }
  const target: Target = {
    slug: "roadmap-check", title: "Check job", short: "Check job", summary: "",
    areas: [
      { key: "one", label: "One", why: "", trackSlug: `${SLUG}-one`, target: 4, hoursPerLevel: 3, stage: 1, priority: 1, confidence: "digital" },
      { key: "two", label: "Two", why: "", trackSlug: `${SLUG}-two`, target: 4, hoursPerLevel: 3, stage: 2, priority: 2 },
    ],
    actions: [
      { key: "setup", label: "Set up", detail: "", stage: 1, hours: 1, priority: 0 },
      { key: "rights", label: "Check rights", detail: "", stage: 3, hours: 1, priority: 6, earlyIf: { workRights: ["no", "unsure"] } },
    ],
  };
  const answers: RouteAnswers = { education: "none", yearsOut: 8, paidWork: "none", unpaid: [], digital: 2, writing: 3, workRights: "unsure" };
  const p = db.insert(users).values({ email: "t-plan@roadmap.check", name: "t-plan", jobRole: "developer", role: "learner" }).returning().get();
  const areas = resolveAreas(target, p);
  let a = startAssessment(p, target, { horizonMonths: 6, hoursPerWeek: 5, answers });
  check("no plan until a finished assessment exists", createPlan(p, target, a) === null);
  let guard = 0;
  while (assessmentFor(p.id, target.slug)!.status === "in_progress" && guard++ < 40) answerCurrent(assessmentFor(p.id, target.slug)!, areas, () => "b"); // all wrong: placed 0 everywhere
  a = assessmentFor(p.id, target.slug)!;
  const t0 = 1_800_000_000;
  const row = createPlan(p, target, a, t0)!;
  check("the plan starts when it was made and runs for the timeframe", row.startsOn === t0 && row.endsOn === addMonths(t0, 6));
  check("it plans every level of both areas", row.plan.items.filter((i) => i.kind === "learn").length === 2 && row.plan.items.every((i) => i.kind !== "learn" || i.fromLevel === 0));
  check("a low computer rating slows the area it applies to", (row.plan.items.find((i) => i.key === "one") as { hours: number }).hours === Math.round(4 * 3 * LOW_CONFIDENCE * 10) / 10);
  check("an open eligibility question moves that step to the start", row.plan.items.find((i) => i.key === "rights")!.stage === 1);
  check("restarting the check removes the old plan", (() => { const b = startAssessment(p, target, { horizonMonths: 6, hoursPerWeek: 5, answers }); return planFor(b.id) === null; })());
  guard = 0;
  while (assessmentFor(p.id, target.slug)!.status === "in_progress" && guard++ < 40) answerCurrent(assessmentFor(p.id, target.slug)!, areas, () => "b");
  a = assessmentFor(p.id, target.slug)!;
  createPlan(p, target, a, t0);
  setTask(a, target, "setup", true);
  setTask(a, target, "not-a-task", true);
  const v0 = viewPlan(p, target, a, t0 + 1)!;
  check("a ticked action shows as done and an unknown key is ignored", v0.items.find((i) => i.key === "setup")!.done && db.select().from(routeTasks).where(eq(routeTasks.assessmentId, a.id)).all().length === 1);
  check("a new plan has nobody behind", !v0.behind);
  const late = viewPlan(p, target, a, t0 + 20 * WEEK)!;
  check("weeks later with nothing learned the plan is behind", late.behind && late.weeksLate >= 2);
  const re = createPlan(p, target, a, t0 + 20 * WEEK)!;
  check("re-planning starts today and keeps the finish date", re.startsOn === t0 + 20 * WEEK && re.endsOn === row.endsOn);
  check("a re-plan leaves the ticked action out of the schedule", !re.plan.items.some((i) => i.key === "setup") && re.plan.doneActions.includes("setup"));
  check("a re-plan has less time, so it does not defer less", re.plan.deferred.length >= row.plan.deferred.length);
  const after = createPlan(p, target, a, row.endsOn - 3 * 86400)!;
  check("a re-plan with the finish date days away starts the timeframe again", after.endsOn === addMonths(row.endsOn - 3 * 86400, 6));
  // where it shows up: a summary for the person and a line for a mentor
  const s0 = routeSummary(p, target, t0 + 20 * WEEK + 1)!;
  check("a planned route has progress and a view", s0.state === "planned" && !!s0.progress && !!s0.view && s0.progress.status !== "done");
  check("a person with no assessment has no summary", routeSummary(db.insert(users).values({ email: "t-none@roadmap.check", name: "t-none", jobRole: "developer", role: "learner" }).returning().get(), target) === null);
  TARGETS.push(target); // the check job stands in for a listed one, so the dashboard and the mentor view can find it
  check("the first started target is found for the dashboard", routeSummaryFor(p, t0 + 5)?.target.slug === "roadmap-check");
  const mentor = db.insert(users).values({ email: "t-mentor@roadmap.check", name: "t-mentor", jobRole: "developer", role: "learner" }).returning().get();
  const stranger = db.insert(users).values({ email: "t-stranger@roadmap.check", name: "t-stranger", jobRole: "developer", role: "learner" }).returning().get();
  check("someone who is not a mentor sees nothing", menteeSummary(stranger.id, p.id) === null);
  db.insert(mentorships).values({ mentorId: mentor.id, menteeId: p.id, kind: "mentor" }).run();
  const seen = menteeSummary(mentor.id, p.id, t0 + 1);
  check("a mentor sees the route title, steps, status and finish line", seen?.route?.title === "Check job" && seen.route.stepsTotal === planFor(a.id)!.plan.items.length && seen.route.stepsDone === 0 && seen.route.status === "on-track" && seen.route.finishOn === planFor(a.id)!.endsOn);
  check("a mentor of someone with no plan sees no route", (() => { db.delete(routePlans).where(eq(routePlans.assessmentId, a.id)).run(); const r = menteeSummary(mentor.id, p.id, t0 + 1)!.route === null; createPlan(p, target, a, t0); return r; })());
  check("a mentor view never carries the questionnaire answers", !JSON.stringify(seen).match(/yearsOut|workRights|education|unsure/));
  db.delete(mentorships).where(inArray(mentorships.menteeId, [p.id])).run();
  TARGETS.pop();
  check("there is only ever one plan per assessment", db.select().from(routePlans).where(eq(routePlans.assessmentId, a.id)).all().length === 1);
} finally {
  sweep();
}
if (fails) { console.error(`${fails} check(s) failed`); process.exit(1); }

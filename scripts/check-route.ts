/** Checks the career route assessment: npm run check:route (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { brands, db, questions, routeAreaResults, routeAssessments, tracks, users } from "../lib/db";
import { ROUTE_BATCH, advance, answerCurrent, areaRows, assessmentFor, currentArea, resolveAreas, resultsFor, skipCurrent, startAssessment, type Target } from "../lib/route";
import type { RouteAnswers } from "../lib/db/schema";
import { areaStatus, byGap, levelsToClimb, notes, readiness } from "../lib/routeScore";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// the scoring rules, which need no database
check("a level at the bar is ready", areaStatus(4, 4) === "ready");
check("a level above the bar is ready", areaStatus(6, 4) === "ready");
check("one below is nearly there", areaStatus(3, 4) === "nearly");
check("two or three below is building", areaStatus(2, 5) === "building" && areaStatus(1, 4) === "building");
check("four or more below is start here", areaStatus(0, 4) === "start");
const sample = [{ key: "a", placed: 2, target: 4 }, { key: "b", placed: 6, target: 5 }, { key: "c", placed: 0, target: 6 }];
check("readiness caps each area at its own target", Math.abs(readiness(sample) - (2 + 5 + 0) / 15) < 1e-9);
check("readiness of nothing is zero", readiness([]) === 0);
check("biggest gap comes first", byGap(sample).map((x) => x.key).join("") === "cab");
check("levels to climb ignores areas already above the bar", levelsToClimb(sample) === 2 + 0 + 6);
const base: RouteAnswers = { education: "none", yearsOut: 8, paidWork: "none", unpaid: ["parenting"], digital: 4, writing: 4, workRights: "yes" };
check("no paid work with unpaid experience gets an encouraging note", notes(base).some((n) => /unpaid experience counts/.test(n.text)));
check("unsure about the right to work is a warning", notes({ ...base, workRights: "unsure" }).some((n) => n.tone === "warn"));
check("a confident person with the right to work gets no warning", !notes(base).some((n) => n.tone === "warn"));

// the flow, against the database
const MAIL = "%@route.check", SLUG = "route-check";
function sweep() {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, MAIL)).all().map((r) => r.id);
  if (ids.length) {
    const aids = db.select({ id: routeAssessments.id }).from(routeAssessments).where(inArray(routeAssessments.userId, ids)).all().map((r) => r.id);
    if (aids.length) db.delete(routeAreaResults).where(inArray(routeAreaResults.assessmentId, aids)).run();
    db.delete(routeAssessments).where(inArray(routeAssessments.userId, ids)).run();
    db.delete(users).where(inArray(users.id, ids)).run();
  }
  const ts = db.select({ id: tracks.id }).from(tracks).where(like(tracks.slug, `${SLUG}-%`)).all().map((t) => t.id);
  if (ts.length) { db.delete(questions).where(inArray(questions.trackId, ts)).run(); db.delete(tracks).where(inArray(tracks.id, ts)).run(); }
  db.delete(brands).where(eq(brands.slug, SLUG)).run();
}
sweep();
try {
  const brand = db.insert(brands).values({ slug: SLUG, name: "Route check", kind: "shared" }).returning().get();
  const track = (slug: string, levels: number) => {
    const t = db.insert(tracks).values({ brandId: brand.id, slug: `${SLUG}-${slug}`, name: slug, kind: "process", audience: "staff" }).returning().get();
    for (let l = 1; l <= levels; l++) for (let i = 0; i < 2; i++) {
      db.insert(questions).values({ trackId: t.id, level: l, type: "mcq", prompt: `${slug} L${l} Q${i}`, options: [{ key: "a", text: "right" }, { key: "b", text: "wrong" }], answer: "a" }).run();
    }
    return t;
  };
  track("one", 4); track("two", 4); track("thin", 1); // "thin" has too little to check a target of 4 fairly
  const target: Target = {
    slug: "route-check", title: "Check job", short: "Check job", summary: "",
    areas: [
      { key: "one", label: "One", why: "", trackSlug: `${SLUG}-one`, target: 4 },
      { key: "thin", label: "Thin", why: "", trackSlug: `${SLUG}-thin`, target: 4 },
      { key: "two", label: "Two", why: "", trackSlug: `${SLUG}-two`, target: 4 },
      { key: "gone", label: "Gone", why: "", trackSlug: `${SLUG}-nothing-here`, target: 4 },
    ],
  };
  const person = (tag: string) => db.insert(users).values({ email: `t-${tag}@route.check`, name: `t-${tag}`, jobRole: "developer", role: "learner" }).returning().get();
  const answers: RouteAnswers = { education: "none", yearsOut: 8, paidWork: "none", unpaid: [], digital: 3, writing: 3, workRights: "yes" };
  const correct = (id: number) => db.select({ a: questions.answer }).from(questions).where(eq(questions.id, id)).get()!.a!;
  const wrong = () => "b";

  const p = person("all-right");
  const areas = resolveAreas(target, p);
  check("an area with too few questions is not checkable", areas.find((a) => a.key === "thin")!.available === false);
  check("an area whose topic does not exist is not checkable", areas.find((a) => a.key === "gone")!.available === false && areas.find((a) => a.key === "gone")!.trackId === null);
  check("the other two are checkable", areas.filter((a) => a.available).map((a) => a.key).join() === "one,two");

  let a = startAssessment(p, target, { horizonMonths: 36, hoursPerWeek: 5, answers });
  check("the assessment keeps the timeframe, up to 60 months", a.horizonMonths === 36);
  check("only checkable areas get a row", areaRows(a.id).length === 2);
  check("the first area waits with a full batch", currentArea(areas, areaRows(a.id))?.row.pending?.length === ROUTE_BATCH);
  let guard = 0;
  while (assessmentFor(p.id, target.slug)!.status === "in_progress" && guard++ < 40) {
    const cur = currentArea(areas, areaRows(a.id))!;
    answerCurrent(assessmentFor(p.id, target.slug)!, areas, (id) => (cur.row.pending!.includes(id) ? correct(id) : ""));
  }
  a = assessmentFor(p.id, target.slug)!;
  check("answering everything right completes the assessment", a.status === "complete" && a.completedAt !== null);
  check("and places each area at the target", resultsFor(a, areas).filter((r) => r.available).every((r) => r.placed === 4));
  check("an uncheckable area has no result", resultsFor(a, areas).filter((r) => !r.available).every((r) => r.placed === null));
  check("it took few rounds (binary search, not every level)", areaRows(a.id).every((r) => r.round <= 3));

  const q = person("all-wrong");
  startAssessment(q, target, { horizonMonths: 1, hoursPerWeek: 40, answers });
  guard = 0;
  while (assessmentFor(q.id, target.slug)!.status === "in_progress" && guard++ < 40) answerCurrent(assessmentFor(q.id, target.slug)!, areas, wrong);
  check("answering everything wrong places each area at 0", resultsFor(assessmentFor(q.id, target.slug)!, areas).filter((r) => r.available).every((r) => r.placed === 0));

  const r = person("skip");
  const ra = startAssessment(r, target, { horizonMonths: 12, hoursPerWeek: 6, answers });
  skipCurrent(ra, areas);
  check("skipping settles that area and moves to the next", areaRows(ra.id).filter((x) => x.placed !== null).length === 1 && currentArea(areas, areaRows(ra.id))?.area.key === "two");
  skipCurrent(assessmentFor(r.id, target.slug)!, areas);
  check("skipping the last area completes it", assessmentFor(r.id, target.slug)!.status === "complete");

  const again = startAssessment(r, target, { horizonMonths: 6, hoursPerWeek: 10, answers });
  check("starting again keeps one assessment per person and job", again.id === ra.id && db.select().from(routeAssessments).where(eq(routeAssessments.userId, r.id)).all().length === 1);
  check("starting again clears the old results and takes the new timeframe", again.status === "in_progress" && again.horizonMonths === 6 && areaRows(again.id).every((x) => x.placed === null || x.pending === null));
  advance(again, areas); // harmless to call again
  check("advance does not draw a second batch while one is waiting", areaRows(again.id)[0].pending?.length === ROUTE_BATCH);

  const nobody = person("nothing");
  const empty: Target = { ...target, slug: "route-check-empty", areas: target.areas.filter((x) => x.key === "gone") };
  const e = startAssessment(nobody, empty, { horizonMonths: 12, hoursPerWeek: 6, answers });
  check("a target with nothing to check completes at once with no results", e.status === "complete" && areaRows(e.id).length === 0);
} finally {
  sweep();
}
if (fails) { console.error(`${fails} check(s) failed`); process.exit(1); }

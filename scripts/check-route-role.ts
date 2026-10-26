/** Checks the route to any career ladder rung: npm run check:routerole (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Needs the ladders seeded (npm run seed:careers). */
import { inArray, like } from "drizzle-orm";
import { db, routeAreaResults, routeAssessments, users } from "../lib/db";
import { TARGETS, answerCurrent, assessmentFor, resolveAreas, startAssessment, targetBySlug } from "../lib/route";
import { isRoleRoute, roleRouteSlug, roleTarget, routeRoles, routeRungs, startedRoleTargets } from "../lib/routeRole";
import { routeSummaryFor } from "../lib/routePlan";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const roles = routeRoles();
check("there are roles to choose from", roles.length > 10);
const withSteps = roles.find((r) => routeRungs(r.role).some((g) => g.steps > 0));
check("some role has a rung with steps", !!withSteps);
const role = withSteps!.role, rung = routeRungs(role).filter((g) => g.steps > 0).at(-1)!;
const slug = roleRouteSlug(role, rung.level);

check("a role route slug is recognised", isRoleRoute(slug) && !isRoleRoute("uk-civil-service-ao") && !isRoleRoute("role--x"));
const t = roleTarget(slug);
check("a route is made from the ladder", !!t && t.kind === "promotion" && t.areas.length > 0 && (t.stages?.length ?? 0) > 0);
check("every area asks for a level, once per track", !!t && t.areas.every((a) => a.target >= 1) && new Set(t.areas.map((a) => a.trackSlug)).size === t.areas.length);
check("the first rung is not a goal", roleTarget(roleRouteSlug(role, 1)) === null);
check("an unknown role or level gives nothing", roleTarget("role--no-such-role--3") === null && roleTarget(roleRouteSlug(role, 99)) === null);
check("targetBySlug finds it, and listed jobs still come first", targetBySlug(slug)?.slug === slug && TARGETS.every((x) => targetBySlug(x.slug)?.slug === x.slug));
check("the role route is not in the fixed list", !TARGETS.some((x) => x.slug === slug));

// the flow
const MAIL = "%@routerole.check";
const sweep = () => {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, MAIL)).all().map((r) => r.id);
  if (!ids.length) return;
  const aids = db.select({ id: routeAssessments.id }).from(routeAssessments).where(inArray(routeAssessments.userId, ids)).all().map((r) => r.id);
  if (aids.length) db.delete(routeAreaResults).where(inArray(routeAreaResults.assessmentId, aids)).run();
  db.delete(routeAssessments).where(inArray(routeAssessments.userId, ids)).run();
  db.delete(users).where(inArray(users.id, ids)).run();
};
sweep();
try {
  const p = db.insert(users).values({ email: "a@routerole.check", name: "Role Test", jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x", status: "active" }).returning().get();
  check("nothing started yet", startedRoleTargets(p.id).length === 0 && routeSummaryFor(p) === null);
  startAssessment(p, t!, { horizonMonths: 12, hoursPerWeek: 5, answers: { education: "college", yearsOut: 0, paidWork: "lots", unpaid: [], digital: 3, writing: 3, workRights: "yes" } });
  const a = assessmentFor(p.id, slug);
  check("the check starts against the role route", !!a && (a.status === "in_progress" || a.status === "complete"));
  const areas = resolveAreas(t!, p);
  let g = 0;
  while (assessmentFor(p.id, slug)!.status === "in_progress" && g++ < 60) answerCurrent(assessmentFor(p.id, slug)!, areas, () => "a");
  check("the check finishes", assessmentFor(p.id, slug)!.status === "complete");
  check("the started route is found again", startedRoleTargets(p.id).some((x) => x.slug === slug));
  check("the dashboard summary finds a route that is not in the list", routeSummaryFor(p)?.target.slug === slug);
} finally { sweep(); }

console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);

/**
 * Times what a page load does at scale: npm run perf (DATABASE_FILE = a database filled by npm run perf:seed).
 * Each row is the median of a few runs, in milliseconds. "Every page" is what the root layout does for any signed-in person.
 */
import { eq, like } from "drizzle-orm";
import { db, enrollments, tracks, users } from "../../lib/db";
import { activityFor, trackStats } from "../../lib/stats";
import { listFor } from "../../lib/competitions";
import { coverageFor } from "../../lib/roles";
import { arenaOfUser } from "../../lib/arena";
import { resolveScope, scopeChoices } from "../../lib/adminScope";
import { expiryWatchFor } from "../../lib/certsAdmin";
import { lookFor } from "../../lib/brand";
import { unreadCount } from "../../lib/notifications";
import { noteExpiringCertificates } from "../../lib/certs";
import { catalog, complianceReport, loadProgress, requirementsFor, resetCatalogCache, scopeLabels, scopeOptions, scopesOf } from "../../lib/paths";
import { knownRoles } from "../../lib/roles";
import { singleCompany } from "../../lib/brand";
import { arenaMap } from "../../lib/arena";
import { reachOf, usersInReach } from "../../lib/tenancy";
import { glanceCounts } from "../../lib/glance";
import { awaitingSignoff, onboardingFor } from "../../lib/onboarding";
import { periodAt, standings } from "../../lib/seasons";
import { progressionFor } from "../../lib/progression";
import { careerFor } from "../../lib/careers";
import { pendingFor, pendingCounts } from "../../lib/freshness";

const rows: [string, number][] = [];
const only = process.env.PERF_ONLY ? new RegExp(process.env.PERF_ONLY, "i") : null; // e.g. PERF_ONLY="dashboard|standings" to time just those
const time = (label: string, fn: () => unknown, runs = 3) => {
  if (only && !only.test(label)) return;
  const ts: number[] = [];
  for (let i = 0; i < runs; i++) { const t = performance.now(); fn(); ts.push(performance.now() - t); }
  ts.sort((a, b) => a - b);
  rows.push([label, ts[Math.floor(ts.length / 2)]]);
  console.log(`${label.padEnd(52)} ${ts[Math.floor(ts.length / 2)].toFixed(1).padStart(10)} ms`); // as it finishes, so a slow one does not hide the rest
};

const learner = db.select().from(users).where(like(users.email, "perf-0-%")).all().find((u) => u.role === "learner")!;
const manager = db.select().from(users).where(eq(users.email, "perf-0-1@perf.local")).get()!;
const owner = db.select().from(users).where(eq(users.email, "admin@gglearn.local")).get() ?? db.select().from(users).where(eq(users.role, "admin")).all().find((u) => !u.email.includes("perf"))!;
const cat = catalog();
const sc = scopesOf(learner.id);

console.log(`database: ${db.select().from(users).all().length} users`);
// what every signed-in page load does (app/layout.tsx)
time("every page: lookFor", () => lookFor(learner.id));
time("every page: noteExpiringCertificates", () => noteExpiringCertificates(learner.id));
time("every page: unreadCount", () => unreadCount(learner.id));
// the learner's dashboard
time("learner: catalog() cold (cache dropped first)", () => { resetCatalogCache(); catalog(); });
time("learner: catalog() warm", () => catalog());
time("learner: requirementsFor (catalog passed)", () => requirementsFor(learner, sc, cat));
time("learner: requirementsFor (default catalog)", () => requirementsFor(learner, sc));
time("learner: onboardingFor", () => onboardingFor(learner, sc));
time("learner: progressionFor", () => progressionFor(learner.id, 0), 2);
time("learner: careerFor", () => careerFor(learner, cat));
time("dashboard: trackStats for every enrolled track", () => { for (const m of db.select({ e: enrollments, t: tracks }).from(enrollments).innerJoin(tracks, eq(tracks.id, enrollments.trackId)).where(eq(enrollments.userId, learner.id)).all()) trackStats(learner.id, m.t, m.e.startedAt); });
time("dashboard: activityFor (24 weeks)", () => activityFor(learner.id, 24));
time("dashboard: listFor (contests)", () => listFor(learner, { mineOnly: true }));
time("dashboard: coverageFor", () => coverageFor(learner.jobRole));
time("dashboard: arenaOfUser", () => arenaOfUser(learner.id));
const mineIds = usersInReach(reachOf(manager.id));
time("people page: read everyone in reach (users + reach)", () => db.select().from(users).orderBy(users.name).all().filter((u) => !mineIds || mineIds.has(u.id)));
time("people page: scope options + role list", () => { scopeOptions(); knownRoles(catalog()); });
time("people page: work for one page of 50 people", () => {
  const page = db.select().from(users).orderBy(users.name).all().filter((u) => !mineIds || mineIds.has(u.id)).slice(0, 50);
  const ids = new Set(page.map((u) => u.id)), ctx = { cat: catalog(), prog: loadProgress(ids) }, opts = scopeOptions();
  for (const u of page) { const sc2 = scopesOf(u.id); scopeLabels(sc2, opts); coverageFor(u.jobRole, ctx.cat); onboardingFor(u, sc2, ctx); }
});
// what the admin frame does on every page, and the overview
const ownerUser = owner, scopeMgr = resolveScope(manager, "company:" + singleCompany(sc))!, scopeOwner = resolveScope(ownerUser, "all")!;
time("admin frame: resolve scope + switcher choices (manager)", () => { resolveScope(manager, "all"); scopeChoices(manager); });
time("admin frame: certificates badge (manager's company)", () => expiryWatchFor(scopeMgr.reach));
time("admin frame: certificates badge (owner, whole academy)", () => expiryWatchFor(scopeOwner.reach));
time("admin overview: counts for the manager's company", () => glanceCounts(manager, scopeMgr.reach), 1);
time("admin overview: sign-offs for the manager's company", () => awaitingSignoff(manager, scopeMgr.reach), 1);
time("learner: pendingFor", () => pendingFor(learner.id));
// boards
time("boards: arenaMap()", () => arenaMap());
time("boards: weekly standings (one company arena)", () => standings(periodAt("week"), "staff", undefined, `c${singleCompany(sc)}`), 2);
// a company manager's dashboard and admin pages
time("manager: reachOf", () => reachOf(manager.id));
time("manager: usersInReach", () => usersInReach(reachOf(manager.id)));
time("manager: complianceReport (their company only)", () => complianceReport(usersInReach(reachOf(manager.id))), 1);
time("owner: complianceReport (whole academy)", () => complianceReport(), 1);
time("manager: pendingCounts", () => pendingCounts(usersInReach(reachOf(manager.id))), 1);
time("manager: awaitingSignoff", () => awaitingSignoff(manager), 1);
time("manager: glanceCounts (whole dashboard panel)", () => glanceCounts(manager), 1);
time("owner: glanceCounts (whole dashboard panel)", () => glanceCounts(owner), 1);


/*
 * Checks starting levels (lib/credits.ts): who may give one and how much, that they lift where someone starts without becoming an exam pass,
 * that only an admin can make one count as complete, revoking and expiry, the role suggestion, and what the map is told about each level.
 * Run: npm run check:credits (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first.
 */
import { and, eq, like } from "drizzle-orm";
import { brands, companies, db, levelCredits, notifications, questions, tracks, userScopes, users } from "../lib/db";
import { MANAGER_CAP, acceptRoleStart, applyRoleStarts, creditHistory, detailsFor, grantCredit, mayGrant, revokeCredit, suggestedStarts } from "../lib/credits";
import { levelsEarned, levelsPassed } from "../lib/progress";
import { loadProgress, resetCatalogCache } from "../lib/paths";
import { loadRoles } from "../lib/lifecycle/roles";

process.env.CATALOG_TTL_MS = "0";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const form = (o: Record<string, string | number | boolean>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, String(v)); return fd; };
// its own company and brand, so the check needs nothing seeded and a manager of it cannot reach anyone else
const co = db.select().from(companies).where(eq(companies.slug, "credit-check-co")).get() ?? db.insert(companies).values({ slug: "credit-check-co", name: "Credit check Co" }).returning().get();
const brand = db.select().from(brands).where(eq(brands.slug, "credit-check-brand")).get() ?? db.insert(brands).values({ slug: "credit-check-brand", name: "Credit check brand", companyId: co.id }).returning().get();

try {
  // a track people can take up to level 12, and one that matches a real role ladder's first ask
  // a role whose ladder asks for a track the database does not have yet, so the check can make that track inside its own company
  const taken = new Set(db.select({ s: tracks.slug }).from(tracks).all().map((t) => t.s));
  let roleSlug = "", roleAsks = 0;
  const role = loadRoles().find((r) => { const hit = Object.entries(r.entry ?? {}).find(([slug, l]) => l >= 3 && !taken.has(slug)); if (hit) [roleSlug, roleAsks] = hit; return !!hit; });
  if (!role) throw new Error("every track a role ladder asks for already exists here, so the role check has nothing to build; run it on a smaller database");
  const mk = (slug: string, name: string) => {
    const t = db.select().from(tracks).where(eq(tracks.slug, slug)).get() ?? db.insert(tracks).values({ brandId: brand.id, slug, name, kind: "subject", scope: "company", tier: "growth" }).returning().get();
    for (let l = 1; l <= 12; l++) for (let i = 0; i < 12; i++) db.insert(questions).values({ trackId: t.id, level: l, type: "mcq", prompt: `credit-check ${slug} ${l}.${i}`, options: [{ key: "a", text: "x" }, { key: "b", text: "y" }], answer: "a" }).onConflictDoNothing().run();
    return t;
  };
  const trk = mk("credit-check-track", "Credit check"), roleTrk = mk(roleSlug, roleSlug);
  resetCatalogCache();

  const user = (name: string, role: "learner" | "manager" | "admin", scoped: boolean, jobRole = "general") => {
    const u = db.insert(users).values({ email: `${name}@check.local`, name, role, jobRole }).returning().get();
    if (scoped) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: co.id }).run();
    return u;
  };
  const admin = user("c-admin", "admin", false), mgr = user("c-mgr", "manager", true), mgr2 = user("c-mgr2", "manager", true);
  const learner = user("c-learner", "learner", true, role.key), outsider = user("c-outsider", "learner", false), lrn2 = user("c-learner2", "learner", true);

  // who may give a starting level
  check("a learner cannot give one", mayGrant(learner, lrn2, 3, false) !== null);
  check("nobody gives themselves one", mayGrant(mgr, mgr, 3, false) !== null && mayGrant(admin, admin, 3, false) !== null);
  check("a manager gives one to someone they run", mayGrant(mgr, learner, 5, false) === null);
  check("a manager cannot reach someone outside their company", mayGrant(mgr, outsider, 5, false) !== null);
  check(`a manager is capped at level ${MANAGER_CAP}`, mayGrant(mgr, learner, MANAGER_CAP, false) === null && mayGrant(mgr, learner, MANAGER_CAP + 1, false) !== null);
  check("only an admin can mark one as complete", mayGrant(mgr, learner, 5, true) !== null && mayGrant(admin, learner, 5, true) === null);
  check("an admin can give above the manager ceiling", mayGrant(admin, learner, 15, false) === null);
  check("the level must be a whole number from 1 to 20", mayGrant(admin, learner, 0, false) !== null && mayGrant(admin, learner, 21, false) !== null && mayGrant(admin, learner, 2.5, false) !== null);

  // giving one
  check("no starting level yet", levelsPassed(learner.id, trk.id) === 0);
  check("a reason is required", !!grantCredit(mgr, form({ userId: learner.id, trackId: trk.id, level: 5, reason: "" }))?.error);
  const g = grantCredit(mgr, form({ userId: learner.id, trackId: trk.id, level: 5, reason: "Ran the old team for six years" }));
  check("a manager gives level 5", !!g?.done && !g?.error);
  check("it lifts where they start", levelsPassed(learner.id, trk.id) === 5);
  check("it is not an exam pass: required training and promotions are unmoved", levelsEarned(learner.id, trk.id) === 0);
  check("the bulk progress used for required training is unmoved too", (loadProgress(new Set([learner.id])).passed.get(`${learner.id}:${trk.id}`) ?? 0) === 0);
  check("the person is told, with the reason", db.select().from(notifications).where(and(eq(notifications.userId, learner.id), like(notifications.key, "credit:%"))).all().some((n) => n.body.includes("six years")));
  check("giving a level they already have is refused", !!grantCredit(mgr, form({ userId: learner.id, trackId: trk.id, level: 5, reason: "again" }))?.error);
  check("a level above what the track reaches is refused", !!grantCredit(admin, form({ userId: learner.id, trackId: trk.id, level: 19, reason: "too high" }))?.error);
  check("a manager is refused above their ceiling", !!grantCredit(mgr, form({ userId: learner.id, trackId: trk.id, level: 12, reason: "too high for a manager" }))?.error);
  check("a manager cannot give one to someone they do not run", !!grantCredit(mgr, form({ userId: outsider.id, trackId: trk.id, level: 3, reason: "not mine" }))?.error);

  // how it shows
  const d = detailsFor(learner.id).get(trk.id)!;
  check("the map is told where the level comes from", d.shown === 5 && d.earned === 0 && d.credit?.source === "manager" && d.credit.by === "c-mgr" && d.credit.reason.includes("six years"));

  // an admin's, marked complete
  const a = grantCredit(admin, form({ userId: learner.id, trackId: trk.id, level: 8, reason: "Holds the equivalent qualification", counts: "on" }));
  check("an admin gives level 8 marked complete", !!a?.done);
  check("a complete one counts toward required training and promotions", levelsEarned(learner.id, trk.id) === 8 && (loadProgress(new Set([learner.id])).passed.get(`${learner.id}:${trk.id}`) ?? 0) === 8);
  check("the highest starting level is the one shown", detailsFor(learner.id).get(trk.id)!.credit?.level === 8 && levelsPassed(learner.id, trk.id) === 8);

  // taking one back
  const adminRow = db.select().from(levelCredits).where(and(eq(levelCredits.userId, learner.id), eq(levelCredits.level, 8))).get()!;
  const mgrRow = db.select().from(levelCredits).where(and(eq(levelCredits.userId, learner.id), eq(levelCredits.level, 5))).get()!;
  check("a manager cannot take back what an admin gave", !!revokeCredit(mgr, form({ creditId: adminRow.id }))?.error);
  check("another manager cannot take back someone else's", !!revokeCredit(mgr2, form({ creditId: mgrRow.id }))?.error);
  check("a learner cannot take one back", !!revokeCredit(learner, form({ creditId: mgrRow.id }))?.error);
  check("an admin takes back their own", !!revokeCredit(admin, form({ creditId: adminRow.id }))?.done);
  check("then the level falls back to the earlier one", levelsPassed(learner.id, trk.id) === 5 && levelsEarned(learner.id, trk.id) === 0);
  check("the manager takes back their own", !!revokeCredit(mgr, form({ creditId: mgrRow.id }))?.done);
  check("back to nothing, with the exams untouched", levelsPassed(learner.id, trk.id) === 0);
  check("a revoked row stays as the record", creditHistory(learner.id).filter((c) => c.state === "revoked").length === 2 && creditHistory(learner.id).every((c) => c.revoker));
  check("taking back twice is refused", !!revokeCredit(admin, form({ creditId: adminRow.id }))?.error);

  // expiry
  db.insert(levelCredits).values({ userId: learner.id, trackId: trk.id, level: 7, source: "manager", grantedBy: mgr.id, reason: "short loan", expiresAt: Math.floor(Date.now() / 1000) - 60 }).run();
  check("an expired starting level no longer counts", levelsPassed(learner.id, trk.id) === 0 && creditHistory(learner.id).some((c) => c.state === "expired"));
  const timed = grantCredit(mgr, form({ userId: learner.id, trackId: trk.id, level: 4, reason: "Covering for a quarter", days: 90 }));
  check("one with an end date counts until then", !!timed?.done && levelsPassed(learner.id, trk.id) === 4 && !!creditHistory(learner.id).find((c) => c.level === 4)?.expiresAt);
  check("an odd length of time is refused", !!grantCredit(admin, form({ userId: learner.id, trackId: trk.id, level: 9, reason: "odd", days: 17 }))?.error);

  // what their role normally holds
  const sug = suggestedStarts(learner.id);
  const one = sug?.starts.find((s) => s.slug === roleSlug);
  check("the job role suggests starting levels", !!one && one.level === Math.min(roleAsks, 10, 12));
  check("a suggestion changes nothing by itself", levelsPassed(learner.id, roleTrk.id) === 0);
  check("a person cannot accept a start their role does not suggest", !!acceptRoleStart(learner.id, "credit-check-track-nope")?.error);
  check("a person accepts their own role's start", !!acceptRoleStart(learner.id, roleSlug)?.done && levelsPassed(learner.id, roleTrk.id) === one!.level);
  check("it is recorded as from the role, and not an exam pass", detailsFor(learner.id).get(roleTrk.id)!.credit?.source === "role" && levelsEarned(learner.id, roleTrk.id) === 0);
  check("a suggestion is not offered twice", !suggestedStarts(learner.id)?.starts.some((s) => s.slug === roleSlug));
  const lr2 = db.update(users).set({ jobRole: role.key }).where(eq(users.id, lrn2.id)).run();
  check("a manager confirms a whole role's starts", !!applyRoleStarts(mgr, lrn2.id)?.done && levelsPassed(lrn2.id, roleTrk.id) > 0 && lr2.changes === 1);
  check("a learner cannot confirm someone else's", !!applyRoleStarts(learner, lrn2.id)?.error);
  check("a manager cannot confirm for someone they do not run", !!applyRoleStarts(mgr, outsider.id)?.error);
} catch (e) {
  fails++; console.error("FAIL threw:", e);
} finally {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, "%@check.local")).all().map((r) => r.id);
  for (const id of ids) { db.delete(notifications).where(eq(notifications.userId, id)).run(); db.delete(levelCredits).where(eq(levelCredits.userId, id)).run(); db.delete(userScopes).where(eq(userScopes.userId, id)).run(); }
  const mine = db.select().from(brands).where(eq(brands.slug, "credit-check-brand")).get();
  for (const t of mine ? db.select().from(tracks).where(eq(tracks.brandId, mine.id)).all() : []) { db.delete(questions).where(eq(questions.trackId, t.id)).run(); db.delete(tracks).where(eq(tracks.id, t.id)).run(); }
  db.delete(questions).where(like(questions.prompt, "credit-check %")).run();
  for (const id of ids) db.delete(users).where(eq(users.id, id)).run();
  db.delete(brands).where(eq(brands.slug, "credit-check-brand")).run();
  db.delete(companies).where(eq(companies.slug, "credit-check-co")).run();
}
if (fails) { console.error(`${fails} check(s) failed`); process.exit(1); }
console.log("credits ok");

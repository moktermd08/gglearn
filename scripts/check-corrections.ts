/**
 * Checks the corrections a manager can make on someone they run: npm run check:corrections (uses DATABASE_FILE or data/gglearn.db; adds and
 * removes its own rows; the database parts need two companies and a track, and are skipped on an empty database. Run db:push first).
 * Who may correct whom, that a voided attempt stops counting and comes back exactly as it was, and that more time on a course changes
 * one person's deadline and nobody else's.
 */
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { companies, db, deadlineExtensions, enrollments, notifications, runVoids, runs, securityLog, tracks, userScopes, users } from "../lib/db";
import { EXTEND_DAYS, MANAGER_EXTEND_MAX, extendDeadline, restoreRun, voidRun, whyNotCorrect } from "../lib/corrections";
import { catalog, requirementsFor, scopesOf, type Scope } from "../lib/paths";
import { reachOf } from "../lib/tenancy";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const form = (o: Record<string, string | number>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, String(v)); return fd; };
const ok = (r: { error?: string; done?: string } | null) => !!r?.done && !r.error;
const bad = (r: { error?: string; done?: string } | null) => !!r?.error && !r.done;

// ---- pure: who may correct whom
const all = { all: true as const };
const keys = (...k: string[]) => ({ all: false as const, keys: new Set(k) });
check("a learner may not correct anyone", whyNotCorrect({ id: 1, role: "learner" }, { id: 2, status: "active" }, all) !== null);
check("a manager may correct an active person in reach", whyNotCorrect({ id: 1, role: "manager" }, { id: 2, status: "active" }, all) === null);
check("nobody corrects themselves", whyNotCorrect({ id: 1, role: "admin" }, { id: 1, status: "active" }, all) !== null);
check("not someone offboarded", whyNotCorrect({ id: 1, role: "admin" }, { id: 2, status: "offboarded" }, all) !== null);
check("not someone who does not exist", whyNotCorrect({ id: 1, role: "admin" }, undefined, all) !== null);
check("not someone outside their reach", whyNotCorrect({ id: 1, role: "admin" }, { id: 2, status: "active" }, keys("company:9")) !== null);

// ---- the source: corrections run as the real manager, never while viewing as someone, and are logged
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const fix = src("app/fix-actions.ts");
check("every correction action refuses while viewing as someone", fix.includes("refuseWhileViewingAs()") && fix.includes("real.id !== me.id"));
check("every correction is logged", ["deadline_extend", "run_void", "run_restore", "credit_grant", "credit_revoke", "cert_revoke", "cert_reinstate"].every((a) => (fix + src("lib/corrections.ts")).includes(`"${a}"`)));
const page = src("app/(admin)/admin/people/[id]/page.tsx");
check("the profile page never writes itself (corrections go through the actions, which re-check)", !/db\.(insert|update|delete)\(/.test(page) && !/progressionFor|touchLeague|syncFreezes|syncRequired/.test(page));
check("the profile page only opens for people the viewer runs", page.includes("userInReach(reachOf(me.id), u.id)") && page.includes("notFound()"));

// ---- database
const cos = db.select().from(companies).orderBy(companies.id).limit(2).all();
const track = db.select().from(tracks).get();
const made: number[] = [], runIds: number[] = [];
if (cos.length < 2 || !track) console.log("skip database checks (needs two companies and a track)");
else {
  const [A, B] = cos.map((c) => c.id);
  const co = (id: number): Scope => ({ kind: "company", id });
  const person = (tag: string, role: "learner" | "manager" | "admin", scopes: Scope[], extra: Partial<typeof users.$inferInsert> = {}) => {
    const u = db.insert(users).values({ email: `t-${tag}@corrections.check`, name: `t-${tag}`, jobRole: "developer", role, ...extra }).returning().get();
    made.push(u.id);
    for (const s of scopes) db.insert(userScopes).values({ userId: u.id, kind: s.kind, refId: s.id }).run();
    return u;
  };
  try {
    const mgrA = person("mgrA", "manager", [co(A)]), adminA = person("adminA", "admin", [co(A)]);
    const learnerA = person("learnerA", "learner", [co(A)]), learnerB = person("learnerB", "learner", [co(B)]);
    const newRun = (userId: number, level: number, score: number, passed: boolean, finished = true) => {
      const r = db.insert(runs).values({ userId, trackId: track.id, level, score, passed, finishedAt: finished ? Math.floor(Date.now() / 1000) : null }).returning().get();
      runIds.push(r.id); return r;
    };
    const run1 = newRun(learnerA.id, 1, 0.9, true), runB = newRun(learnerB.id, 1, 0.8, true), runOpen = newRun(learnerA.id, 2, 0, false, false);
    const mgr = { id: mgrA.id, role: "manager" as const }, adm = { id: adminA.id, role: "admin" as const };
    const row = (id: number) => db.select().from(runs).where(eq(runs.id, id)).get()!;

    // void and restore
    check("a short reason is refused", bad(voidRun(mgr, form({ runId: run1.id, reason: "oops" }))) && row(run1.id).passed === true);
    check("a manager cannot void someone outside their companies", bad(voidRun(mgr, form({ runId: runB.id, reason: "a good enough reason" }))) && row(runB.id).passed === true);
    check("an unfinished attempt cannot be voided", bad(voidRun(mgr, form({ runId: runOpen.id, reason: "a good enough reason" }))));
    check("an attempt that does not exist is refused", bad(voidRun(mgr, form({ runId: 999999999, reason: "a good enough reason" }))));
    check("voiding your own attempt is refused", bad(voidRun({ id: learnerA.id, role: "manager" }, form({ runId: run1.id, reason: "a good enough reason" }))));
    check("a manager voids an attempt in reach: it stops passing and scores nothing", ok(voidRun(mgr, form({ runId: run1.id, reason: "the exam crashed halfway" }))) && row(run1.id).passed === false && row(run1.id).score === 0);
    const v = db.select().from(runVoids).where(eq(runVoids.runId, run1.id)).get();
    check("what it scored is kept, with who and why", !!v && v.originalScore === 0.9 && v.originalPassed === true && v.voidedBy === mgrA.id && v.reason.includes("crashed"));
    check("it cannot be voided twice", bad(voidRun(mgr, form({ runId: run1.id, reason: "a good enough reason" }))));
    check("the person is told", !!db.select().from(notifications).where(and(eq(notifications.userId, learnerA.id), eq(notifications.kind, "system"))).get());
    check("it is written to the security log", !!db.select().from(securityLog).where(and(eq(securityLog.actorId, mgrA.id), eq(securityLog.action, "run_void"))).get());
    check("restoring needs a reason and someone in reach", bad(restoreRun(mgr, form({ runId: run1.id, reason: "x" }))) && bad(restoreRun({ id: learnerB.id, role: "manager" }, form({ runId: run1.id, reason: "a good enough reason" }))));
    check("restoring puts it back exactly as it was", ok(restoreRun(mgr, form({ runId: run1.id, reason: "it was fine after all" }))) && row(run1.id).passed === true && row(run1.id).score === 0.9);
    check("an attempt that is not voided cannot be restored", bad(restoreRun(mgr, form({ runId: run1.id, reason: "a good enough reason" }))));
    check("it can be voided again after a restore", ok(voidRun(adm, form({ runId: run1.id, reason: "voided once more for the test" }))) && row(run1.id).passed === false);

    // more time on one course: needs a required course for learnerA
    const cat = catalog();
    const req = requirementsFor(learnerA, scopesOf(learnerA.id), cat).find((r) => !r.done);
    if (!req) console.log("skip deadline checks (nothing is required of a person in the first company)");
    else {
      db.insert(enrollments).values({ userId: learnerA.id, trackId: req.track.id, goal: "check" }).onConflictDoNothing().run();
      const dueNow = () => requirementsFor(learnerA, scopesOf(learnerA.id), cat).find((r) => r.track.id === req.track.id)!;
      const before = dueNow().dueAt;
      const T = Math.floor(Date.now() / 1000); // someone not enrolled has a deadline counted from "now", so both reads use the same instant
      const other = requirementsFor(learnerB, scopesOf(learnerB.id), cat, T).find((r) => r.track.id === req.track.id);
      const otherBefore = other?.dueAt;
      check("a manager cannot give more than their ceiling", bad(extendDeadline(mgr, form({ userId: learnerA.id, trackId: req.track.id, days: 60, reason: "a good enough reason" }))) && dueNow().dueAt === before);
      check("only the offered amounts are accepted", bad(extendDeadline(adm, form({ userId: learnerA.id, trackId: req.track.id, days: 11, reason: "a good enough reason" }))));
      check("a short reason is refused", bad(extendDeadline(mgr, form({ userId: learnerA.id, trackId: req.track.id, days: 7, reason: "no" }))));
      check("not for someone outside their companies", bad(extendDeadline(mgr, form({ userId: learnerB.id, trackId: req.track.id, days: 7, reason: "a good enough reason" }))));
      check("not for a course that is not required of them", bad(extendDeadline(mgr, form({ userId: learnerA.id, trackId: 999999999, days: 7, reason: "a good enough reason" }))));
      check("a manager gives more time within the ceiling", ok(extendDeadline(mgr, form({ userId: learnerA.id, trackId: req.track.id, days: MANAGER_EXTEND_MAX, reason: "was on leave for the month" }))));
      const after = dueNow();
      check("their deadline moves later, and says it was extended", after.dueAt > before && after.extendedTo === after.dueAt);
      check("nobody else's deadline for that course changes", other === undefined || requirementsFor(learnerB, scopesOf(learnerB.id), cat, T).find((r) => r.track.id === req.track.id)!.dueAt === otherBefore);
      check("it is written to the security log", !!db.select().from(securityLog).where(and(eq(securityLog.actorId, mgrA.id), eq(securityLog.action, "deadline_extend"))).get());
      check("a revoked extension stops applying", (() => { db.update(deadlineExtensions).set({ revokedAt: 1 }).where(eq(deadlineExtensions.userId, learnerA.id)).run(); return dueNow().dueAt === before && dueNow().extendedTo === null; })());
      check("the offered amounts are what the form shows", EXTEND_DAYS.includes(30) && !EXTEND_DAYS.includes(11 as never));
    }
    void reachOf;
  } finally {
    if (made.length) {
      db.delete(securityLog).where(inArray(securityLog.actorId, made)).run();
      db.delete(notifications).where(inArray(notifications.userId, made)).run();
      if (runIds.length) db.delete(runVoids).where(inArray(runVoids.runId, runIds)).run();
      if (runIds.length) db.delete(runs).where(inArray(runs.id, runIds)).run();
      db.delete(deadlineExtensions).where(inArray(deadlineExtensions.userId, made)).run();
      db.delete(enrollments).where(inArray(enrollments.userId, made)).run();
      db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
      db.delete(users).where(inArray(users.id, made)).run();
    }
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

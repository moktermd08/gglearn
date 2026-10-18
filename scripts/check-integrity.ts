/**
 * Checks exam integrity: npm run check:integrity (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows).
 * Policy layers and locks, who may set what, the risk scoring (including missing evidence), holding and releasing a reward, and review decisions.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  brands, certificates, companies, db, integrityEvents, integrityPolicies, integritySessions, integritySnapshots, notifications, rewardAwards, runs, tracks, userScopes, users,
} from "../lib/db";
import { DEFAULTS, FIELDS, PRESETS, type Settings, type Stored, describePolicy, isActive, layersForTrack, layersForUser, needsGuard, parseStored, policyForTrack, policyForUser, resolveLayers } from "../lib/integrity/policy";
import { addSnapshot, assess, finalize, policyFor, purgeExpired, recordEvents, riskOf, sessionOf, startSession } from "../lib/integrity/session";
import { decide, queueFor, savePolicy, resetPolicy, scopeAllowed } from "../lib/integrityAdmin";
import { reachOf } from "../lib/tenancy";

process.env.SESSION_SECRET ??= "check-integrity-only-secret-0123456789";
let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const set = (v: Partial<Settings>, lock: (keyof Settings)[] = []): Stored => ({ v, lock });
const mk = (email: string, role: "admin" | "manager" | "learner", scopes: { kind: "company" | "brand" | "project"; refId: number }[] = []) => {
  const u = db.insert(users).values({ email, name: email, role }).returning().get();
  for (const s of scopes) db.insert(userScopes).values({ userId: u.id, ...s }).run();
  return u;
};
// saving a level replaces everything it sets, so a test that changes one setting at the academy level sends the whole set again
const G = { scope: "global", refId: "0", f_webcam: "snapshots", lock_webcam: "on", f_fullscreen: "on", f_blockPaste: "on", f_tabSwitch: "limit", f_selfie: "on", f_behaviour: "on", f_holdOnFlag: "on", f_reviewAt: "50", f_minSecondsPerQuestion: "8" };
const BLANK = { consentAt: null as number | null, exists: false };
const now = Math.floor(Date.now() / 1000);

const made = { users: [] as number[], runs: [] as number[], policies: [] as number[] };

(async () => {
  try {
    // ---- the pure resolution rules
    check("defaults ask for nothing", !isActive(DEFAULTS) && !needsGuard(DEFAULTS));
    check("every preset names only real fields", Object.values(PRESETS).every((p) => Object.keys(p.values).every((k) => FIELDS.some((f) => f.key === k))));
    check("standard preset watches, off preset does not", isActive({ ...DEFAULTS, ...PRESETS.standard.values }) && !isActive({ ...DEFAULTS, ...PRESETS.off.values }));

    const L = [{ scope: "global" as const, refId: 0, label: "Academy" }, { scope: "company" as const, refId: 1, label: "Co" }, { scope: "brand" as const, refId: 2, label: "Br" }, { scope: "track" as const, refId: 3, label: "Tr" }];
    const m = new Map<string, Stored>([["global:0", set({ fullscreen: true, webcam: "snapshots" })], ["company:1", set({ fullscreen: false, snapshots: 6 })], ["track:3", set({ snapshots: 9 })]]);
    const r = resolveLayers(L, m);
    check("a narrower layer overrides a wider one", r.values.fullscreen === false && r.source.fullscreen.label === "Co");
    check("what no layer sets is inherited from the widest that does", r.values.webcam === "snapshots" && r.source.webcam.label === "Academy");
    check("the narrowest layer wins", r.values.snapshots === 9 && r.source.snapshots.label === "Tr");
    check("untouched settings fall back to the default", r.values.reviewAt === DEFAULTS.reviewAt && r.source.reviewAt.scope === "default");

    const locked = resolveLayers(L, new Map<string, Stored>([["company:1", set({ webcam: "snapshots", fullscreen: true }, ["webcam"])], ["brand:2", set({ webcam: "off", fullscreen: false })], ["track:3", set({ webcam: "off" })]]));
    check("a locked setting cannot be changed below the lock", locked.values.webcam === "snapshots" && locked.lockedBy.webcam?.label === "Co");
    check("an unlocked setting beside a locked one still can", locked.values.fullscreen === false);
    const lockOnly = resolveLayers(L, new Map<string, Stored>([["global:0", set({ blockPaste: true }, ["blockPaste"])], ["brand:2", set({ blockPaste: false })]]));
    check("the academy can lock a setting for everyone", lockOnly.values.blockPaste === true);
    const bare = resolveLayers(L, new Map<string, Stored>([["company:1", set({}, ["tabSwitch"])], ["brand:2", set({ tabSwitch: "limit" })]]));
    check("locking without a value locks the inherited one", bare.values.tabSwitch === "off");

    const junk = parseStored(JSON.stringify({ v: { fullscreen: "yes", snapshots: 999, tabSwitch: "weird", reviewAt: 70, nope: 1 }, lock: ["webcam", "bogus", 5] }));
    check("stored junk is dropped, valid values kept", junk.v.reviewAt === 70 && junk.v.snapshots === undefined && junk.v.tabSwitch === undefined && junk.v.fullscreen === undefined && !("nope" in junk.v));
    check("unknown locks are dropped", junk.lock.length === 1 && junk.lock[0] === "webcam");
    check("broken JSON reads as empty", parseStored("{not json").lock.length === 0);

    // ---- real structure
    const moksy = db.select().from(companies).where(eq(companies.slug, "moksy-limited")).get()!, guru = db.select().from(companies).where(eq(companies.slug, "guru-graphics-limited")).get()!;
    const brand = db.select().from(brands).where(eq(brands.companyId, moksy.id)).get()!;
    const track = db.select().from(tracks).where(eq(tracks.brandId, brand.id)).get()!;
    const guruBrand = db.select().from(brands).where(eq(brands.companyId, guru.id)).get()!;

    const owner = mk("i-owner@check.local", "admin");
    const mAdmin = mk("i-moksy-admin@check.local", "admin", [{ kind: "company", refId: moksy.id }]);
    const mManager = mk("i-moksy-mgr@check.local", "manager", [{ kind: "company", refId: moksy.id }]);
    const learner = mk("i-learner@check.local", "learner", [{ kind: "company", refId: moksy.id }]);
    const other = mk("i-guru-l@check.local", "learner", [{ kind: "company", refId: guru.id }]);
    const otherAdmin = mk("i-guru-admin@check.local", "admin", [{ kind: "company", refId: guru.id }]);
    made.users.push(owner.id, mAdmin.id, mManager.id, learner.id, other.id, otherAdmin.id);

    check("the owner may set the whole-academy policy", scopeAllowed(owner, "global", 0));
    check("a company admin may not set the whole-academy policy", !scopeAllowed(mAdmin, "global", 0));
    check("a company admin may set their company, brand and track", scopeAllowed(mAdmin, "company", moksy.id) && scopeAllowed(mAdmin, "brand", brand.id) && scopeAllowed(mAdmin, "track", track.id));
    check("a company admin may not set another company's", !scopeAllowed(mAdmin, "company", guru.id) && !scopeAllowed(mAdmin, "brand", guruBrand.id));
    check("a manager (not an admin) cannot save a policy", !!savePolicy(mManager, fd({ scope: "company", refId: String(moksy.id), preset: "light" }))?.error);
    check("saving someone else's company is refused", !!savePolicy(mAdmin, fd({ scope: "company", refId: String(guru.id), preset: "light" }))?.error);
    check("saving the whole academy as a company admin is refused", !!savePolicy(mAdmin, fd({ scope: "global", refId: "0", preset: "light" }))?.error);

    // ---- layers through real rows: global -> company -> brand -> track
    const before = db.select().from(integrityPolicies).all();
    check("no policy anywhere means an unwatched exam", !isActive(policyForTrack(track.id).values) || before.length > 0);
    // start from a clean slate for the layers this script touches
    for (const [s, id] of [["global", 0], ["company", moksy.id], ["brand", brand.id], ["track", track.id]] as const) db.delete(integrityPolicies).where(and(eq(integrityPolicies.scope, s), eq(integrityPolicies.refId, id))).run();
    const backup = before.filter((p) => (p.scope === "global") || (p.scope === "company" && p.refId === moksy.id) || (p.scope === "brand" && p.refId === brand.id) || (p.scope === "track" && p.refId === track.id));

    check("owner saves a global preset", !!savePolicy(owner, fd({ scope: "global", refId: "0", preset: "standard" }))?.done);
    let p = policyForTrack(track.id);
    check("a track with nothing of its own inherits the academy policy", p.values.webcam === "snapshots" && p.source.webcam.scope === "global" && p.values.fullscreen);
    check("the chain for a track is academy, company, brand, track", layersForTrack(track.id).map((l) => l.scope).join() === "global,company,brand,track");
    check("the company admin switches snapshots off for their company", !!savePolicy(mAdmin, fd({ scope: "company", refId: String(moksy.id), f_webcam: "off" }))?.done);
    p = policyForTrack(track.id);
    check("the company layer overrides the academy", p.values.webcam === "off" && p.source.webcam.scope === "company");
    check("the brand layer overrides the company", !!savePolicy(mAdmin, fd({ scope: "brand", refId: String(brand.id), f_webcam: "snapshots", f_snapshots: "7" }))?.done && policyForTrack(track.id).values.snapshots === 7);
    check("the track layer overrides the brand", !!savePolicy(mAdmin, fd({ scope: "track", refId: String(track.id), f_snapshots: "2" }))?.done && policyForTrack(track.id).values.snapshots === 2);
    check("a value out of range is refused", !!savePolicy(mAdmin, fd({ scope: "track", refId: String(track.id), f_snapshots: "99" }))?.error);
    check("a track cannot lock anything (nothing is below it)", !!savePolicy(mAdmin, fd({ scope: "track", refId: String(track.id), lock_fullscreen: "on" }))?.error);

    // locks through real rows
    check("the company locks fullscreen", !!savePolicy(mAdmin, fd({ scope: "company", refId: String(moksy.id), f_webcam: "off", f_fullscreen: "on", lock_fullscreen: "on" }))?.done);
    savePolicy(mAdmin, fd({ scope: "brand", refId: String(brand.id), f_fullscreen: "off", f_snapshots: "7" }));
    check("a brand cannot loosen what its company locked", policyForTrack(track.id).values.fullscreen === true);
    check("the locked setting is not even stored on the brand", !("fullscreen" in parseStored(db.select().from(integrityPolicies).where(and(eq(integrityPolicies.scope, "brand"), eq(integrityPolicies.refId, brand.id))).get()?.settings).v));
    check("the academy locks webcam for everyone", !!savePolicy(owner, fd(G))?.done);
    p = policyForTrack(track.id);
    check("a lock at the academy beats the company's own choice", p.values.webcam === "snapshots" && p.lockedBy.webcam?.scope === "global");
    check("a company cannot change what the academy locked", (savePolicy(mAdmin, fd({ scope: "company", refId: String(moksy.id), f_webcam: "off" })), policyForTrack(track.id).values.webcam === "snapshots"));
    check("resetting a level makes it inherit again", !!resetPolicy(mAdmin, fd({ scope: "track", refId: String(track.id) }))?.done && policyForTrack(track.id).source.snapshots.scope !== "track");

    // a role check has no single track: the academy, then the person's company
    check("a role check's layers are the academy then the person's company", layersForUser(learner.id).map((l) => l.scope).join() === "global,company" && layersForUser(other.id)[1]?.refId === guru.id);
    check("a role check uses the academy lock too", policyForUser(learner.id).values.webcam === "snapshots");

    // ---- scoring
    const std = { ...DEFAULTS, ...PRESETS.standard.values } as Settings;
    const at = { questionCount: 10, startedAt: now - 600, finishedAt: now, passed: true, level: 5 };
    const ev = (kind: string, n = 1, detail = "") => Array.from({ length: n }, () => ({ kind, detail }));
    const ok = { consentAt: now, exists: true };
    const photos = [{ tag: "start" }, ...Array(4).fill({ tag: "random" })];
    check("a clean, watched exam scores zero", riskOf(assess(std, ok, [], photos, at)) === 0);
    check("an exam that should be watched but never started the check is flagged", assess(std, BLANK, [], [], at).some((f) => f.key === "no_session") && riskOf(assess(std, BLANK, [], [], at)) >= std.reviewAt);
    check("no photos at all is a risk in itself", assess(std, ok, [], [], at).some((f) => f.key === "missing_photos") && assess(std, ok, [], [], at).some((f) => f.key === "missing_selfie"));
    check("leaving the window within the limit is minor", riskOf(assess(std, ok, ev("blur", 3, "5s away"), photos, at)) < 15);
    check("leaving the window beyond the limit is serious", riskOf(assess(std, ok, ev("blur", 8, "5s away"), photos, at)) >= 40);
    check("paste attempts add up but are capped", riskOf(assess(std, ok, ev("paste", 20), photos, at)) === 32);
    check("a second face is more serious than no face", riskOf(assess(std, ok, ev("multi_face"), photos, at)) > riskOf(assess(std, ok, ev("no_face"), photos, at)));
    check("an implausibly fast exam is flagged", assess(std, ok, [], photos, { ...at, startedAt: now - 20 }).some((f) => f.key === "too_fast") && !assess(std, ok, [], photos, at).some((f) => f.key === "too_fast"));
    check("signals the policy does not ask for are ignored", riskOf(assess({ ...DEFAULTS, tabSwitch: "off" }, ok, ev("blur", 20), [], at)) === 0);
    check("the score never passes 100", riskOf(assess(std, ok, [...ev("paste", 9), ...ev("blur", 30), ...ev("automation"), ...ev("multi_face", 9)], [], at)) === 100);
    check("what a learner is told matches the policy", describePolicy(std).length >= 6 && describePolicy(DEFAULTS).length === 0);

    // ---- a real attempt: held, cleared, rejected
    const runFor = (level: number, passed = true, secs = 600) => {
      const r = db.insert(runs).values({ userId: learner.id, trackId: track.id, level, score: passed ? 0.9 : 0.2, passed, startedAt: now - secs, finishedAt: now }).returning().get();
      made.runs.push(r.id); return r;
    };
    const run = runFor(5);
    check("the policy an exam is held to is frozen when it begins", (() => {
      const s = startSession({ kind: "run", examId: run.id, userId: learner.id, trackId: track.id, level: 5, consent: true });
      const before = policyFor("run", run.id, learner.id, track.id).values.reviewAt;
      savePolicy(owner, fd({ ...G, f_reviewAt: "5" }));
      const after = policyFor("run", run.id, learner.id, track.id).values.reviewAt;
      savePolicy(owner, fd(G));
      return !!s.consentAt && before === after;
    })());
    check("only known event kinds are stored", recordEvents(sessionOf("run", run.id)!.id, [{ kind: "paste" }, { kind: "score_override" }, { kind: "x".repeat(30) }]) === 1);
    recordEvents(sessionOf("run", run.id)!.id, ev("blur", 3, "20s away"));
    check("a non-JPEG is refused as a snapshot", "error" in addSnapshot(sessionOf("run", run.id)!, "random", Buffer.from("not a picture"), 1));
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
    check("a small JPEG is accepted", "ok" in addSnapshot(sessionOf("run", run.id)!, "start", jpeg, 1));
    check("a JPEG over the size limit is refused", "error" in addSnapshot(sessionOf("run", run.id)!, "random", Buffer.concat([jpeg, Buffer.alloc(61_000)]), 1));
    check("a face count of zero is recorded as evidence", (() => { addSnapshot(sessionOf("run", run.id)!, "random", jpeg, 0); return db.select().from(integrityEvents).where(and(eq(integrityEvents.sessionId, sessionOf("run", run.id)!.id), eq(integrityEvents.kind, "no_face"))).all().length === 1; })());

    const out = finalize("run", run.id, learner.id, track.id, { questionCount: 10, startedAt: now - 600, finishedAt: now, passed: true, level: 5 });
    check("a passing exam with missing evidence is sent for review and held", out.status === "review" && out.hold && out.score >= 50);
    check("grading again does not change the decision", finalize("run", run.id, learner.id, track.id, { questionCount: 10, startedAt: now, finishedAt: now, passed: true, level: 5 }).score === out.score);
    check("a held pass is waiting in the queue for its own company's admin only", queueFor(reachOf(mAdmin.id)).some((s) => s.examId === run.id) && !queueFor(reachOf(otherAdmin.id)).some((s) => s.examId === run.id));
    check("no certificate was given while held", !db.select().from(certificates).where(and(eq(certificates.userId, learner.id), eq(certificates.trackId, track.id), eq(certificates.level, 5))).get());

    const sid = sessionOf("run", run.id)!.id;
    check("you cannot decide your own exam", !!decide({ id: learner.id, role: "admin" }, fd({ sessionId: String(sid), to: "clear" }))?.error);
    check("a manager (not an admin) cannot decide", !!decide(mManager, fd({ sessionId: String(sid), to: "clear" }))?.error);
    check("another company's admin cannot decide", !!decide(otherAdmin, fd({ sessionId: String(sid), to: "clear" }))?.error);
    check("a rejection needs a reason", !!decide(mAdmin, fd({ sessionId: String(sid), to: "reject" }))?.error);
    check("clearing releases the held certificate", !!decide(mAdmin, fd({ sessionId: String(sid), to: "clear", note: "checked" }))?.done && !!db.select().from(certificates).where(and(eq(certificates.userId, learner.id), eq(certificates.trackId, track.id), eq(certificates.level, 5))).get());
    check("the session is marked cleared and released", sessionOf("run", run.id)!.status === "cleared" && sessionOf("run", run.id)!.award === "released");
    check("a decision cannot be made twice", !!decide(mAdmin, fd({ sessionId: String(sid), to: "reject", note: "again" }))?.error);

    const run2 = runFor(10, true, 5);
    startSession({ kind: "run", examId: run2.id, userId: learner.id, trackId: track.id, level: 10, consent: true });
    const out2 = finalize("run", run2.id, learner.id, track.id, { questionCount: 10, startedAt: now - 5, finishedAt: now, passed: true, level: 10 });
    check("a flagged pass at another level is held too", out2.status === "review" && out2.hold);
    const sid2 = sessionOf("run", run2.id)!.id;
    check("rejecting withdraws the pass", !!decide(mAdmin, fd({ sessionId: String(sid2), to: "reject", note: "Camera showed a second person" }))?.done && db.select().from(runs).where(eq(runs.id, run2.id)).get()!.passed === false);
    check("the person is told", db.select().from(notifications).where(and(eq(notifications.userId, learner.id), eq(notifications.key, `integrity-${sid2}`))).all().length === 1);

    // a failing exam is recorded but never queued; an unwatched policy leaves no trace
    const failed = runFor(3, false, 600);
    startSession({ kind: "run", examId: failed.id, userId: learner.id, trackId: track.id, level: 3, consent: true });
    check("a failed exam is not sent for review", finalize("run", failed.id, learner.id, track.id, { questionCount: 10, startedAt: now - 1, finishedAt: now, passed: false, level: 3 }).status === "clear");
    // log-only mode: flagged but the reward is not held
    savePolicy(mAdmin, fd({ scope: "track", refId: String(track.id), f_holdOnFlag: "off" }));
    const run3 = runFor(7, true, 5);
    const out3 = finalize("run", run3.id, learner.id, track.id, { questionCount: 10, startedAt: now - 5, finishedAt: now, passed: true, level: 7 });
    check("with holding off, a flagged pass is queued but not held", out3.status === "review" && !out3.hold);
    // high-stakes levels
    savePolicy(mAdmin, fd({ scope: "track", refId: String(track.id), f_reviewFromLevel: "12", f_reviewAt: "0", f_minSecondsPerQuestion: "0", f_holdOnFlag: "off" }));
    const run4 = runFor(15, true, 900);
    startSession({ kind: "run", examId: run4.id, userId: learner.id, trackId: track.id, level: 15, consent: true });
    addSnapshot(sessionOf("run", run4.id)!, "start", jpeg, 1);
    for (let i = 0; i < 4; i++) addSnapshot(sessionOf("run", run4.id)!, "random", jpeg, 1);
    const out4 = finalize("run", run4.id, learner.id, track.id, { questionCount: 10, startedAt: now - 900, finishedAt: now, passed: true, level: 15 });
    check("a pass at a high-stakes level always waits for a person, even with no flags", out4.status === "review" && out4.hold && out4.score === 0);
    check("a level below it does not", (() => {
      const r5 = runFor(8, true, 900); startSession({ kind: "run", examId: r5.id, userId: learner.id, trackId: track.id, level: 8, consent: true });
      for (const t of ["start", "random", "random", "random", "random"] as const) addSnapshot(sessionOf("run", r5.id)!, t, jpeg, 1);
      return finalize("run", r5.id, learner.id, track.id, { questionCount: 10, startedAt: now - 900, finishedAt: now, passed: true, level: 8 }).status === "clear";
    })());

    // ---- retention
    const settledRun = runFor(9, true, 900);
    const sess = startSession({ kind: "run", examId: settledRun.id, userId: learner.id, trackId: track.id, level: 9, consent: true });
    addSnapshot(sessionOf("run", settledRun.id)!, "start", jpeg, 1);
    db.update(integritySessions).set({ status: "clear", finishedAt: now - 40 * 86_400 }).where(eq(integritySessions.id, sess.id)).run();
    const keepOpen = sessionOf("run", run4.id)!;
    db.update(integritySessions).set({ finishedAt: now - 400 * 86_400 }).where(eq(integritySessions.id, keepOpen.id)).run();
    purgeExpired(true);
    check("old stills of a settled exam are deleted", db.select().from(integritySnapshots).where(eq(integritySnapshots.sessionId, sess.id)).all().length === 0);
    check("stills somebody still has to look at are kept", db.select().from(integritySnapshots).where(eq(integritySnapshots.sessionId, keepOpen.id)).all().length > 0);

    // put back what the script replaced
    for (const [s, id] of [["global", 0], ["company", moksy.id], ["brand", brand.id], ["track", track.id]] as const) db.delete(integrityPolicies).where(and(eq(integrityPolicies.scope, s), eq(integrityPolicies.refId, id))).run();
    for (const b of backup) db.insert(integrityPolicies).values({ scope: b.scope, refId: b.refId, settings: b.settings, updatedBy: b.updatedBy }).run();
  } finally {
    const uids = made.users;
    const sess = uids.length ? db.select({ id: integritySessions.id }).from(integritySessions).where(inArray(integritySessions.userId, uids)).all().map((s) => s.id) : [];
    if (sess.length) { db.delete(integrityEvents).where(inArray(integrityEvents.sessionId, sess)).run(); db.delete(integritySnapshots).where(inArray(integritySnapshots.sessionId, sess)).run(); db.delete(integritySessions).where(inArray(integritySessions.id, sess)).run(); }
    if (uids.length) {
      db.delete(rewardAwards).where(inArray(rewardAwards.userId, uids)).run();
      db.delete(certificates).where(inArray(certificates.userId, uids)).run();
      db.delete(notifications).where(inArray(notifications.userId, uids)).run();
      db.delete(runs).where(inArray(runs.userId, uids)).run();
      db.update(integrityPolicies).set({ updatedBy: null }).where(inArray(integrityPolicies.updatedBy, uids)).run();
      db.delete(userScopes).where(inArray(userScopes.userId, uids)).run();
      db.delete(users).where(inArray(users.id, uids)).run();
    }
  }
  console.log(fails ? `\n${fails} FAILED` : "\nall passed");
  process.exit(fails ? 1 : 0);
})();

/**
 * Checks the term bank end to end on a scratch database (never the real one):
 *   DATABASE_FILE=/tmp/terms.db npx drizzle-kit push && DATABASE_FILE=/tmp/terms.db npx tsx scripts/import-terms.ts && DATABASE_FILE=/tmp/terms.db npm run check:terms
 */
import assert from "node:assert/strict";
import type { TermLite } from "../lib/termsCore";

if (!process.env.DATABASE_FILE) { console.error("Set DATABASE_FILE to a scratch database: this check writes people and checks."); process.exit(1); }

(async () => {
const core = await import("../lib/termsCore");
const { db, terms, termExamAnswers, users } = await import("../lib/db");
const lib = await import("../lib/terms");
const { eq } = await import("drizzle-orm");

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log("ok  " + name); };

// ---- the pure rules
const T = (id: number, term: string, tier: number, group = "g", extra: Partial<TermLite> = {}): TermLite =>
  ({ id, term, meaning: `It means ${term} thing ${id}`, tier, group, bankId: 1, source: "shared", similar: [], ...extra });

ok("rank needs 80 per cent and enough terms at every tier asked", () => {
  assert.equal(core.rankFromStats({}), 0);
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 4 } }), 1);
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 3 } }), 0);
  assert.equal(core.rankFromStats({ 1: { tested: 2, right: 2 } }), 0, "two answers are not enough");
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 5 }, 2: { tested: 5, right: 5 }, 3: { tested: 5, right: 2 }, 4: { tested: 5, right: 5 } }), 2, "a failed tier stops the climb");
  assert.equal(core.rankFromStats({ 4: { tested: 5, right: 5 } }), 4, "a tier that was never asked below does not block");
});
ok("a goal rung maps across the five ranks", () => {
  assert.equal(core.rankForRung(1, 5), 2);
  assert.equal(core.rankForRung(5, 5), 5);
  assert.equal(core.rankForRung(4, 4), 5);
  assert.equal(core.rankForRung(1, 4), 2);
  assert.equal(core.rankForRung(1, 6), 2);
  assert.equal(core.rankForRung(6, 6), 5);
  assert.equal(core.rankForRung(1, 1), 5, "a role with one level takes in every rank");
});
ok("wrong answers are never repeats or easily confused terms", () => {
  const pool = [T(1, "cookie", 1, "a", { similar: ["header"] }), T(2, "header", 1, "a"), ...Array.from({ length: 8 }, (_, i) => T(10 + i, `other${i}`, 2, "a"))];
  for (let i = 0; i < 40; i++) {
    const q = core.buildQuestion(pool[0], pool, Math.random, "term")!;
    assert.ok(q, "a question is built");
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options[q.correct], "cookie");
    assert.ok(!q.options.includes("header"), "a confusable term is not offered");
  }
});
ok("too few different terms gives no question rather than a bad one", () => {
  const pool = [T(1, "a", 1), T(2, "b", 1), T(3, "c", 1)];
  assert.equal(core.buildQuestion(pool[0], pool, Math.random, "term"), null);
});
ok("meanings are only offered as wrong answers within the same kind", () => {
  const pool = [T(1, "mine1", 1, "g", { source: "mine" }), ...Array.from({ length: 6 }, (_, i) => T(10 + i, `shared${i}`, 1))];
  const q = core.buildQuestion(pool[0], pool, Math.random, "meaning")!;
  assert.ok(q.prompt.startsWith("Which term fits"), "falls back to the term direction when no same-kind meanings exist");
});
ok("a claim is confirmed only when its own tier was asked enough", () => {
  assert.equal(core.verdict(3, 3, true), "confirmed");
  assert.equal(core.verdict(3, 2, true), "below");
  assert.equal(core.verdict(3, 4, true), "above");
  assert.equal(core.verdict(3, 0, false), "unproven");
});

ok("a term moves up a box when known, back to the start when forgotten", () => {
  const t0 = 1_000_000;
  const a = core.nextReview(null, true, t0);
  assert.deepEqual([a.box, a.dueAt - t0], [1, 86400]);
  const b = core.nextReview(3, true, t0);
  assert.deepEqual([b.box, b.dueAt - t0], [4, 14 * 86400]);
  assert.equal(core.nextReview(5, true, t0).box, 5, "the top box is the top");
  const f = core.nextReview(4, false, t0);
  assert.deepEqual([f.box, f.dueAt - t0, f.lapse], [1, 600, true]);
  assert.equal(core.nextReview(2, false, t0).lapse, false, "forgetting something not yet known is not a lapse");
  assert.deepEqual([core.studyState(null), core.studyState(2), core.studyState(4)], ["new", "learning", "known"]);
});

// ---- the database flow
const email = `terms-check-${Date.now()}@example.test`;
const me = db.insert(users).values({ email, name: "Terms Check", jobRole: "cto" }).returning().get();
const other = db.insert(users).values({ email: "x" + email, name: "Other" }).returning().get();

ok("a person's own term stays out of everyone else's pool", () => {
  const mine = db.insert(terms).values({ ownerUserId: me.id, groupName: "", term: "Zebra crossing", meaning: "a place marked on a road where people cross", tier: 1 }).returning().get();
  assert.ok(lib.myTerms(me.id).some((t) => t.id === mine.id));
  assert.ok(!lib.myTerms(other.id).some((t) => t.id === mine.id));
  assert.ok(!lib.sharedTerms().some((t) => t.id === mine.id));
});
ok("a check needs enough terms at the claimed rank", () => {
  const shared = lib.sharedTerms();
  const few = shared.filter((t) => t.tier === 2).slice(0, 2).concat(shared.filter((t) => t.tier === 1).slice(0, 8));
  const r = lib.startCheck(me, 2, few.map((t) => t.id));
  assert.ok("error" in r, "refused: only two terms at the claimed rank");
  assert.ok("error" in lib.startCheck(me, 9, few.map((t) => t.id)));
  assert.ok("error" in lib.startCheck(me, 1, few.slice(0, 3).map((t) => t.id)), "too few terms");
});

let examId = 0;
ok("a check is made, marked and stored as asked", () => {
  const shared = lib.sharedTerms();
  const picked = [...shared.filter((t) => t.tier === 1).slice(0, 12), ...shared.filter((t) => t.tier === 2).slice(0, 8)];
  const r = lib.startCheck(me, 2, picked.map((t) => t.id));
  assert.ok("id" in r, JSON.stringify(r));
  examId = (r as { id: number }).id;
  const c = lib.loadCheck(me, examId)!;
  assert.equal(c.answers.length, 20);
  assert.equal(lib.loadCheck(other, examId), null, "somebody else cannot open it");
  const chosen: Record<number, number> = {};
  c.answers.forEach((a, i) => { chosen[a.id] = i < 18 ? a.correct : (a.correct + 1) % a.options.length; }); // 18 of 20 right
  assert.deepEqual(lib.markCheck(other, examId, chosen), { error: "That check was not found." });
  assert.deepEqual(lib.markCheck(me, examId, chosen), { ok: true });
  assert.ok("error" in lib.markCheck(me, examId, chosen), "marked once only");
  const done = lib.loadCheck(me, examId)!;
  assert.equal(done.exam.score, 0.9);
  assert.equal(done.reached, 2);
  assert.equal(done.verdict, "confirmed");
});
ok("standing counts the latest result for each term", () => {
  const s = lib.standingFor(me.id);
  const bank = s.banks.find((b) => b.asked > 0)!;
  assert.ok(bank.asked > 0 && bank.known <= bank.asked);
  // answer one term wrongly in a second check: the latest result wins
  const row = db.select().from(termExamAnswers).where(eq(termExamAnswers.examId, examId)).get()!;
  const shared = lib.sharedTerms();
  const again = lib.startCheck(me, 1, shared.filter((t) => t.tier === 1).slice(0, 6).map((t) => t.id)) as { id: number };
  const c2 = lib.loadCheck(me, again.id)!;
  const wrong: Record<number, number> = {};
  c2.answers.forEach((a) => { wrong[a.id] = (a.correct + 1) % a.options.length; });
  lib.markCheck(me, again.id, wrong);
  const after = lib.standingFor(me.id);
  const b2 = after.banks.find((b) => b.bank.slug === bank.bank.slug)!;
  assert.ok(b2.known < bank.known, "terms answered wrongly last time are no longer counted as known");
  assert.ok(row.id > 0);
});

// ---- roles, lists and study
const study = await import("../lib/termStudy");
const { careerLevels } = await import("../lib/db");
["Engineering Manager", "Head of Engineering", "VP Engineering", "CTO"].forEach((title, i) => db.insert(careerLevels).values({ jobRole: "cto", level: i + 1, title }).run());
["Junior", "Senior"].forEach((title, i) => db.insert(careerLevels).values({ jobRole: "gardener", level: i + 1, title }).run());

ok("a role's list is its own banks plus everyone's, up to the ranks its level reaches", () => {
  const l1 = study.roleList("cto", 1)!, l4 = study.roleList("CTO", 4)!;
  assert.equal(l1.ceiling, 2);
  assert.ok(l1.terms.every((t) => t.tier <= 2));
  const names = (l: typeof l1) => l.banks.map((b) => b.name);
  assert.ok(names(l1).includes("CTO core") && names(l1).includes("Office core"));
  assert.ok(!names(l1).includes("Security core"), "a bank for another role is left out");
  assert.ok(l4.terms.length > l1.terms.length, "the list grows with the level");
  assert.equal(l4.ceiling, 5);
  assert.equal(l1.banks[0].forRole, true, "what is made for the role comes first");
  assert.ok(study.roleList("cto", 9) === null && study.roleList("nobody", 1) === null);
  const g = study.roleList("gardener", 2)!;
  assert.deepEqual(g.banks.map((b) => b.name), ["Office core"], "a role with no bank of its own gets the terms for everyone");
});

let stuId = 0;
ok("a study round: new terms first, a known term goes away, a forgotten one comes back", () => {
  const u = db.insert(users).values({ email: "study-" + email, name: "Study" }).returning().get();
  stuId = u.id;
  const list = study.roleList("cto", 4)!;
  const q = study.studyQueue(u.id, list, 10);
  assert.equal(q.length, 10);
  assert.ok(q.every((c) => c.fresh));
  const now = Math.floor(Date.now() / 1000);
  assert.deepEqual(study.recordStudy(u.id, q[0].id, true), { ok: true });
  assert.deepEqual(study.recordStudy(u.id, q[1].id, false), { ok: true });
  const after = study.studyQueue(u.id, list, 10, now + 5);
  assert.ok(!after.some((c) => c.id === q[0].id), "known: not due for a day");
  assert.ok(!after.some((c) => c.id === q[1].id), "forgotten: not due for ten minutes");
  const later = study.studyQueue(u.id, list, 10, now + 700);
  assert.equal(later[0].id, q[1].id, "forgotten: back, ahead of new terms");
  assert.equal(later[0].fresh, false);
  const s = study.roleSummary(u.id, list);
  assert.deepEqual([s.counts.new, s.counts.learning, s.counts.known], [list.terms.length - 2, 2, 0]);
  assert.ok(typeof (study.studyQueue(u.id, list, 3, now + 2 * 86400)[0].id) === "number");
});
ok("a person cannot record a study answer for someone else's private term", () => {
  const own = lib.myTerms(me.id)[0];
  assert.ok("error" in study.recordStudy(stuId, own.id, true));
  assert.ok("error" in study.recordStudy(stuId, 99999999, true));
});
ok("roles to learn are saved once each and can be removed", () => {
  assert.deepEqual(study.saveStudyRole(stuId, "CTO", 2), { ok: true });
  assert.deepEqual(study.saveStudyRole(stuId, "cto", 3), { ok: true });
  assert.ok("error" in study.saveStudyRole(stuId, "cto", 99));
  const mine = study.myStudyRoles(stuId);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].level, 3);
  study.removeStudyRole(stuId, "cto");
  assert.equal(study.myStudyRoles(stuId).length, 0);
});
ok("a quick check from a list asks about the list's own terms and its top rank", () => {
  const u = db.select().from(users).where(eq(users.id, stuId)).get()!;
  const r = study.startRoleCheck(u, "cto", 4);
  assert.ok("id" in r, JSON.stringify(r));
  const c = lib.loadCheck(u, (r as { id: number }).id)!;
  const listIds = new Set(study.roleList("cto", 4)!.terms.map((t) => t.id));
  assert.ok(c.answers.length >= 5 && c.answers.length <= 20);
  assert.ok(c.answers.every((a) => listIds.has(a.termId)));
  assert.equal(c.exam.claimedTier, 5);
});

console.log(`\n${n} checks passed`);
})();

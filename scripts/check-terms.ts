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
  assert.equal(core.rankForRung(1, 5), 1);
  assert.equal(core.rankForRung(5, 5), 5);
  assert.equal(core.rankForRung(4, 4), 5);
  assert.equal(core.rankForRung(1, 1), 1);
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

console.log(`\n${n} checks passed`);
})();

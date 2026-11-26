/**
 * Checks the term bank end to end on a scratch database (never the real one):
 *   DATABASE_FILE=/tmp/terms.db npx drizzle-kit push && DATABASE_FILE=/tmp/terms.db npx tsx scripts/import-terms.ts && DATABASE_FILE=/tmp/terms.db npm run check:terms
 */
import assert from "node:assert/strict";
import type { TermLite } from "../lib/termsCore";

if (!process.env.DATABASE_FILE) { console.error("Set DATABASE_FILE to a scratch database: this check writes people and checks."); process.exit(1); }

(async () => {
const core = await import("../lib/termsCore");
const { db, terms, termExamAnswers, termExams, users } = await import("../lib/db");
const lib = await import("../lib/terms");
const { eq, desc } = await import("drizzle-orm");

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log("ok  " + name); };

// ---- the pure rules
ok("rank needs 80 per cent and enough terms at every tier asked", () => {
  assert.equal(core.rankFromStats({}), 0);
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 4 } }), 1);
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 3 } }), 0);
  assert.equal(core.rankFromStats({ 1: { tested: 2, right: 2 } }), 0, "two answers are not enough");
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 5 }, 2: { tested: 5, right: 5 }, 3: { tested: 5, right: 2 }, 4: { tested: 5, right: 5 } }), 2, "a failed tier stops the climb");
  assert.equal(core.rankFromStats({ 4: { tested: 5, right: 5 } }), 4, "a tier that was never asked below does not block");
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 5 }, 2: { tested: 4, right: 3 }, 3: { tested: 11, right: 9 } }), 3, "three of four at one rank is too little to hold someone back");
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 5 }, 2: { tested: 4, right: 2 }, 3: { tested: 11, right: 9 } }), 1, "but two of four does stop the climb");
  assert.equal(core.rankFromStats({ 1: { tested: 5, right: 5 }, 2: { tested: 5, right: 3 }, 3: { tested: 11, right: 11 } }), 1, "five answers are enough to fail a rank");
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
// ---- the question generator, on the real cards
const gen = await import("../lib/termQuestions");
const fsm = await import("node:fs");
const cardsDir = new URL("../content/cards/", import.meta.url).pathname;
const corpus: TermLite[] = [];
for (const file of fsm.readdirSync(cardsDir).filter((f) => f.endsWith(".json")).sort()) {
  const spec = JSON.parse(fsm.readFileSync(cardsDir + file, "utf8"));
  if (!spec.termBank) continue; // not a term bank
  const slug = file.slice(0, -5);
  for (const c of spec.cards) corpus.push({ id: corpus.length + 1, term: c.subject, meaning: "It " + c.says[0], tier: c.tier, group: slug + c.group, bankId: 1, source: "shared", similar: c.like ?? [], facts: c.says.slice(1), useWhen: c.use ?? "", mistakes: c.not ?? [] });
}
const ctx = gen.makeCtx(corpus);
const sig = (q: { prompt: string; options: string[] }) => q.prompt + "|" + [...q.options].sort().join("|");
const lc = (x: string) => x.toLowerCase();

ok("every card gets a sound question at every rank, whatever form it takes", () => {
  let made = 0, none = 0;
  const bad: string[] = [];
  for (const t of corpus) for (let rank = 1; rank <= 5; rank++) {
    const q = gen.buildQuestion(t, ctx, rank);
    if (!q) { none++; continue; }
    made++;
    const o = q.options, right = o[q.correct], tr = gen.truths(t).map(lc), fa = gen.falsehoods(t).map(lc);
    const fail = (why: string) => bad.push(`${q.form} ${t.term} r${rank}: ${why}`);
    if (new Set(o.map(lc)).size !== o.length) fail("repeated options");
    if (!(q.correct >= 0 && q.correct < o.length)) fail("no right answer");
    switch (q.form) {
      case "term-from-meaning": case "cloze": case "scenario": if (right !== t.term || o.length !== 4) fail("wrong right answer"); break;
      case "meaning-from-term": if (right !== t.meaning || o.length !== 4) fail("wrong meaning"); break;
      case "true-false": {
        const said = lc(q.prompt.replace(/^True or false: /, "").replace(lc(t.term) === lc(q.prompt.slice(15, 15 + t.term.length)) ? t.term + " " : "", "").replace(/\.$/, ""));
        const isTrue = right === "True";
        if (isTrue !== tr.includes(said)) fail("true/false does not match the statement");
        break;
      }
      case "contrast": {
        const named = [t, ...t.similar.map((n) => ctx.byName.get(lc(n)))].find((c) => c && c.term === right)!; // the pair, not any term that shares the words
        const pred = q.prompt.replace(/^Between .* and .*?, which /, "").replace(/\?$/, "");
        if (![t.term, ...t.similar].includes(right)) fail("answer is not one of the pair");
        if (!gen.truths(named).map(lc).includes(lc(pred))) fail("statement is not true of the answer");
        break;
      }
      case "true-statement": if (!tr.includes(lc(right.replace(/^It /, ""))) || o.filter((x) => tr.includes(lc(x.replace(/^It /, "")))).length !== 1) fail("not exactly one true statement"); break;
      case "not-true": if (o.length < 3 || !fa.includes(lc(right.replace(/^It /, ""))) || o.filter((x) => tr.includes(lc(x.replace(/^It /, "")))).length !== o.length - 1) fail("not exactly one false statement"); break;
      case "difference": if (!right.startsWith(t.term + " ") || !right.includes(", while ")) fail("wrong shape"); break;
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
  assert.ok(none / (made + none) < 0.02, `${none} of ${made + none} cards had no question`);
});
ok("the same word is asked differently at each rank", () => {
  const forms = (rank: number) => { const m = new Map<string, number>(); for (let i = 0; i < 400; i++) { const q = gen.buildQuestion(corpus[i % corpus.length], ctx, rank)!; m.set(q.form, (m.get(q.form) ?? 0) + 1); } return m; };
  const r1 = forms(1), r5 = forms(5);
  for (const f of ["difference", "not-true", "scenario", "contrast", "cloze"]) assert.equal(r1.get(f) ?? 0, 0, `Initiate never asks ${f}`);
  const deep = (r5.get("difference") ?? 0) + (r5.get("not-true") ?? 0) + (r5.get("scenario") ?? 0);
  assert.ok(deep > 400 * 0.4, `Titan mostly asks the deeper forms (${deep}/400)`);
  assert.ok((r5.get("meaning-from-term") ?? 0) < 400 * 0.1, "Titan rarely asks the plain recognition forms");
});
ok("asking again gives different questions", () => {
  const t = corpus.find((c) => c.term === "cookie" || c.useWhen)!;
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) seen.add(sig(gen.buildQuestion(t, ctx, 3)!));
  assert.ok(seen.size >= 10, `${seen.size} different questions out of 40`);
  // and a term's recent questions are avoided when something else can be made
  const avoid = new Set<string>(); const keys = new Set<string>();
  for (let i = 0; i < 10; i++) { const q = gen.buildQuestion(t, ctx, 3, Math.random, avoid)!; keys.add(q.form + ":" + q.key); avoid.add(q.form + ":" + q.key); }
  assert.ok(keys.size >= 6, `${keys.size} different forms and facts in 10 tries`);
});
ok("a person's own terms get the plain forms only, and too few terms give no question", () => {
  const mine = corpus.slice(0, 8).map((t, i) => ({ ...t, id: 5000 + i, source: "mine" as const, meaning: "a thing number " + i + " that is quite different", facts: [], mistakes: [], useWhen: "", similar: [] }));
  const mctx = gen.makeCtx([...mine, ...corpus]);
  for (let rank = 1; rank <= 5; rank++) for (const t of mine) { const q = gen.buildQuestion(t, mctx, rank)!; assert.ok(q && ["term-from-meaning", "meaning-from-term"].includes(q.form), q?.form); }
  assert.equal(gen.buildQuestion(mine[0], gen.makeCtx(mine.slice(0, 3)), 1), null);
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
  let slips = 0;
  c.answers.forEach((a) => { const slip = a.tier === 1 && slips < 2; if (slip) slips++; chosen[a.id] = slip ? (a.correct + 1) % a.options.length : a.correct; }); // 18 of 20 right, both slips on the easiest rank
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
  assert.ok(!names(l1).includes("Financial admin core"), "a bank for another role is left out");
  assert.ok(l4.terms.length > l1.terms.length, "the list grows with the level");
  assert.equal(l4.ceiling, 5);
  assert.equal(l1.banks[0].forRole, true, "what is made for the role comes first");
  assert.ok(study.roleList("cto", 9) === null && study.roleList("nobody", 1) === null);
  const g = study.roleList("gardener", 2)!;
  assert.ok(g.banks.length >= 1 && g.banks.every((b) => !b.forRole), "a role with no bank of its own gets only the terms for everyone");
  assert.ok(g.banks.map((b) => b.name).includes("Office core"));
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

ok("a check records how each question was made and where it came from", () => {
  const u = db.select().from(users).where(eq(users.id, stuId)).get()!;
  const r = study.startRoleCheck(u, "cto", 4) as { id: number };
  const c = lib.loadCheck(u, r.id)!;
  assert.equal(c.exam.kind, "quick");
  assert.deepEqual([c.exam.role, c.exam.level], ["cto", 4]);
  const rows = db.select().from(termExamAnswers).where(eq(termExamAnswers.examId, r.id)).all();
  assert.ok(rows.length > 0 && rows.every((x) => x.form !== ""));
});

let rankExamId = 0;
ok("a rank exam draws from the list at that rank and below, and only where the level reaches", () => {
  const u = db.select().from(users).where(eq(users.id, stuId)).get()!;
  const list = study.roleList("cto", 4)!;
  const offered = study.rankExams(u.id, list);
  assert.deepEqual(offered.map((e) => e.rank), [1, 2, 3, 4, 5]);
  assert.ok("error" in study.startRankExam(u, "cto", 1, 3), "the first level reaches Adept, so there is no Expert exam");
  assert.ok("error" in study.startRankExam(u, "cto", 4, 9));
  const r = study.startRankExam(u, "cto", 4, 3);
  assert.ok("id" in r, JSON.stringify(r));
  rankExamId = (r as { id: number }).id;
  const c = lib.loadCheck(u, rankExamId)!;
  const allowed = new Set(list.terms.filter((t) => t.tier <= 3).map((t) => t.id));
  assert.equal(c.exam.kind, "premade");
  assert.equal(c.exam.claimedTier, 3);
  assert.ok(c.answers.length >= 15 && c.answers.length <= 20, String(c.answers.length));
  assert.ok(c.answers.every((a) => allowed.has(a.termId)));
  assert.ok(c.answers.filter((a) => a.tier === 3).length >= 3);
});
ok("a passed rank exam is remembered as the best result", () => {
  const u = db.select().from(users).where(eq(users.id, stuId)).get()!;
  const c = lib.loadCheck(u, rankExamId)!;
  const right: Record<number, number> = {};
  c.answers.forEach((a) => { right[a.id] = a.correct; });
  assert.deepEqual(lib.markCheck(u, rankExamId, right), { ok: true });
  const e = study.rankExams(u.id, study.roleList("cto", 4)!).find((x) => x.rank === 3)!;
  assert.deepEqual([e.best?.passed, e.best?.score], [true, 1]);
});
ok("sitting the same exam again asks different questions", () => {
  const u = db.select().from(users).where(eq(users.id, stuId)).get()!;
  const ids = study.roleList("cto", 4)!.terms.filter((t) => t.tier <= 3).slice(0, 24).map((t) => t.id);
  const pairs = (id: number) => new Set(db.select().from(termExamAnswers).where(eq(termExamAnswers.examId, id)).all().map((x) => x.termId + "|" + x.form + ":" + x.key));
  const one = lib.startCheck(u, 3, ids) as { id: number }, two = lib.startCheck(u, 3, ids) as { id: number }, three = lib.startCheck(u, 3, ids) as { id: number };
  const p1 = pairs(one.id), p2 = pairs(two.id), p3 = pairs(three.id);
  const repeats = (x: Set<string>, y: Set<string>) => [...y].filter((k) => x.has(k)).length / y.size;
  assert.ok(repeats(p1, p2) < 0.25, `second sitting repeated ${Math.round(repeats(p1, p2) * 100)}% of the first`);
  assert.ok(repeats(p2, p3) < 0.25 && repeats(p1, p3) < 0.5, "and so did the third");
});

// ---- the journey: from knowing nothing to the level aimed at
const jr = await import("../lib/termJourney");
const { careerGoals } = await import("../lib/db");
const newcomer = db.insert(users).values({ email: "journey-" + email, name: "Journey" }).returning().get();
const answer = (id: number, who: typeof newcomer, how: "all" | "none") => {
  const c = lib.loadCheck(who, id)!, pick: Record<number, number> = {};
  c.answers.forEach((a) => { pick[a.id] = how === "all" ? a.correct : (a.correct + 1) % a.options.length; });
  lib.markCheck(who, id, pick);
  return lib.loadCheck(who, id)!;
};

ok("a person with nothing chosen is sent to the start screen", () => {
  assert.equal(jr.nextStep(newcomer.id).kind, "start");
});
ok("the basics for any office job are a list on their own, with all five ranks", () => {
  const l = study.roleList("everyone", 1)!;
  assert.ok(l && l.ceiling === 5 && l.terms.length > 150);
  assert.ok(study.roleOptions().some((o) => o.role === "everyone"));
  assert.equal(study.roleLabel("everyone"), "Any office job");
});
ok("starting from the beginning saves the role and sets a goal only where the person's career path leads, and only once", () => {
  assert.deepEqual(jr.beginJourney(newcomer, "everyone", 1, true), { ok: true });
  assert.equal(db.select().from(careerGoals).where(eq(careerGoals.userId, newcomer.id)).all().length, 0, "no goal for the basics");
  assert.ok("error" in jr.beginJourney(newcomer, "nobody", 1, true));
  const goalsOf = () => db.select().from(careerGoals).where(eq(careerGoals.userId, newcomer.id)).all();
  assert.deepEqual(jr.beginJourney(newcomer, "cto", 2, true), { ok: true });
  assert.equal(goalsOf().length, 0, "no career path of their own, so nothing a goal could be measured from");
  db.update(users).set({ jobRole: "cto" }).where(eq(users.id, newcomer.id)).run();
  newcomer.jobRole = "cto";
  assert.deepEqual(jr.beginJourney(newcomer, "gardener", 2, true), { ok: true });
  assert.equal(goalsOf().length, 0, "a role their path does not lead to is learned, not made a goal");
  assert.equal(study.myStudyRoles(newcomer.id).some((r) => r.role === "gardener"), true);
  assert.deepEqual(jr.beginJourney(newcomer, "cto", 2, true), { ok: true });
  assert.deepEqual(jr.beginJourney(newcomer, "gardener", 1, true), { ok: true });
  const goals = db.select().from(careerGoals).where(eq(careerGoals.userId, newcomer.id)).all();
  assert.deepEqual(goals.map((g) => [g.targetRole, g.targetLevel]), [["cto", 2]], "the first goal stays");
  study.removeStudyRole(newcomer.id, "gardener");
  study.removeStudyRole(newcomer.id, "cto");
});
ok("placement asks one rank at a time, ten terms of that rank, as deeply as the rank", () => {
  const list = study.roleList("everyone", 1)!;
  assert.deepEqual(study.placementStages(list), [1, 2, 3, 4, 5]);
  const r = study.startPlacementStage(newcomer, "everyone", 1, 1) as { id: number };
  const c = lib.loadCheck(newcomer, r.id)!;
  assert.equal(c.exam.kind, "placement");
  assert.equal(c.exam.claimedTier, 1);
  assert.ok(c.answers.length >= 8 && c.answers.length <= 10, String(c.answers.length));
  assert.ok(c.answers.every((a) => a.tier === 1));
  assert.ok("error" in study.startPlacementStage(newcomer, "everyone", 1, 9));
  lib.markCheck(newcomer, r.id, {}); // leave it unanswered so the next test starts clean
  db.delete(termExamAnswers).where(eq(termExamAnswers.examId, r.id)).run();
  db.delete(termExams).where(eq(termExams.id, r.id)).run();
});
ok("someone who knows nothing stops at the first rank, with a next step that is to study and try again", () => {
  jr.beginJourney(newcomer, "everyone", 1, false);
  assert.equal(jr.nextStep(newcomer.id).kind, "place");
  const r = study.startPlacementStage(newcomer, "everyone", 1, 1) as { id: number };
  answer(r.id, newcomer, "none");
  const list = study.roleList("everyone", 1)!;
  const st = jr.placementState(newcomer.id, list);
  assert.deepEqual([st.placed, st.done, st.next], [0, true, null]);
  assert.deepEqual(st.stages.map((x) => x.state), ["failed", "todo", "todo", "todo", "todo"]);
  const step = jr.nextStep(newcomer.id);
  assert.equal(step.kind, "climb");
  if (step.kind === "climb") assert.ok(step.stage === 1 && step.toLearn > 0 && step.studyHref.includes("everyone"));
});
ok("the terms missed in a check can be studied straight away", () => {
  const last = db.select().from(termExams).where(eq(termExams.userId, newcomer.id)).orderBy(desc(termExams.id)).get()!;
  const c = lib.loadCheck(newcomer, last.id)!;
  const cards = study.studyCardsFor(newcomer.id, c.answers.filter((a) => !a.right).map((a) => a.termId));
  assert.equal(cards.length, c.answers.filter((a) => !a.right).length);
  assert.ok(cards.every((k) => k.fresh && k.meaning));
  assert.deepEqual(study.studyCardsFor(other.id, db.select().from(terms).where(eq(terms.ownerUserId, me.id)).all().map((t) => t.id)), [], "somebody's private term is not offered to another person");
});
ok("someone who knows a lot climbs rank by rank and stops where they stop passing", () => {
  const who = db.insert(users).values({ email: "climber-" + email, name: "Climber" }).returning().get();
  jr.beginJourney(who, "everyone", 1, false);
  const list = study.roleList("everyone", 1)!;
  for (const rank of [1, 2, 3]) {
    const r = study.startPlacementStage(who, "everyone", 1, rank) as { id: number };
    answer(r.id, who, "all");
    const s = jr.placementState(who.id, list);
    assert.equal(s.placed, rank);
    assert.equal(s.next, rank + 1);
    assert.equal(jr.nextStep(who.id).kind, "continue");
  }
  const r4 = study.startPlacementStage(who, "everyone", 1, 4) as { id: number };
  answer(r4.id, who, "none");
  const s = jr.placementState(who.id, list);
  assert.deepEqual([s.placed, s.done, s.next], [3, true, null]);
  const step = jr.nextStep(who.id);
  assert.ok(step.kind === "climb" && step.placed === 3 && step.stage === 4 && step.target === 5);
  // learn and pass the rank again: the latest try counts and the climb goes on
  const again = study.startPlacementStage(who, "everyone", 1, 4) as { id: number };
  answer(again.id, who, "all");
  const s2 = jr.placementState(who.id, list);
  assert.deepEqual([s2.placed, s2.next], [4, 5]);
});
ok("passing every rank reaches the goal", () => {
  const who = db.insert(users).values({ email: "top-" + email, name: "Top" }).returning().get();
  jr.beginJourney(who, "everyone", 1, false);
  for (const rank of [1, 2, 3, 4, 5]) answer((study.startPlacementStage(who, "everyone", 1, rank) as { id: number }).id, who, "all");
  const step = jr.nextStep(who.id);
  assert.ok(step.kind === "there" && step.placed === 5);
});
ok("a goal asks for fewer ranks than the whole list, so the path ends sooner", () => {
  const who = db.insert(users).values({ email: "goal-" + email, name: "Goal", jobRole: "cto" }).returning().get();
  jr.beginJourney(who, "cto", 2, true);
  db.update(careerGoals).set({ targetLevel: 1 }).where(eq(careerGoals.userId, who.id)).run(); // a goal of the first level, which reaches Adept
  jr.beginJourney(who, "cto", 1, false);
  const list = study.roleList("cto", 1)!;
  for (const rank of study.placementStages(list)) answer((study.startPlacementStage(who, "cto", 1, rank) as { id: number }).id, who, "all");
  const step = jr.nextStep(who.id);
  assert.ok(step.kind === "there" && step.target === 2 && step.placed === 2, JSON.stringify([step.kind]));
});

ok("a result talks about the list the check was on, even when the person also has a goal elsewhere", () => {
  const who = db.insert(users).values({ email: "two-" + email, name: "Two", jobRole: "cto" }).returning().get();
  jr.beginJourney(who, "cto", 2, true);
  jr.beginJourney(who, "everyone", 1, false);
  const main = jr.nextStep(who.id), aside = jr.nextStep(who.id, { role: "everyone", level: 1 });
  assert.ok(main.kind !== "start" && main.role === "cto");
  assert.ok(aside.kind !== "start" && aside.role === "everyone" && !aside.hasGoal);
});

console.log(`\n${n} checks passed`);
})();

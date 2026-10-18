/** Checks "try it before signing up": npm run check:trial (uses DATABASE_FILE or data/gglearn.db; the signed-in part adds and removes its own rows). */
import { and, eq } from "drizzle-orm";
import { brands, dailyQuests, db, enrollments, questions, tracks, users } from "../lib/db";
import { isPublicTrack } from "../lib/publicCatalog";
import { TRIAL_MAX_LEVEL, TRIAL_SIZE, TRIAL_XP, checkTrial, completeTrial, noteTrialCheck, trialQuestions, trialTopics, trialTrack } from "../lib/trial";
import { like } from "drizzle-orm";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const topics = trialTopics();
check("there are topics to try", topics.length >= 3 && topics.length <= 12);
check("every one is public: a stranger may see it", topics.every((t) => { const row = db.select().from(tracks).where(eq(tracks.slug, t.slug)).get()!; return isPublicTrack(row.id); }));
check("every one has enough easy questions", topics.every((t) => { const row = db.select().from(tracks).where(eq(tracks.slug, t.slug)).get()!; return trialQuestions(row.id).length === TRIAL_SIZE; }));
check("favourites come first when they are there", ["python-titan", "javascript-titan", "git-titan", "html-titan", "css-titan", "react-titan"].includes(topics[0].slug) || !topics.some((t) => t.slug === "python-titan"));
check("no duplicates", new Set(topics.map((t) => t.slug)).size === topics.length);

const t0 = db.select().from(tracks).where(eq(tracks.slug, topics[0].slug)).get()!;
const qs = trialQuestions(t0.id);
check("a trial is exactly three questions with their options", qs.length === TRIAL_SIZE && qs.every((q) => q.options.length >= 2));
check("a trial is of easy, active, multiple-choice questions from that topic", qs.every((q) => { const r = db.select().from(questions).where(eq(questions.id, q.id)).get()!; return r.trackId === t0.id && r.type === "mcq" && r.status === "active" && r.level <= TRIAL_MAX_LEVEL; }));
check("the question carries no answer, hint or rubric", qs.every((q) => Object.keys(q).sort().join() === "code,id,options,prompt" && q.options.every((o) => Object.keys(o).sort().join() === "key,text")));
check("three different questions", new Set(qs.map((q) => q.id)).size === TRIAL_SIZE);

const real = db.select().from(questions).where(eq(questions.id, qs[0].id)).get()!;
const wrong = (real.options ?? []).find((o) => o.key.toLowerCase() !== (real.answer ?? "").toLowerCase())!.key;
check("the right answer is marked right, in any letter case", checkTrial(real.id, real.answer!)?.correct === true && checkTrial(real.id, real.answer!.toUpperCase())?.correct === true);
check("a wrong answer is marked wrong, and says what was right", (() => { const r = checkTrial(real.id, wrong); return r?.correct === false && r.answer === real.answer; })());

// things a stranger must not be able to check
const staff = db.select({ q: questions }).from(questions).innerJoin(tracks, eq(tracks.id, questions.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId))
  .where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"), eq(questions.type, "mcq"), eq(questions.status, "active"))).limit(1).get();
check("a company's staff-only question cannot be checked", !staff || checkTrial(staff.q.id, "a") === null);
check("a company's staff-only topic cannot be tried", (() => { const s = db.select({ slug: tracks.slug }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"))).limit(1).get(); return !s || trialTrack(s.slug) === null; })());
const hard = db.select().from(questions).where(and(eq(questions.trackId, t0.id), eq(questions.status, "active"), eq(questions.type, "mcq"))).all().find((q) => q.level > TRIAL_MAX_LEVEL);
check("a harder question (an exam's) cannot be checked", !hard || checkTrial(hard.id, hard.answer ?? "a") === null);
const open = db.select().from(questions).where(and(eq(questions.trackId, t0.id), eq(questions.type, "open"))).limit(1).get();
check("an open-answer question cannot be checked", !open || checkTrial(open.id, "a") === null);
check("a question that does not exist cannot be checked", checkTrial(999999999, "a") === null && checkTrial(-1, "a") === null);
check("an unknown topic cannot be tried", trialTrack("no-such-topic") === null && trialTrack("../x") === null);

// ---- finishing a trial while signed in ----
db.delete(users).where(like(users.email, "%@trial.check")).run();
try {
  const u = db.insert(users).values({ name: "Trial Tester", email: "t@trial.check", jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const here = (id: number) => db.select().from(enrollments).where(and(eq(enrollments.userId, u.id), eq(enrollments.trackId, id))).all().length;
  const drills = () => db.select().from(dailyQuests).where(and(eq(dailyQuests.userId, u.id), eq(dailyQuests.kind, "drill"))).all().length;
  check("finishing with nothing answered pays nothing", completeTrial(u.id, t0.id) === null && here(t0.id) === 0);
  noteTrialCheck(u.id, t0.id, qs[0].id); noteTrialCheck(u.id, t0.id, qs[1].id); noteTrialCheck(u.id, t0.id, qs[1].id); noteTrialCheck(u.id, t0.id, qs[1].id);
  check("two different questions are not enough, however often one is repeated", completeTrial(u.id, t0.id) === null && here(t0.id) === 0 && drills() === 0);
  noteTrialCheck(u.id, t0.id, qs[2].id);
  const done = completeTrial(u.id, t0.id);
  check("three different answers: enrolled in the topic and the day's quick drill is paid", done?.xp === TRIAL_XP && here(t0.id) === 1 && drills() === 1);
  check("the answers are used up: finishing again straight away pays nothing", completeTrial(u.id, t0.id) === null && drills() === 1);
  for (const q of qs) noteTrialCheck(u.id, t0.id, q.id);
  check("doing it again the same day enrols nothing new and pays no second drill", completeTrial(u.id, t0.id)?.xp === 0 && here(t0.id) === 1 && drills() === 1);
  noteTrialCheck(u.id, t0.id, qs[0].id, Date.now() - 31 * 60 * 1000); noteTrialCheck(u.id, 999, 1); noteTrialCheck(u.id, 999, 2); noteTrialCheck(u.id, 999, 3);
  check("answers that are too old do not count", completeTrial(u.id, t0.id) === null);
  const staffTrack = db.select({ id: tracks.id }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"))).limit(1).get();
  if (staffTrack) { for (let i = 1; i <= 5; i++) noteTrialCheck(u.id, staffTrack.id, i); }
  check("a company's staff-only topic never pays, however many answers are noted", !staffTrack || (completeTrial(u.id, staffTrack.id) === null && here(staffTrack.id) === 0));
  check("each person's answers are their own", completeTrial(u.id + 12345, t0.id) === null);
} finally {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@trial.check")).all().map((r) => r.id);
  for (const id of us) { db.delete(dailyQuests).where(eq(dailyQuests.userId, id)).run(); db.delete(enrollments).where(eq(enrollments.userId, id)).run(); db.delete(users).where(eq(users.id, id)).run(); }
}

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

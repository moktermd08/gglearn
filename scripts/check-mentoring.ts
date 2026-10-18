/** Checks mentoring: npm run check:mentoring (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, careerGoals, certificates, dailyQuests, db, enrollments, mentorships, notifications, runs, tracks, users } from "../lib/db";
import { MAX_CHILDREN, MAX_MENTEES, MAX_MENTORS, MAX_PARENTS, kindOf, NOTE_MAX, acceptMentorship, encourage, endMentorship, isMentor, menteeSummary, menteesOf, mentorsOf } from "../lib/mentoring";
import { referralCode } from "../lib/referrals";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const ok = (r: { ok?: true; error?: string }) => "ok" in r;
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@mentor.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(mentorships).where(inArray(mentorships.mentorId, us)).run(); db.delete(mentorships).where(inArray(mentorships.menteeId, us)).run();
  db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(careerGoals).where(inArray(careerGoals.userId, us)).run(); db.delete(certificates).where(inArray(certificates.userId, us)).run();
  db.delete(runs).where(inArray(runs.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(enrollments).where(inArray(enrollments.userId, us)).run();
  db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400;
try {
  const mk = (n: string, status: "active" | "offboarded" = "active", role: "learner" | "admin" = "learner") => db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Mentorson`, email: `${n}@mentor.check`, jobRole: "general", audience: "staff", guest: "yes", role, status, passwordHash: "x" }).returning().get();
  const mentee = mk("mentee"), mentor = mk("mentor"), other = mk("other"), gone = mk("gone", "offboarded"), boss = mk("boss", "active", "admin");
  const py = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;
  const staff = db.select({ id: tracks.id, name: tracks.name }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"))).limit(1).get()!;
  const code = referralCode(mentee.id);

  // ---- agreeing ----
  check("a mentor invitation is the mentee's own signed link", acceptMentorship(mentor.id, "junk") && "error" in acceptMentorship(mentor.id, "junk") && "error" in acceptMentorship(mentor.id, "1-AAAAAAAAAA"));
  check("nobody can accept their own invitation", !ok(acceptMentorship(mentee.id, code)));
  check("an invitation from someone who has left is not valid", !ok(acceptMentorship(mentor.id, referralCode(gone.id))));
  check("nothing is shared before anyone accepts", !isMentor(mentor.id, mentee.id) && menteeSummary(mentor.id, mentee.id) === null && mentorsOf(mentee.id).length === 0);
  check("pressing the button on the link makes them the mentor, and tells the mentee", ok(acceptMentorship(mentor.id, code)) && isMentor(mentor.id, mentee.id) && !isMentor(mentee.id, mentor.id) && db.select().from(notifications).where(and(eq(notifications.userId, mentee.id), like(notifications.key, "mentor-yes-%"))).all().length === 1);
  check("it works one way only: the mentee does not see the mentor's progress", menteeSummary(mentee.id, mentor.id) === null);
  check("accepting twice changes nothing", ok(acceptMentorship(mentor.id, code)) && db.select().from(mentorships).where(eq(mentorships.menteeId, mentee.id)).all().length === 1);
  check("each side lists the other", mentorsOf(mentee.id).map((m) => m.name).join() === "Mentor M." && menteesOf(mentor.id).map((m) => m.name).join() === "Mentee Mentorson");
  check("a stranger sees nothing", menteeSummary(other.id, mentee.id) === null && menteeSummary(boss.id, mentee.id) === null);

  // ---- what a mentor sees ----
  db.insert(enrollments).values({ userId: mentee.id, trackId: py.id }).run(); db.insert(enrollments).values({ userId: mentee.id, trackId: staff.id }).run();
  db.insert(runs).values({ userId: mentee.id, trackId: py.id, level: 3, score: 0.9, passed: true, finishedAt: t - D }).run();
  db.insert(runs).values({ userId: mentee.id, trackId: py.id, level: 4, score: 0.5, passed: false, finishedAt: t - 3600 }).run();
  db.insert(dailyQuests).values({ userId: mentee.id, trackId: py.id, day: new Date(t * 1000).toISOString().slice(0, 10), kind: "drill", xp: 30 }).run();
  db.insert(certificates).values({ userId: mentee.id, trackId: py.id, level: 5, code: "MENTORCERT1", score: 0.9, signature: "x" }).run();
  db.insert(certificates).values({ userId: mentee.id, trackId: py.id, level: 10, code: "MENTORCERT2", score: 0.9, revokedAt: t, signature: "x" }).run();
  db.insert(careerGoals).values({ userId: mentee.id, targetRole: "developer", targetLevel: 3, targetDate: t + 90 * D }).run();
  const s = menteeSummary(mentor.id, mentee.id, t)!;
  check("the mentor sees the week, the streak, certificates (not revoked) and the goal", s.weekXp >= 30 + 90 + 0 && s.streak >= 1 && s.certificates === 1 && s.goal?.date === t + 90 * D && /developer/i.test(s.goal.role));
  check("...and the topics worked on, with the best level passed (not one that was failed)", s.topics.find((x) => x.name === "Python")?.passed === 3);
  check("a topic the mentor could not see themselves is not named", s.topics.some((x) => x.name === "a topic") && !JSON.stringify(s).includes(staff.name));
  check("the person who runs the whole academy as mentor sees the topic's name", menteeSummary((() => { acceptMentorship(boss.id, code); return boss.id; })(), mentee.id, t)!.topics.some((x) => x.name !== "a topic" && x.name !== "Python"));
  check("it carries nothing beyond that: no email, no ids, no other people", !JSON.stringify(s).includes("@") && Object.keys(s).sort().join() === "certificates,goal,name,streak,topics,weekXp");

  // ---- caps ----
  const full = mk("full"); for (let i = 0; i < MAX_MENTORS; i++) db.insert(mentorships).values({ mentorId: mk(`m${i}`).id, menteeId: full.id }).run();
  check("a mentee has at most three mentors", !ok(acceptMentorship(other.id, referralCode(full.id))) && mentorsOf(full.id).length === MAX_MENTORS);
  const busy = mk("busy"); for (let i = 0; i < MAX_MENTEES; i++) db.insert(mentorships).values({ mentorId: busy.id, menteeId: mk(`e${i}`).id }).run();
  check("a mentor has at most twenty-five mentees", !ok(acceptMentorship(busy.id, referralCode(other.id))));

  // ---- encouragement ----
  check("a mentor can send a short note, and the mentee gets it", ok(encourage(mentor.id, mentee.id, "  Great work   on that level!  ", t)) && db.select().from(notifications).where(and(eq(notifications.userId, mentee.id), like(notifications.key, "mentor-note-%"))).all().some((n) => n.body === "Great work on that level!" && /Mentor M\., your mentor, says/.test(n.title)));
  check("nobody else can send one, in either direction", !ok(encourage(other.id, mentee.id, "hello there")) && !ok(encourage(mentee.id, mentor.id, "hello there")));
  check("a note must have words and fit the limit", !ok(encourage(mentor.id, mentee.id, " ")) && !ok(encourage(mentor.id, mentee.id, "x".repeat(NOTE_MAX + 1))) && ok(encourage(mentor.id, mentee.id, "y".repeat(NOTE_MAX))));
  for (let i = 0; i < 6; i++) encourage(mentor.id, mentee.id, `note ${i} here`);
  check("a mentor cannot flood someone: a few a day", !ok(encourage(mentor.id, mentee.id, "one more note")));

  // ---- ending ----
  endMentorship(mentee.id, mentor.id);
  check("the mentee can end it, and the mentor sees nothing more", !isMentor(mentor.id, mentee.id) && menteeSummary(mentor.id, mentee.id) === null && !ok(encourage(mentor.id, mentee.id, "still there?")));
  acceptMentorship(mentor.id, code);
  endMentorship(mentor.id, mentee.id);
  check("the mentor can end it too, and neither is told", !isMentor(mentor.id, mentee.id) && db.select().from(notifications).where(and(eq(notifications.userId, mentor.id), like(notifications.key, "mentor-%"))).all().length === 0);

  // ---- parents ----
  const par = mk("par"), par2 = mk("parb");
  check("a parent follows a child through the child's own parent link, and the child is told", ok(acceptMentorship(par.id, code, "parent")) && kindOf(par.id, mentee.id) === "parent" && isMentor(par.id, mentee.id)
    && db.select().from(notifications).where(and(eq(notifications.userId, mentee.id), like(notifications.title, "% is now your parent"))).all().length === 1);
  check("the parent sees the same limited summary and no email", (() => { const x = menteeSummary(par.id, mentee.id, t); return !!x && !JSON.stringify(x).includes("@") && Object.keys(x).sort().join() === "certificates,goal,name,streak,topics,weekXp"; })());
  check("the child does not see the parent's progress", menteeSummary(mentee.id, par.id) === null);
  check("someone cannot be both mentor and parent to the same person", !ok(acceptMentorship(par.id, code, "mentor")) && kindOf(par.id, mentee.id) === "parent");
  check("a parent note says it is from a parent", ok(encourage(par.id, mentee.id, "Proud of you", t)) && db.select().from(notifications).where(and(eq(notifications.userId, mentee.id), like(notifications.title, "%your parent, says:"))).all().length === 1);
  check("parents and mentors are counted separately", (() => { for (let i = 0; i < MAX_MENTORS; i++) db.insert(mentorships).values({ mentorId: mk(`pm${i}`).id, menteeId: par2.id }).run(); return ok(acceptMentorship(par.id, referralCode(par2.id), "parent")); })());
  check("a child has at most four parents", (() => { const kid = mk("kid"); for (let i = 0; i < MAX_PARENTS; i++) db.insert(mentorships).values({ mentorId: mk(`pp${i}`).id, menteeId: kid.id, kind: "parent" }).run(); return !ok(acceptMentorship(other.id, referralCode(kid.id), "parent")); })());
  check("a parent follows at most ten children", (() => { const p = mk("bigpar"); for (let i = 0; i < MAX_CHILDREN; i++) db.insert(mentorships).values({ mentorId: p.id, menteeId: mk(`ch${i}`).id, kind: "parent" }).run(); return !ok(acceptMentorship(p.id, referralCode(other.id), "parent")); })());
  endMentorship(mentee.id, par.id);
  check("the child can end it", !isMentor(par.id, mentee.id));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@mentor.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

/** Checks classes and assignments: npm run check:classes (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, classAssignments, dailyQuests, db, enrollments, runs, teamMembers, teams, tracks, users } from "../lib/db";
import { MAX_ASSIGNMENTS, assignableTopics, assignmentsOf, createAssignment, enrolInClass, myAssignments, removeAssignment, rosterFor, statusOf } from "../lib/classes";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const ok = (r: { ok?: true; error?: string }) => "ok" in r;
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@class.check")).all().map((r) => r.id);
  const ts = db.select({ id: teams.id }).from(teams).where(like(teams.name, "zz-%")).all().map((r) => r.id);
  if (ts.length) { db.delete(classAssignments).where(inArray(classAssignments.teamId, ts)).run(); db.delete(teamMembers).where(inArray(teamMembers.teamId, ts)).run(); }
  if (us.length) { db.delete(runs).where(inArray(runs.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(enrollments).where(inArray(enrollments.userId, us)).run(); }
  if (ts.length) db.delete(teams).where(inArray(teams.id, ts)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400;
try {
  const mk = (n: string, status: "active" | "offboarded" = "active") => db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Student`, email: `${n}@class.check`, jobRole: "general", audience: "staff", guest: "yes", status, passwordHash: "x" }).returning().get();
  const teacher = mk("teacher"), other = mk("other"), s1 = mk("s1"), s2 = mk("s2"), s3 = mk("s3"), gone = mk("gone", "offboarded");
  const py = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!, js = db.select().from(tracks).where(eq(tracks.slug, "javascript-titan")).get()!, git = db.select().from(tracks).where(eq(tracks.slug, "git-titan")).get()!;
  const klass = db.insert(teams).values({ name: "zz-Year 9 Coding", ownerId: teacher.id, kind: "class" }).returning().get();
  const plain = db.insert(teams).values({ name: "zz-Friends", ownerId: teacher.id, kind: "team" }).returning().get();
  const join = (teamId: number, u: number) => db.insert(teamMembers).values({ teamId, userId: u }).run();
  for (const id of [teacher.id, s1.id, s2.id, s3.id, gone.id]) join(klass.id, id);
  join(plain.id, teacher.id); join(plain.id, s1.id);
  const enrolled = (u: number, tr: number) => db.select().from(enrollments).where(and(eq(enrollments.userId, u), eq(enrollments.trackId, tr))).all().length;

  // ---- setting assignments ----
  check("the assignable topics are public ones with questions", assignableTopics().length > 3 && assignableTopics().some((x) => x.id === py.id));
  const company = db.select({ id: tracks.id }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"))).limit(1).get();
  check("a company's staff-only topic cannot be assigned", !company || !ok(createAssignment(teacher.id, klass.id, company.id, 3, 14)) && !assignableTopics().some((x) => x.id === company.id));
  check("only the teacher can set one, and only on a class", !ok(createAssignment(other.id, klass.id, py.id, 3, 14)) && !ok(createAssignment(s1.id, klass.id, py.id, 3, 14)) && !ok(createAssignment(teacher.id, plain.id, py.id, 3, 14)));
  check("a level outside 1 to 20 and a deadline outside 1 to 180 days are refused", [0, 21, -1, 2.5].every((l) => !ok(createAssignment(teacher.id, klass.id, py.id, l, 14))) && [0, 181, -3].every((d) => !ok(createAssignment(teacher.id, klass.id, py.id, 3, d))));
  const a1 = createAssignment(teacher.id, klass.id, py.id, 2, 7, t) as { ok: true; id: number };
  check("a good assignment is set", ok(a1) && assignmentsOf(klass.id).length === 1);
  check("it puts the students already in the class on the topic, and not the teacher or outsiders", [s1.id, s2.id, s3.id].every((u) => enrolled(u, py.id) === 1) && enrolled(other.id, py.id) === 0);
  join(klass.id, other.id);
  enrolInClass(klass.id, other.id);
  check("a student who joins later is put on every assigned topic", enrolled(other.id, py.id) === 1);
  enrolInClass(plain.id, s1.id);
  check("a plain team does not enrol anyone", enrolled(s1.id, js.id) === 0);

  // ---- status ----
  check("done once the level is passed, late after the deadline, open before", statusOf(2, { level: 2, dueAt: t + D }, t) === "done" && statusOf(5, { level: 2, dueAt: t - D }, t) === "done" && statusOf(1, { level: 2, dueAt: t - D }, t) === "late" && statusOf(1, { level: 2, dueAt: t + D }, t) === "open");

  // ---- what each student has done ----
  const pass = (u: number, tr: number, level: number, at: number) => db.insert(runs).values({ userId: u, trackId: tr, level, score: 0.9, passed: true, finishedAt: at }).run();
  pass(s1.id, py.id, 1, t - 3 * D); pass(s1.id, py.id, 2, t - 2 * D);   // s1 did it
  pass(s2.id, py.id, 1, t - D);                                           // s2 is part way
  pass(s3.id, git.id, 4, t - 100);                                        // s3 did a lot, but of something else
  db.insert(dailyQuests).values({ userId: s3.id, trackId: git.id, day: new Date(t * 1000).toISOString().slice(0, 10), kind: "drill", xp: 30 }).run();
  createAssignment(teacher.id, klass.id, js.id, 1, 3, t - 10 * D); // a second one that has already fallen due
  const R = rosterFor(teacher.id, klass.id, t)!;
  const row = (u: number) => R.students.find((s) => s.userId === u)!;
  check("only the teacher gets a roster", rosterFor(s1.id, klass.id) === null && rosterFor(other.id, klass.id) === null && rosterFor(teacher.id, plain.id) === null && rosterFor(teacher.id, 999999) === null);
  check("it lists the students, not the teacher, and not people who have left", R.students.map((s) => s.userId).sort().join() === [s1.id, s2.id, s3.id, other.id].sort().join());
  check("each student's assignments are marked from their real exams", row(s1.id).each.find((e) => e.assignmentId === a1.id)?.status === "done" && row(s2.id).each.find((e) => e.assignmentId === a1.id)?.status === "open" && row(s2.id).each.find((e) => e.assignmentId === a1.id)?.passed === 1);
  check("an assignment past its deadline is late for whoever has not done it", row(s1.id).late === 1 && row(s3.id).late === 1 && row(s1.id).done === 1 && row(s1.id).total === 2);
  check("what a student did on other topics is not shown: s3's Git work does not count as practice on the assigned topics", row(s3.id).lastPracticed === null && row(s1.id).lastPracticed === t - 2 * D);
  check("the roster carries nothing beyond names, assignment status and last practice", Object.keys(row(s1.id)).sort().join() === "done,each,joinedAt,lastPracticed,late,name,total,userId" && !JSON.stringify(R).includes("@class.check") && !JSON.stringify(R).includes("xp"));
  check("whoever needs attention comes first", R.students[0].late >= R.students[R.students.length - 1].late);

  // ---- a student's own view ----
  const mine = myAssignments(s1.id, klass.id, t);
  check("a student sees the class's assignments with their own progress, and only that", mine.length === 2 && mine.find((m) => m.id === a1.id)?.status === "done" && JSON.stringify(mine).indexOf("s2@") < 0 && !mine.some((m) => "userId" in m));
  check("another student's progress is not in it", myAssignments(s2.id, klass.id, t).find((m) => m.id === a1.id)?.passed === 1);

  // ---- removing ----
  check("only the teacher removes one", !ok(removeAssignment(s1.id, a1.id)) && !ok(removeAssignment(other.id, a1.id)) && assignmentsOf(klass.id).length === 2);
  check("the teacher removes one, and it leaves the roster and the student's list", ok(removeAssignment(teacher.id, a1.id)) && assignmentsOf(klass.id).length === 1 && rosterFor(teacher.id, klass.id, t)!.assignments.length === 1 && myAssignments(s1.id, klass.id, t).length === 1);
  check("removing twice does nothing", ok(removeAssignment(teacher.id, a1.id)) && assignmentsOf(klass.id).length === 1);

  // ---- the cap ----
  for (let i = 0; i < MAX_ASSIGNMENTS; i++) createAssignment(teacher.id, klass.id, py.id, 1 + (i % 20), 30);
  check("a class has at most thirty assignments at once", assignmentsOf(klass.id).length === MAX_ASSIGNMENTS && !ok(createAssignment(teacher.id, klass.id, py.id, 3, 30)));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@class.check")).all().length === 0 && db.select().from(teams).where(like(teams.name, "zz-%")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

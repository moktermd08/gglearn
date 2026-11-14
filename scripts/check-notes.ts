/**
 * Checks notes on exam questions: npm run check:notes (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows; the database
 * parts need two companies and a question, and are skipped on an empty database. Run db:push first).
 * Who may review someone's answers (a manager who runs them, a mentor they have let, never a parent or themselves), the limits on notes,
 * that the learner can read, acknowledge and reply once, and that a note never changes a score.
 */
import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { answerNotes, answers, companies, db, mentorships, notifications, questions, runs, securityLog, tracks, userScopes, users } from "../lib/db";
import { ackNote, addNote, cleanText, deleteNote, mentorMayReview, notesForAnswers, replyToNote, waitingCount, waitingNotes, whyNotReview } from "../lib/questionNotes";
import { MAX_BY_ONE_PER_ANSWER, NOTE_MAX, REPLY_MAX } from "../lib/questionNoteText";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const form = (o: Record<string, string | number>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, String(v)); return fd; };
const ok = (r: { error?: string; done?: string } | null) => !!r?.done && !r.error;
const bad = (r: { error?: string; done?: string } | null) => !!r?.error && !r.done;

// ---- pure: tidying text
check("line breaks are kept, runs of spaces and blank lines are tidied", cleanText("  a   b\r\n\r\n\r\n\r\nc  ", 100) === "a b\n\nc");
check("it is cut to the limit", cleanText("x".repeat(900), NOTE_MAX).length === NOTE_MAX);
check("a non-string is empty", cleanText(null, 10) === "");

// ---- the source
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const act = src("app/note-actions.ts");
check("every note action refuses while viewing as someone, and works as the real signed-in person", (act.match(/refuseWhileViewingAs\(\)/g) ?? []).length >= 1 && act.includes("real.id === me.id") && ["addNoteAction", "deleteNoteAction", "ackNoteAction", "replyNoteAction", "setReviewAnswers"].every((n) => act.includes(`function ${n}(`)));
check("a parent can never be let review answers", src("lib/questionNotes.ts").includes('eq(mentorships.kind, "mentor")') && act.includes('eq(mentorships.kind, "mentor")'));
check("the learner page and the feedback page show notes only to the learner themselves", src("app/(site)/feedback/page.tsx").includes("waitingNotes(me.id)") && src("app/(site)/run/[id]/page.tsx").includes("eq(runs.userId, user.id)"));
check("a mentor's review page shows nothing unless the rule allows it", src("app/(site)/mentoring/[id]/page.tsx").includes("whyNotReview(me, id) !== null"));

// ---- database
const cos = db.select().from(companies).orderBy(companies.id).limit(2).all();
const q = db.select().from(questions).get();
const made: number[] = [], runIds: number[] = [];
if (cos.length < 2 || !q) console.log("skip database checks (needs two companies and a question)");
else {
  const [A, B] = cos.map((c) => c.id);
  const person = (tag: string, role: "learner" | "manager" | "admin", scope?: number, extra: Partial<typeof users.$inferInsert> = {}) => {
    const u = db.insert(users).values({ email: `t-${tag}@notes.check`, name: `t-${tag}`, jobRole: "developer", role, ...extra }).returning().get();
    made.push(u.id);
    if (scope) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: scope }).run();
    return u;
  };
  try {
    const learner = person("learner", "learner", A), mgrA = person("mgrA", "manager", A), mgrB = person("mgrB", "manager", B);
    const adminA = person("adminA", "admin", A), mentor = person("mentor", "learner"), parent = person("parent", "learner"), stranger = person("stranger", "learner");
    const gone = person("gone", "learner", A, { status: "offboarded" });
    const link = (followerId: number, kind: "mentor" | "parent", review: boolean) => db.insert(mentorships).values({ mentorId: followerId, menteeId: learner.id, kind, reviewAnswers: review }).run();
    link(mentor.id, "mentor", false); link(parent.id, "parent", true); // a parent flagged on still never counts
    const mk = (u: number, finished = true) => { const r = db.insert(runs).values({ userId: u, trackId: q.trackId, level: 1, score: 0.4, passed: false, finishedAt: finished ? Math.floor(Date.now() / 1000) : null }).returning().get(); runIds.push(r.id); return r; };
    const run1 = mk(learner.id), runOpen = mk(learner.id, false);
    const ans = db.insert(answers).values({ runId: run1.id, questionId: q.id, response: "a", score: 0.4 }).returning().get();
    const ans2 = db.insert(answers).values({ runId: run1.id, questionId: q.id, response: "b", score: 0.2 }).returning().get();
    const ansOpen = db.insert(answers).values({ runId: runOpen.id, questionId: q.id, response: "c", score: 0 }).returning().get();
    const as = (u: { id: number; role: string }) => ({ id: u.id, role: u.role as "admin" | "manager" | "learner" });

    // who may review
    check("a manager who runs them may", whyNotReview(as(mgrA), learner.id) === null);
    check("an admin who runs them may", whyNotReview(as(adminA), learner.id) === null);
    check("a manager of another company may not", whyNotReview(as(mgrB), learner.id) !== null);
    check("a stranger may not", whyNotReview(as(stranger), learner.id) !== null);
    check("nobody reviews themselves", whyNotReview(as(learner), learner.id) !== null);
    check("not someone offboarded", whyNotReview(as(mgrA), gone.id) !== null);
    check("a mentor may not until the learner lets them", whyNotReview(as(mentor), learner.id) !== null && !mentorMayReview(mentor.id, learner.id));
    db.update(mentorships).set({ reviewAnswers: true }).where(eq(mentorships.mentorId, mentor.id)).run();
    check("a mentor may once the learner has let them", whyNotReview(as(mentor), learner.id) === null && mentorMayReview(mentor.id, learner.id));
    check("a parent never may, even if the flag were on", whyNotReview(as(parent), learner.id) !== null && !mentorMayReview(parent.id, learner.id));

    // leaving notes
    check("a stranger's note is refused", bad(addNote(as(stranger), form({ answerId: ans.id, kind: "suggestion", body: "try again please" }))));
    check("a note on an unfinished attempt is refused", bad(addNote(as(mgrA), form({ answerId: ansOpen.id, kind: "suggestion", body: "try again please" }))));
    check("a note on a question that does not exist is refused", bad(addNote(as(mgrA), form({ answerId: 999999999, kind: "suggestion", body: "try again please" }))));
    check("a note that is too short is refused", bad(addNote(as(mgrA), form({ answerId: ans.id, kind: "suggestion", body: "ok" }))));
    check("a manager leaves a suggestion", ok(addNote(as(mgrA), form({ answerId: ans.id, kind: "suggestion", body: "Re-read the part on discovery calls, then try again." }))));
    check("an unknown kind becomes a suggestion", ok(addNote(as(mgrA), form({ answerId: ans.id, kind: "shout", body: "Second note on the same answer." }))) && notesForAnswers([ans.id]).get(ans.id)![1].kind === "suggestion");
    check("a mentor with permission leaves praise", ok(addNote(as(mentor), form({ answerId: ans.id, kind: "praise", body: "Good reasoning on the first step." }))));
    check("one person is limited per question", ok(addNote(as(mgrA), form({ answerId: ans.id, kind: "question", body: "What made you pick that option?" }))) && bad(addNote(as(mgrA), form({ answerId: ans.id, kind: "suggestion", body: "A fourth one should not fit." }))) && MAX_BY_ONE_PER_ANSWER === 3);
    check("a note never changes the score", db.select().from(answers).where(eq(answers.id, ans.id)).get()!.score === 0.4 && db.select().from(runs).where(eq(runs.id, run1.id)).get()!.score === 0.4);
    const sent = db.select().from(notifications).where(and(eq(notifications.userId, learner.id), eq(notifications.kind, "system"))).all();
    check("the learner is told once per reviewer per attempt, not once per note", sent.filter((n) => n.title.includes("left feedback") && n.title.includes("t-mgrA")).length === 1 && sent.some((n) => n.title.includes("t-mentor") && n.title.includes("left feedback")));
    check("the notification points at that question", sent.some((n) => n.href === `/run/${run1.id}#q${ans.id}`));
    check("the notes come back oldest first", (() => { const ns = notesForAnswers([ans.id]).get(ans.id)!; return ns.length === 4 && ns.every((n, k) => k === 0 || ns[k - 1].id < n.id); })());

    // the learner's side
    const first = notesForAnswers([ans.id]).get(ans.id)![0];
    check("the learner has notes waiting", waitingCount(learner.id) === 4 && waitingNotes(learner.id).length === 4);
    check("someone else cannot say it was read", bad(ackNote({ id: stranger.id }, form({ noteId: first.id }))) && !db.select().from(answerNotes).where(eq(answerNotes.id, first.id)).get()!.ackAt);
    check("the learner marks it read", ok(ackNote({ id: learner.id }, form({ noteId: first.id }))) && waitingCount(learner.id) === 3);
    check("a short reply is refused, and only the learner can reply", bad(replyToNote({ id: learner.id }, form({ noteId: first.id, reply: "k" }))) && bad(replyToNote({ id: stranger.id }, form({ noteId: first.id, reply: "thanks, will do" }))));
    check("the learner replies once", ok(replyToNote({ id: learner.id }, form({ noteId: first.id, reply: "Thanks, I will re-read it tonight." }))) && bad(replyToNote({ id: learner.id }, form({ noteId: first.id, reply: "and another" }))));
    check("a reply is cut to its limit", cleanText("y".repeat(900), REPLY_MAX).length === REPLY_MAX);
    check("the author is told, and sent to where they read notes", !!db.select().from(notifications).where(and(eq(notifications.userId, mgrA.id), eq(notifications.title, "t-learner replied to your note"))).get() && db.select().from(notifications).where(eq(notifications.userId, mgrA.id)).all().some((n) => n.href === `/admin/people/${learner.id}#q${ans.id}`));

    // removing notes
    const [, second, byMentor] = notesForAnswers([ans.id]).get(ans.id)!;
    check("the learner cannot remove a reviewer's note", bad(deleteNote(as(learner), form({ noteId: second.id }))));
    check("a reviewer out of reach cannot", bad(deleteNote(as(mgrB), form({ noteId: second.id }))));
    check("a mentor cannot remove a manager's note", bad(deleteNote(as(mentor), form({ noteId: second.id }))));
    check("the author removes their own", ok(deleteNote(as(mentor), form({ noteId: byMentor.id }))) && notesForAnswers([ans.id]).get(ans.id)!.every((n) => n.id !== byMentor.id));
    check("someone who runs the learner may remove another's, and it is logged", ok(deleteNote(as(adminA), form({ noteId: second.id }))) && !!db.select().from(securityLog).where(and(eq(securityLog.actorId, adminA.id), eq(securityLog.action, "note_delete"))).get());
    check("a removed note is only marked, and cannot be removed twice", !!db.select().from(answerNotes).where(eq(answerNotes.id, second.id)).get()?.deletedAt && bad(deleteNote(as(adminA), form({ noteId: second.id }))));
    check("a removed note no longer counts as waiting", waitingCount(learner.id) === 1);
    check("the learner cannot reply to or read a removed note", bad(ackNote({ id: learner.id }, form({ noteId: second.id }))));

    // permission taken back
    db.update(mentorships).set({ reviewAnswers: false }).where(eq(mentorships.mentorId, mentor.id)).run();
    check("when the learner switches it off the mentor can no longer review", whyNotReview(as(mentor), learner.id) !== null && bad(addNote(as(mentor), form({ answerId: ans2.id, kind: "praise", body: "Nice work again." }))));
  } finally {
    if (made.length) {
      db.delete(securityLog).where(inArray(securityLog.actorId, made)).run();
      db.delete(notifications).where(inArray(notifications.userId, made)).run();
      db.delete(answerNotes).where(inArray(answerNotes.learnerId, made)).run();
      if (runIds.length) db.delete(answers).where(inArray(answers.runId, runIds)).run();
      if (runIds.length) db.delete(runs).where(inArray(runs.id, runIds)).run();
      db.delete(mentorships).where(inArray(mentorships.menteeId, made)).run();
      db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
      db.delete(users).where(inArray(users.id, made)).run();
    }
    void tracks;
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

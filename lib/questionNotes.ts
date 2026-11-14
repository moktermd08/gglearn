import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { answerNotes, answers, db, mentorships, questions, runs, tracks, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { allowed, hit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/securityLog";
import { KIND_LABEL, MAX_BY_ONE_PER_ANSWER, MAX_PER_ANSWER, MAX_PER_DAY, NOTE_KINDS, NOTE_MAX, NOTE_MIN, REPLY_MAX, type NoteKind } from "@/lib/questionNoteText";
import type { SetupState } from "@/lib/setup";

export { KIND_LABEL, NOTE_KINDS, NOTE_MAX, REPLY_MAX, type NoteKind };
import { reachOf, userInReach } from "@/lib/tenancy";

/**
 * Notes on the questions of a finished exam attempt: a reviewer reads what someone answered and leaves a suggestion, some praise, or a
 * question under one question; the learner sees it there, can say "got it", and can reply once.
 *
 * Who may review someone's answers:
 *  - a manager or admin who runs them (their reach), as they may already see their record; a super admin therefore too;
 *  - a mentor, only when the learner has turned on "review my exam answers" for that mentor (mentorships.reviewAnswers). Mentoring has
 *    always promised mentors never see answers, so this is the learner's choice, per mentor, and can be taken back at any time;
 *  - never a parent or guardian, and never the learner about themselves.
 * Notes are plain text. They are kept apart from the attempt, so they never change a score; a deleted one is only marked.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;


/** Plain text, line breaks kept (at most one blank line), everything else tidied. */
export function cleanText(v: FormDataEntryValue | null, max: number): string {
  const s = typeof v === "string" ? v : "";
  return s.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

/** Does this mentor have the learner's permission to review their answers? */
export const mentorMayReview = (mentorId: number, learnerId: number) =>
  !!db.select({ id: mentorships.id }).from(mentorships).where(and(eq(mentorships.mentorId, mentorId), eq(mentorships.menteeId, learnerId), eq(mentorships.kind, "mentor"), eq(mentorships.reviewAnswers, true))).get();

/** Why this person may not read and note this learner's answers, or null when they may. */
export function whyNotReview(me: Me, learnerId: number, reach = reachOf(me.id)): string | null {
  if (me.id === learnerId) return "Nobody reviews their own answers here.";
  const l = db.select({ status: users.status }).from(users).where(eq(users.id, learnerId)).get();
  if (!l) return "That person does not exist.";
  if (l.status !== "active") return "That person is not active.";
  if ((me.role === "manager" || me.role === "admin") && userInReach(reach, learnerId)) return null;
  if (mentorMayReview(me.id, learnerId)) return null;
  return "You do not run them, and they have not let you review their answers.";
}

export type NoteView = { id: number; kind: NoteKind; quotable: boolean; body: string; authorId: number; author: string; createdAt: number; ackAt: number | null; reply: string; repliedAt: number | null };

/** The notes on these answers (deleted ones left out), oldest first, by answer id. */
export function notesForAnswers(answerIds: number[]): Map<number, NoteView[]> {
  const out = new Map<number, NoteView[]>();
  if (!answerIds.length) return out;
  const rows = db.select({ n: answerNotes, who: users.name }).from(answerNotes).innerJoin(users, eq(users.id, answerNotes.authorId))
    .where(and(inArray(answerNotes.answerId, answerIds), isNull(answerNotes.deletedAt))).orderBy(answerNotes.id).all();
  for (const { n, who } of rows) out.set(n.answerId, [...(out.get(n.answerId) ?? []), { id: n.id, kind: n.kind, quotable: n.quotable, body: n.body, authorId: n.authorId, author: who, createdAt: n.createdAt, ackAt: n.ackAt, reply: n.reply, repliedAt: n.repliedAt }]);
  return out;
}

/** How many notes are waiting for this learner (not yet "got it"). */
export const waitingCount = (learnerId: number) => db.select({ id: answerNotes.id }).from(answerNotes).where(and(eq(answerNotes.learnerId, learnerId), isNull(answerNotes.ackAt), isNull(answerNotes.deletedAt))).all().length;

const courseName = (name: string) => name.replace(/^\d+\.\s*/, "");

/** Leaves a note under one question of a finished attempt. */
export function addNote(me: Me, fd: FormData): SetupState {
  const answerId = Number(fd.get("answerId"));
  const row = Number.isInteger(answerId) ? db.select({ a: answers, r: runs }).from(answers).innerJoin(runs, eq(runs.id, answers.runId)).where(eq(answers.id, answerId)).get() : undefined;
  if (!row || row.r.finishedAt == null) return { error: "That question is not part of a finished attempt." };
  const learnerId = row.r.userId;
  const no = whyNotReview(me, learnerId);
  if (no) return { error: no };
  const kind = NOTE_KINDS.find((k) => k === fd.get("kind")) ?? "suggestion";
  const body = cleanText(fd.get("body"), NOTE_MAX);
  if (body.length < NOTE_MIN) return { error: `Write at least ${NOTE_MIN} characters.` };
  const key = `qnote:${me.id}`;
  if (!allowed(key, MAX_PER_DAY)) return { error: "That is plenty for one day. They will see what you have written." };
  const mine = db.select({ id: answerNotes.id }).from(answerNotes).where(and(eq(answerNotes.answerId, answerId), eq(answerNotes.authorId, me.id), isNull(answerNotes.deletedAt))).all().length;
  const all = db.select({ id: answerNotes.id }).from(answerNotes).where(and(eq(answerNotes.answerId, answerId), isNull(answerNotes.deletedAt))).all().length;
  if (mine >= MAX_BY_ONE_PER_ANSWER) return { error: `You have already left ${MAX_BY_ONE_PER_ANSWER} notes on this question. Delete one, or add to an existing note.` };
  if (all >= MAX_PER_ANSWER) return { error: "This question already has plenty of notes." };
  hit(key, DAY * 1000);
  const quotable = kind === "praise" && fd.get("quotable") === "on"; // the author's own say-so that this may be quoted, with their name, on the learner's CV
  const note = db.insert(answerNotes).values({ answerId, runId: row.r.id, learnerId, authorId: me.id, kind, body, quotable }).returning().get();
  const t = db.select({ name: tracks.name }).from(tracks).where(eq(tracks.id, row.r.trackId)).get();
  const who = db.select({ n: users.name }).from(users).where(eq(users.id, me.id)).get()?.n ?? "Someone";
  // one notification per reviewer per attempt per day, so ten notes do not send ten
  notify(learnerId, { key: `qnote:${row.r.id}:${me.id}:${Math.floor(now() / DAY)}`, kind: "system", title: `${who} left feedback on your ${courseName(t?.name ?? "exam")} exam`, body: body.length > 120 ? `${body.slice(0, 117)}…` : body, href: `/run/${row.r.id}#q${answerId}` });
  return { done: note.kind === "praise" ? "Sent. They will be glad to hear it." : "Sent. They will see it under that question." };
}

/** Removes a note: its author may, and so may a manager or admin who runs the learner. The row stays, marked. */
export function deleteNote(me: Me, fd: FormData, ip = ""): SetupState {
  const n = db.select().from(answerNotes).where(eq(answerNotes.id, Number(fd.get("noteId")))).get();
  if (!n || n.deletedAt) return { error: "That note is already gone." };
  const mayModerate = (me.role === "manager" || me.role === "admin") && userInReach(reachOf(me.id), n.learnerId);
  if (n.authorId !== me.id && !mayModerate) return { error: "Only the person who wrote it, or someone who runs the learner, can remove a note." };
  db.update(answerNotes).set({ deletedAt: now(), deletedBy: me.id }).where(eq(answerNotes.id, n.id)).run();
  if (n.authorId !== me.id) recordSecurityEvent({ actorId: me.id, targetId: n.learnerId, action: "note_delete", detail: `a note by user ${n.authorId} was removed`, ip });
  return { done: "Removed." };
}

/** The author takes back permission to quote their praise on the learner's CV. It disappears from the CV at once. */
export function withdrawQuotable(me: { id: number }, fd: FormData): SetupState {
  const n = db.select().from(answerNotes).where(eq(answerNotes.id, Number(fd.get("noteId")))).get();
  if (!n || n.deletedAt || n.authorId !== me.id) return { error: "That note is not yours." };
  db.update(answerNotes).set({ quotable: false }).where(eq(answerNotes.id, n.id)).run();
  return { done: "Withdrawn. It is no longer on their CV." };
}

/** The learner says they have read it. */
export function ackNote(me: { id: number }, fd: FormData): SetupState {
  const n = db.select().from(answerNotes).where(eq(answerNotes.id, Number(fd.get("noteId")))).get();
  if (!n || n.deletedAt || n.learnerId !== me.id) return { error: "That note is not yours." };
  if (!n.ackAt) db.update(answerNotes).set({ ackAt: now() }).where(eq(answerNotes.id, n.id)).run();
  return { done: "Thanks. It is marked as read." };
}

/** The learner's one reply to a note. The author is told. */
export function replyToNote(me: { id: number }, fd: FormData): SetupState {
  const n = db.select().from(answerNotes).where(eq(answerNotes.id, Number(fd.get("noteId")))).get();
  if (!n || n.deletedAt || n.learnerId !== me.id) return { error: "That note is not yours." };
  if (n.repliedAt) return { error: "You have already replied to this one." };
  const text = cleanText(fd.get("reply"), REPLY_MAX);
  if (text.length < 2) return { error: "Write a few words." };
  const key = `qnote-reply:${me.id}`;
  if (!allowed(key, 30)) return { error: "That is plenty for one day." };
  hit(key, DAY * 1000);
  db.update(answerNotes).set({ reply: text, repliedAt: now(), ackAt: n.ackAt ?? now() }).where(eq(answerNotes.id, n.id)).run();
  const who = db.select({ n: users.name }).from(users).where(eq(users.id, me.id)).get()?.n ?? "Someone";
  notify(n.authorId, { key: `qnote-reply:${n.id}`, kind: "system", title: `${who} replied to your note`, body: text.length > 120 ? `${text.slice(0, 117)}…` : text, href: `${mentorMayReview(n.authorId, me.id) ? "/mentoring" : "/admin/people"}/${me.id}#q${n.answerId}` }); // to where the author reads their notes
  return { done: "Sent." };
}

/** What the learner has been told and not yet read, newest first, with the question it is about. */
export function waitingNotes(learnerId: number) {
  return db.select({ n: answerNotes, who: users.name, q: questions, r: runs, t: tracks }).from(answerNotes)
    .innerJoin(users, eq(users.id, answerNotes.authorId)).innerJoin(answers, eq(answers.id, answerNotes.answerId)).innerJoin(questions, eq(questions.id, answers.questionId))
    .innerJoin(runs, eq(runs.id, answerNotes.runId)).innerJoin(tracks, eq(tracks.id, runs.trackId))
    .where(and(eq(answerNotes.learnerId, learnerId), isNull(answerNotes.ackAt), isNull(answerNotes.deletedAt))).orderBy(desc(answerNotes.id)).limit(50).all();
}

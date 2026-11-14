"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { answerNotes, answers, db, mentorships, runs, users } from "@/lib/db";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { addNote, ackNote, deleteNote, replyToNote, withdrawQuotable } from "@/lib/questionNotes";
import { clientIp } from "@/lib/rate-limit";
import type { SetupState } from "@/lib/setup";

/**
 * Notes on exam questions. Each action works as the real signed-in person and re-checks who they are to the learner (lib/questionNotes.ts).
 * They work as the person, or as a super admin viewing as them; every use through a view is logged under the super admin (lib/auth.ts logViewAsUse).
 */
const BLOCKED: SetupState = { error: "You cannot do that right now. Sign in again and try once more." };

async function actor(what: string) {
  const a = await actingUser(); // the person themselves, or a super admin using their account through a view (then logged under the super admin)
  if (!a) return null;
  await logViewAsUse(a.viewedBy, a.me, what);
  return a.me;
}
const learnerOfAnswer = (fd: FormData) => db.select({ u: runs.userId, r: runs.id }).from(answers).innerJoin(runs, eq(runs.id, answers.runId)).where(eq(answers.id, Number(fd.get("answerId")))).get();
const learnerOfNote = (fd: FormData) => db.select({ u: answerNotes.learnerId, r: answerNotes.runId }).from(answerNotes).where(eq(answerNotes.id, Number(fd.get("noteId")))).get();
const refresh = (x: { u: number; r: number } | undefined) => { if (!x) return; revalidatePath(`/admin/people/${x.u}`); revalidatePath(`/mentoring/${x.u}`); revalidatePath(`/run/${x.r}`); revalidatePath("/feedback"); };

export async function addNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor("addNoteAction");
  if (!me) return BLOCKED;
  const where = learnerOfAnswer(fd);
  const r = addNote(me, fd);
  if (r?.done) refresh(where);
  return r;
}

export async function deleteNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor("deleteNoteAction");
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = deleteNote(me, fd, await clientIp());
  if (r?.done) refresh(where);
  return r;
}

export async function withdrawQuotableAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor("withdrawQuotableAction");
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = withdrawQuotable(me, fd);
  if (r?.done) { refresh(where); revalidatePath("/profile/cv"); }
  return r;
}

export async function ackNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor("ackNoteAction");
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = ackNote(me, fd);
  if (r?.done) refresh(where);
  return r;
}

export async function replyNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor("replyNoteAction");
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = replyToNote(me, fd);
  if (r?.done) refresh(where);
  return r;
}

/** The learner lets one of their mentors review their exam answers and leave notes, or takes it back. Only for a mentor (never a parent), and only theirs. */
export async function setReviewAnswers(mentorId: number, on: boolean): Promise<void> {
  const me = await actor("setReviewAnswers");
  if (!me) return;
  const row = db.select().from(mentorships).where(and(eq(mentorships.menteeId, me.id), eq(mentorships.mentorId, mentorId), eq(mentorships.kind, "mentor"))).get();
  if (!row || row.reviewAnswers === on) return;
  db.update(mentorships).set({ reviewAnswers: on }).where(eq(mentorships.id, row.id)).run();
  if (on) {
    const who = db.select({ n: users.name }).from(users).where(eq(users.id, me.id)).get()?.n ?? "Someone you mentor";
    notify(mentorId, { key: `review-on:${me.id}:${mentorId}:${Math.floor(Date.now() / 86400000)}`, kind: "system", title: `${who} lets you review their exam answers`, body: "Open Mentoring to read their answers and leave notes on individual questions.", href: `/mentoring/${me.id}` });
  }
  revalidatePath("/mentoring");
  revalidatePath(`/mentoring/${me.id}`);
}

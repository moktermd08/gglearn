"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { answerNotes, answers, db, mentorships, runs, users } from "@/lib/db";
import { realUser, refuseWhileViewingAs, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { addNote, ackNote, deleteNote, replyToNote } from "@/lib/questionNotes";
import { clientIp } from "@/lib/rate-limit";
import type { SetupState } from "@/lib/setup";

/**
 * Notes on exam questions. Each action works as the real signed-in person and re-checks who they are to the learner (lib/questionNotes.ts).
 * None of them runs while a super admin is viewing as someone: writing a note, or replying and marking one read, would be in someone else's name.
 */
const BLOCKED: SetupState = { error: "Exit the view first: this is done as yourself, not as the person you are viewing." };

async function actor() {
  const me = await requireUser();
  if (await refuseWhileViewingAs()) return null;
  const real = await realUser();
  return real && real.id === me.id ? me : null;
}
const learnerOfAnswer = (fd: FormData) => db.select({ u: runs.userId, r: runs.id }).from(answers).innerJoin(runs, eq(runs.id, answers.runId)).where(eq(answers.id, Number(fd.get("answerId")))).get();
const learnerOfNote = (fd: FormData) => db.select({ u: answerNotes.learnerId, r: answerNotes.runId }).from(answerNotes).where(eq(answerNotes.id, Number(fd.get("noteId")))).get();
const refresh = (x: { u: number; r: number } | undefined) => { if (!x) return; revalidatePath(`/admin/people/${x.u}`); revalidatePath(`/mentoring/${x.u}`); revalidatePath(`/run/${x.r}`); revalidatePath("/feedback"); };

export async function addNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor();
  if (!me) return BLOCKED;
  const where = learnerOfAnswer(fd);
  const r = addNote(me, fd);
  if (r?.done) refresh(where);
  return r;
}

export async function deleteNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor();
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = deleteNote(me, fd, await clientIp());
  if (r?.done) refresh(where);
  return r;
}

export async function ackNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor();
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = ackNote(me, fd);
  if (r?.done) refresh(where);
  return r;
}

export async function replyNoteAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await actor();
  if (!me) return BLOCKED;
  const where = learnerOfNote(fd);
  const r = replyToNote(me, fd);
  if (r?.done) refresh(where);
  return r;
}

/** The learner lets one of their mentors review their exam answers and leave notes, or takes it back. Only for a mentor (never a parent), and only theirs. */
export async function setReviewAnswers(mentorId: number, on: boolean): Promise<void> {
  const me = await actor();
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

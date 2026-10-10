"use server";

import { and, eq, like, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { answers, certificates, checklistItems, db, enrollments, handovers, questions, runs, tracks, users } from "@/lib/db";
import { endSession, requireManager, requireUser, startSession } from "@/lib/auth";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/password";
import { MINUTE, allowed, clear, clientIp, hit } from "@/lib/rate-limit";
import { grade } from "@/lib/grading";
import { levelsPassed } from "@/lib/progress";
import { CERT_LEVELS, MAX_LEVEL, PASS_MARK, QUESTIONS_PER_RUN } from "@/lib/levels";
import { completeQuest } from "@/lib/stats";
import { drillQuestion } from "@/lib/drill";

const ONBOARDING = [
  "Read the brand story and values",
  "Meet your manager and agree your 30-60-90 goals",
  "Get access to the tools for your role",
  "Pass level 3 in your first recommended track",
  "Shadow a teammate on a real task",
];
const OFFBOARDING = [
  "Write handover notes for each area you own",
  "Transfer ownership of accounts, files and customers",
  "Record answers to the 10 questions only you know",
  "Return equipment and revoke tool access",
];

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export async function signup(_: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `signup:${await clientIp()}`;
  if (!allowed(ipKey, 5)) return TOO_MANY;
  hit(ipKey, 60 * MINUTE); // every attempt counts: 5 signups per address per hour
  const p = z.object({
    name: z.string().min(1).max(80),
    email: z.string().email().max(120).transform((s) => s.toLowerCase()),
    password: z.string().min(8).max(200),
  }).safeParse({ name: str(fd.get("name")), email: str(fd.get("email")), password: str(fd.get("password")) });
  if (!p.success) return "Enter a name, a valid email and a password of 8+ characters.";
  if (db.select().from(users).where(eq(users.email, p.data.email)).get()) return "That email is already registered.";
  const u = db.insert(users).values({ ...p.data, passwordHash: await hashPassword(p.data.password) }).returning().get();
  await startSession(u.id);
  redirect("/dashboard");
}

export async function login(_: string | null, fd: FormData): Promise<string | null> {
  const email = str(fd.get("email")).toLowerCase().slice(0, 120);
  const ip = await clientIp();
  const pairKey = `login:${ip}:${email}`, ipKey = `login-ip:${ip}`;
  if (!allowed(pairKey, 5) || !allowed(ipKey, 30)) return TOO_MANY;

  const pw = str(fd.get("password")).slice(0, 200);
  const u = db.select().from(users).where(eq(users.email, email)).get();
  // unknown or offboarded accounts still pay for a hash, so timing does not reveal which emails exist
  const ok = u && u.status === "active" ? await verifyPassword(pw, u.passwordHash) : (await verifyAgainstDummy(pw), false);
  if (!u || !ok) {
    hit(pairKey, 15 * MINUTE);
    hit(ipKey, 15 * MINUTE);
    return "Wrong email or password.";
  }
  clear(pairKey);
  await startSession(u.id);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function enroll(fd: FormData) {
  const u = await requireUser();
  const trackId = Number(fd.get("trackId"));
  const goal = str(fd.get("goal")).slice(0, 300);
  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return;
  db.insert(enrollments).values({ userId: u.id, trackId, goal })
    .onConflictDoUpdate({ target: [enrollments.userId, enrollments.trackId], set: { goal } }).run();
  revalidatePath("/dashboard");
  redirect(`/tracks/${track.slug}`);
}

export async function startRun(fd: FormData) {
  const u = await requireUser();
  const trackId = Number(fd.get("trackId")), level = Number(fd.get("level"));
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return;
  if (!db.select().from(enrollments).where(and(eq(enrollments.userId, u.id), eq(enrollments.trackId, trackId))).get()) return;
  if (level > levelsPassed(u.id, trackId) + 1) return; // levels unlock in order

  // reuse an unfinished run for this level instead of piling up abandoned ones
  const open = db.select().from(runs)
    .where(and(eq(runs.userId, u.id), eq(runs.trackId, trackId), eq(runs.level, level), sql`${runs.finishedAt} is null`)).get();
  if (open) redirect(`/run/${open.id}`);

  // a fresh random draw each run, favouring questions this person has not answered correctly before
  const picked = db.select({ id: questions.id }).from(questions)
    .where(and(eq(questions.trackId, trackId), eq(questions.level, level), eq(questions.status, "active")))
    .orderBy(sql`
      (select count(*) from ${answers} a join ${runs} r on r.id = a.run_id
        where a.question_id = ${questions.id} and r.user_id = ${u.id} and a.score >= 0.8) asc, random()`)
    .limit(QUESTIONS_PER_RUN).all();
  if (!picked.length) return;

  const run = db.insert(runs).values({ userId: u.id, trackId, level }).returning().get();
  db.insert(answers).values(picked.map((q) => ({ runId: run.id, questionId: q.id }))).run();
  redirect(`/run/${run.id}`);
}

export async function submitRun(runId: number, fd: FormData) {
  const u = await requireUser();
  const run = db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, u.id))).get();
  if (!run || run.finishedAt) redirect(`/run/${runId}`);

  const rows = db.select({ a: answers, q: questions }).from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId)).where(eq(answers.runId, runId)).all();

  let earned = 0, possible = 0;
  for (const { a, q } of rows) {
    const response = str(fd.get(`q${q.id}`)).slice(0, 4000);
    const g = await grade(q, response);
    db.update(answers).set({ response, score: g.score, feedback: g.feedback }).where(eq(answers.id, a.id)).run();
    earned += g.score * q.weight;
    possible += q.weight;
  }
  const score = possible ? earned / possible : 0;
  db.update(runs).set({ score, passed: score >= PASS_MARK, finishedAt: Math.floor(Date.now() / 1000) })
    .where(eq(runs.id, runId)).run();
  const passed = score >= PASS_MARK;
  completeQuest(u.id, run.trackId, "exam");
  if (passed && (CERT_LEVELS as readonly number[]).includes(run.level)) {
    db.insert(certificates).values({ userId: u.id, trackId: run.trackId, level: run.level, score, code: randomBytes(5).toString("hex").toUpperCase() })
      .onConflictDoNothing().run();
  }
  revalidatePath("/dashboard");
  redirect(`/run/${runId}`);
}

// ---- daily quests ----

function enrolled(userId: number, trackId: number) {
  return !!db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId))).get();
}

export async function markStudied(trackId: number) {
  const u = await requireUser();
  if (!enrolled(u.id, trackId)) return;
  completeQuest(u.id, trackId, "study");
  revalidatePath("/dashboard");
}

/** Instant feedback for the drill: tells the learner whether a pick was right. */
export async function drillCheck(questionId: number, key: string) {
  const u = await requireUser();
  const q = drillQuestion(u.id, questionId); // only drillable questions, never exam-level ones
  if (!q) return null;
  return { correct: q.answer === key, answer: q.answer ?? "", hint: q.hint };
}

export async function finishDrill(trackId: number) {
  const u = await requireUser();
  if (!enrolled(u.id, trackId)) return 0;
  const xp = completeQuest(u.id, trackId, "drill");
  revalidatePath("/dashboard");
  return xp;
}

// ---- people: onboarding & offboarding (managers/admins) ----

export async function createPerson(_: string | null, fd: FormData): Promise<string | null> {
  await requireManager();
  const p = z.object({
    name: z.string().min(1).max(80),
    email: z.string().email().transform((s) => s.toLowerCase()),
    jobRole: z.string().min(1).max(40),
    password: z.string().min(8).max(200),
  }).safeParse({ name: str(fd.get("name")), email: str(fd.get("email")), jobRole: str(fd.get("jobRole")).toLowerCase(), password: str(fd.get("password")) });
  if (!p.success) return "Name, valid email, role and a temporary password (8+ chars) are required.";
  if (db.select().from(users).where(eq(users.email, p.data.email)).get()) return "That email already exists.";

  const u = db.insert(users).values({ name: p.data.name, email: p.data.email, jobRole: p.data.jobRole, passwordHash: await hashPassword(p.data.password) }).returning().get();
  db.insert(checklistItems).values(ONBOARDING.map((label) => ({ userId: u.id, kind: "onboarding" as const, label }))).run();

  // auto-enrol in the tracks recommended for their job role
  const rec = db.select().from(tracks).where(or(eq(tracks.roles, ""), like(tracks.roles, `%${p.data.jobRole}%`))).limit(6).all();
  if (rec.length) {
    db.insert(enrollments).values(rec.map((t) => ({ userId: u.id, trackId: t.id, goal: `Onboarding path for ${p.data.jobRole}` }))).onConflictDoNothing().run();
  }
  revalidatePath("/admin/people");
  return null;
}

export async function toggleChecklist(id: number) {
  const me = await requireManager();
  const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
  if (!item) return;
  void me;
  db.update(checklistItems).set({ done: !item.done }).where(eq(checklistItems.id, id)).run();
  revalidatePath("/admin/people");
}

export async function addHandover(fd: FormData) {
  await requireManager();
  const userId = Number(fd.get("userId")), notes = str(fd.get("notes")).slice(0, 8000);
  const trackId = Number(fd.get("trackId")) || null;
  if (!notes || !db.select().from(users).where(eq(users.id, userId)).get()) return;
  db.insert(handovers).values({ userId, trackId, notes }).run();
  revalidatePath("/admin/people");
}

export async function offboard(fd: FormData) {
  const me = await requireManager();
  const userId = Number(fd.get("userId"));
  if (userId === me.id) return; // cannot lock yourself out
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.status === "offboarded") return;
  if (me.role !== "admin" && u.role !== "learner") return; // managers can only offboard learners
  db.update(users).set({ status: "offboarded" }).where(eq(users.id, userId)).run(); // access ends now
  db.insert(checklistItems).values(OFFBOARDING.map((label) => ({ userId, kind: "offboarding" as const, label }))).run();
  revalidatePath("/admin/people");
}

export async function retireQuestion(fd: FormData) {
  await requireManager();
  const id = Number(fd.get("id")), status = str(fd.get("status"));
  if (status !== "retired" && status !== "active" && status !== "review") return;
  db.update(questions).set({ status }).where(eq(questions.id, id)).run();
  revalidatePath("/admin");
}


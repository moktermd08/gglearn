"use server";

import { and, eq, inArray, isNull, like, notInArray, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { brands, companies, joinLinks, phaseSignoffs, projects, scopeRequirements, userAvatars, answers, careerGoals, careerLevels, careerRequirements, checklistItems, db, enrollments, handovers, invites, knowledgeItems, promotions, questions, roleExamAnswers, roleExams, runs, tracks, users } from "@/lib/db";
import { offboardUser, provision } from "@/lib/people";
import { enforcedForDomain, ssoRequired } from "@/lib/sso";
import { acknowledge, recordChange } from "@/lib/freshness";
import { coverageFor, hasNoRolePath, knownRoles } from "@/lib/roles";
import { careerFor, roleKey } from "@/lib/careers";
import { canReach } from "@/lib/journey";
import { currentUser, endSession, requireManager, requireUser, revokeSessions, startSession } from "@/lib/auth";
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from "@/lib/password";
import { MINUTE, allowed, clear, clientIp, hit } from "@/lib/rate-limit";
import { grade } from "@/lib/grading";
import { levelsPassed } from "@/lib/progress";
import { MAX_LEVEL, PASS_MARK, QUESTIONS_PER_RUN } from "@/lib/levels";
import { completeQuest } from "@/lib/stats";
import { progressionFor } from "@/lib/progression";
import { hiddenTrackIds } from "@/lib/tracks";
import { drillCompleted, drillQuestion, noteDrillAnswer } from "@/lib/drill";
import { DYNAMIC_PER_RUN, drawDynamic } from "@/lib/dynamic/store";
import { claimPendingInvites } from "@/lib/contests";
import { referrerOf } from "@/lib/referrals";
import { trialTrack } from "@/lib/trial";
import { enrol } from "@/lib/contests";
import { twistFor } from "@/lib/twists";
import { INVITE_TTL_SEC, findOpenInvite, hashToken, newToken } from "@/lib/invites";
import { STARTER_SIZE, starterPlan } from "@/lib/starter";
import { siteUrl } from "@/lib/share";
import { mailConfigured, passwordChangedMail, resetMail, sendInvites, sendMail, signInLinkMail } from "@/lib/mail";
import { safeNext } from "@/lib/nextPath";
import { MAX_BULK, parseBulk } from "@/lib/bulkInvite";
import { MIN_PASSWORD, RESET_TTL_SEC, finishReset, startReset } from "@/lib/passwordReset";
import { LOGIN_LINK_TTL_SEC, spendLoginLink, startLoginLink } from "@/lib/loginLink";
import { lookFor } from "@/lib/brand";
import { changePlaces } from "@/lib/placeChange";
import { entryCompany, entryTopics } from "@/lib/entry";
import { DEFAULT_LINK_DAYS, DEFAULT_LINK_USES, MAX_LINK_DAYS, MAX_LINK_USES, claimPlace, findOpenLink, linkPath } from "@/lib/joinLinks";
import { type Level, isLevel, levelForInvite, refuseAccess, setAccessLevel } from "@/lib/accessLevel";
import type { SetupState } from "@/lib/setup";
import { createRoleExam, gradeRoleExam, openRoleExam, roleExamPlan } from "@/lib/roleExam";
import { isLook } from "@/lib/avatars";
import { awardForPass } from "@/lib/rewards";
import { finalize as finalizeIntegrity } from "@/lib/integrity/session";
import { isGlobal, reachOf, scopeInReach, trackInReach, userInReach } from "@/lib/tenancy";
import { offboardingLines, onboardingLines } from "@/lib/access";
import { canSignOff, gateFor, isPhase, onboardingFor } from "@/lib/onboarding";
import { journeyFor, orderLockFor } from "@/lib/journeyLock";
import { type Audience, catalog, formatScopes, openTo, parseScopes, requirementsFor, resetCatalogCache, scopeLabels, scopeOptions, syncEveryone, syncRequired, validScopes } from "@/lib/paths";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Scope checkboxes in a form are all named "scope" with values like "company:1". */
const formScopes = (fd: FormData) => parseScopes(fd.getAll("scope").filter((v): v is string => typeof v === "string").join(","));

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

/** Account creation is invite-only: a manager issues a single-use link bound to one email address. */
export async function joinWithInvite(token: string, _: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `join:${await clientIp()}`;
  if (!allowed(ipKey, 10)) return TOO_MANY;
  hit(ipKey, 60 * MINUTE);

  const inv = findOpenInvite(token);
  if (!inv) return "This invite link is invalid or has expired. Ask your manager for a new one.";
  const p = z.object({ name: z.string().min(1).max(80), password: z.string().min(8).max(200) })
    .safeParse({ name: str(fd.get("name")), password: str(fd.get("password")) });
  if (!p.success) return "Enter your name and a password of 8+ characters.";

  const passwordHash = await hashPassword(p.data.password);
  let userId: number;
  try {
    // consume the invite and create the account together, so a link can never be used twice
    userId = db.transaction((tx) => {
      const used = tx.update(invites).set({ usedAt: Math.floor(Date.now() / 1000) })
        .where(and(eq(invites.id, inv.id), sql`${invites.usedAt} is null`)).returning().get();
      if (!used) throw new Error("used");
      const role = levelForInvite({ role: inv.role, createdBy: inv.createdBy, scopes: parseScopes(inv.scopes), audience: inv.audience });
      const u = tx.insert(users).values({ name: p.data.name, email: inv.email, jobRole: inv.jobRole, audience: inv.audience, role, passwordHash }).returning().get();
      provision(tx, u.id, u.email, inv.jobRole, inv.audience, parseScopes(inv.scopes));
      return u.id;
    });
  } catch {
    return "This invite link is invalid or has expired. Ask your manager for a new one.";
  }
  await startSession(userId);
  redirect("/dashboard");
}

/**
 * Open sign-up: anyone can make an account. It is the same kind of account a friend gets from a race link (no company, nothing required,
 * `guest: "yes"`), so it only ever sees shared academy topics and races in the open arena. A company, brand or customer invitation still
 * works as before and is what gives someone company material. An email that already has an account gets the same answer as any other failure.
 */
export async function signUp(_: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `signup:${await clientIp()}`;
  if (!allowed(ipKey, 8)) return TOO_MANY;
  hit(ipKey, 60 * MINUTE);
  const p = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(120), password: z.string().min(8).max(200) })
    .safeParse({ name: str(fd.get("name")), email: str(fd.get("email")).toLowerCase(), password: str(fd.get("password")) });
  if (!p.success) return "Enter your name, a valid email and a password of 8 or more characters.";
  const passwordHash = await hashPassword(p.data.password);
  let userId: number;
  try {
    userId = db.transaction((tx) => {
      if (tx.select({ id: users.id }).from(users).where(eq(users.email, p.data.email)).get()) throw new Error("taken");
      const u = tx.insert(users).values({ name: p.data.name, email: p.data.email, jobRole: "general", audience: "staff", guest: "yes", passwordHash, referredBy: referrerOf(str(fd.get("ref"))), emailNudges: fd.get("nudges") === "on" ? "on" : "off" }).returning().get();
      claimPendingInvites(tx, u.id, u.email); // races this address was already invited to
      // someone who came from "try it" starts on the topic they tried (only a topic a stranger may try)
      const tried = trialTrack(str(fd.get("try")));
      if (tried) enrol(tx, u.id, tried.id, "Tried it first");
      return u.id;
    });
  } catch {
    return "We could not create an account with those details. If you already have one, sign in instead.";
  }
  await startSession(userId);
  redirect(safeNext(str(fd.get("next"))) ?? "/try?first=1"); // a first win in a minute, before any set-up
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
  // A company that requires single sign-on: say so to someone who could never have used a password here (no account, or one with no password), and to anyone
  // who got the password right. A wrong password for an account that has one stays the same plain answer, so nothing tells an outsider who has an account.
  const viaSso = ssoRequired(email);
  if (ok && viaSso) { clear(pairKey); return viaSso; }
  if (!ok && (!u || !u.passwordHash) && enforcedForDomain(email)) return "Your company uses single sign-on. Choose \"Sign in with your company\" instead.";
  if (!u || !ok) {
    hit(pairKey, 15 * MINUTE);
    hit(ipKey, 15 * MINUTE);
    return "Wrong email or password.";
  }
  clear(pairKey);
  if (needsRehash(u.passwordHash)) {
    db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, u.id)).run(); // legacy or weaker params
  }
  syncRequired(u); // picks up tracks that became required since their last visit
  await startSession(u.id);
  redirect(safeNext(str(fd.get("next"))) ?? "/dashboard"); // an invite link sends people back to it after sign-in
}

export async function logout() {
  await endSession();
  redirect("/");
}

/**
 * Changing your own password needs the current one, then signs out every other device and keeps this one signed in.
 * People whose manager set a temporary password use this to replace it.
 */
export async function changePassword(_: string | null, fd: FormData): Promise<string | null> {
  const me = await requireUser();
  const key = `pw-change:${me.id}`;
  if (!allowed(key, 5)) return TOO_MANY;
  const current = str(fd.get("current")).slice(0, 200), next = str(fd.get("next")).slice(0, 200), again = str(fd.get("again")).slice(0, 200);
  if (next.length < 8) return "Choose a new password of at least 8 characters.";
  if (next !== again) return "The two new passwords do not match.";
  if (next === current) return "Choose a password you have not used here before.";
  if (!(await verifyPassword(current, me.passwordHash))) { hit(key, 15 * MINUTE); return "Your current password is wrong."; }
  clear(key);
  db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, me.id)).run();
  revokeSessions(me.id);
  await startSession(me.id);
  return "ok";
}

/**
 * "Forgot your password?": asks for a reset link. The answer is the same whether or not the address has an account (and the email is sent without
 * waiting for it, so the time taken does not give it away either). Limited per address and per visitor, and every ask counts, real account or not.
 */
export async function requestPasswordReset(_: string | null, fd: FormData): Promise<string | null> {
  const ip = await clientIp(), ipKey = `pw-reset-ip:${ip}`;
  if (!allowed(ipKey, 10)) return TOO_MANY;
  const email = z.string().email().max(120).safeParse(str(fd.get("email")).toLowerCase());
  if (!email.success) return "Enter the email address you signed up with.";
  hit(ipKey, 60 * MINUTE);
  const addrKey = `pw-reset-addr:${email.data}`;
  if (!allowed(addrKey, 3)) return "ok"; // too many for this address: say nothing different, send nothing more
  hit(addrKey, 60 * MINUTE);
  const r = ssoRequired(email.data) ? null : startReset(email.data); // single sign-on companies do not use emailed resets
  if (r && mailConfigured()) {
    const base = await siteUrl();
    void sendMail(resetMail(r.email, `${base}/reset/${r.token}`, RESET_TTL_SEC / 60, lookFor(r.userId).name), { key: `reset-${hashToken(r.token).slice(0, 32)}` });
  }
  return "ok";
}

/** The page the emailed link opens: sets the new password, ends every other session, tells the person by email, and signs them in. */
export async function completeReset(token: string, _: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `pw-reset-use:${await clientIp()}`;
  if (!allowed(ipKey, 20)) return TOO_MANY;
  hit(ipKey, 60 * MINUTE);
  const next = str(fd.get("next")).slice(0, 200), again = str(fd.get("again")).slice(0, 200);
  if (next.length < MIN_PASSWORD) return `Choose a new password of at least ${MIN_PASSWORD} characters.`;
  if (next !== again) return "The two passwords do not match.";
  const userId = finishReset(token, await hashPassword(next));
  if (userId === null) return "This link has expired or was already used. Ask for a new one.";
  const u = db.select({ email: users.email }).from(users).where(eq(users.id, userId)).get();
  if (u && mailConfigured()) void sendMail(passwordChangedMail(u.email, `${await siteUrl()}/forgot`, lookFor(userId).name));
  if (u && ssoRequired(u.email)) redirect("/sso");
  await startSession(userId);
  redirect("/dashboard");
}

/**
 * "Email me a sign-in link": passwordless sign-in. Like the password reset, the reply is the same whether or not the address has an account, the
 * email is sent without waiting for it, and every ask counts against a limit per address and per visitor.
 */
export async function requestSignInLink(_: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `signin-link-ip:${await clientIp()}`;
  if (!allowed(ipKey, 10)) return TOO_MANY;
  const email = z.string().email().max(120).safeParse(str(fd.get("email")).toLowerCase());
  if (!email.success) return "Enter the email address you signed up with.";
  hit(ipKey, 60 * MINUTE);
  const addrKey = `signin-link-addr:${email.data}`;
  if (!allowed(addrKey, 5)) return "ok";
  hit(addrKey, 60 * MINUTE);
  const r = ssoRequired(email.data) ? null : startLoginLink(email.data);
  if (r && mailConfigured()) {
    const next = safeNext(str(fd.get("next"))), q = next ? `?next=${encodeURIComponent(next)}` : "";
    void sendMail(signInLinkMail(r.email, `${await siteUrl()}/signin/${r.token}${q}`, LOGIN_LINK_TTL_SEC / 60, lookFor(r.userId).name), { key: `signin-${hashToken(r.token).slice(0, 32)}` });
  }
  return "ok";
}

/** The button on the page the emailed link opens: uses the link and signs the person in. Opening the link alone never does. */
export async function signInWithLink(token: string, next: string) {
  const ipKey = `signin-use:${await clientIp()}`;
  if (!allowed(ipKey, 30)) redirect(`/signin/${token}`);
  hit(ipKey, 60 * MINUTE);
  const userId = spendLoginLink(token);
  if (userId === null) redirect(`/signin/${token}`); // the page explains the link no longer works
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (u && ssoRequired(u.email)) redirect("/sso"); // a link issued before the company required single sign-on no longer signs anyone in
  if (u) syncRequired(u); // picks up tracks that became required since their last visit, as a password sign-in does
  await startSession(userId);
  redirect(safeNext(next) ?? "/dashboard");
}

/** A manager sets a temporary password for someone who is locked out; every session they had ends. Managers can only do this for learners. */
export async function resetPassword(_: string | null, fd: FormData): Promise<string | null> {
  const me = await requireManager();
  const userId = Number(fd.get("userId")), temp = str(fd.get("password")).slice(0, 200);
  if (!Number.isInteger(userId) || userId <= 0) return "Choose a person.";
  if (temp.length < 8) return "A temporary password needs at least 8 characters.";
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.status !== "active") return "That person is not active.";
  if (u.id === me.id) return "Use Your profile to change your own password.";
  if (!userInReach(reachOf(me.id), u.id)) return "That person is outside the companies you run."; // or one manager could sign in as anyone
  if (me.role !== "admin" && u.role !== "learner") return "Only an admin can reset a manager's password.";
  db.update(users).set({ passwordHash: await hashPassword(temp) }).where(eq(users.id, u.id)).run();
  revokeSessions(u.id);
  return "ok";
}

/** Signs this person out on every device, including this one. */
export async function logoutEverywhere() {
  const u = await requireUser();
  revokeSessions(u.id);
  await endSession();
  redirect("/");
}

/** A learner switches their own learning journey between locked order ("inherit": what their company says) and any order ("soft"). Only when their company allows the choice. */
export async function setJourneyMode(fd: FormData) {
  const u = await requireUser();
  const mode = str(fd.get("mode")) === "soft" ? "soft" : "inherit";
  if (!journeyFor(u.id)?.canSwitch) return;
  db.update(users).set({ journeyMode: mode }).where(eq(users.id, u.id)).run();
  revalidatePath("/map"); revalidatePath("/map/software"); revalidatePath("/dashboard"); revalidatePath("/tracks", "layout");
}

export async function enroll(fd: FormData) {
  const u = await requireUser();
  const trackId = Number(fd.get("trackId"));
  const goal = str(fd.get("goal")).slice(0, 300);
  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track || !openTo(u.audience, track.audience)) return;
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
  if (gateFor(u.id, trackId)) return; // an earlier onboarding phase is not signed off yet
  if (orderLockFor(u.id, trackId)) return; // an earlier stage of this person's learning journey is not passed yet (lib/journeyLock.ts)

  // reuse an unfinished run for this level instead of piling up abandoned ones
  const open = db.select().from(runs)
    .where(and(eq(runs.userId, u.id), eq(runs.trackId, trackId), eq(runs.level, level), sql`${runs.finishedAt} is null`)).get();
  if (open) redirect(`/run/${open.id}`);

  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track) return;
  // stored questions: a fresh random draw each run, favouring ones this person has not answered correctly before
  // a contest "Architect twist" may swap one question for a rival's rewrite, and keeps the original away from the Architect
  const twist = twistFor(u.id, trackId, level);
  const slots = QUESTIONS_PER_RUN - (twist.inject ? 1 : 0);
  const pool = db.select({ id: questions.id }).from(questions)
    .where(and(eq(questions.trackId, trackId), eq(questions.level, level), eq(questions.status, "active"),
      twist.exclude.length ? notInArray(questions.id, twist.exclude) : undefined))
    .orderBy(sql`
      (select count(*) from ${answers} a join ${runs} r on r.id = a.run_id
        where a.question_id = ${questions.id} and r.user_id = ${u.id} and a.score >= 0.8) asc, random()`)
    .limit(QUESTIONS_PER_RUN).all().map((q) => q.id);
  // generated questions: new values every time and never repeated for this person, so there is nothing to memorise
  const fresh = drawDynamic(u.id, track, level, Math.min(slots, Math.max(DYNAMIC_PER_RUN, slots - pool.length)));
  const rest = [...fresh, ...pool.slice(0, slots - fresh.length)];
  // never let a twist stand in for a thin exam: it only goes in when it is one question among a full set
  const inject = twist.inject && rest.length >= QUESTIONS_PER_RUN - 1 ? twist.inject : null;
  const picked = [...rest, ...(inject ? [inject] : [])].sort(() => Math.random() - 0.5);
  if (!picked.length) return;

  const run = db.insert(runs).values({ userId: u.id, trackId, level }).returning().get();
  db.insert(answers).values(picked.map((questionId) => ({ runId: run.id, questionId }))).run();
  redirect(`/run/${run.id}`);
}

// Runs being graded right now (single process; see lib/rate-limit.ts). Grading awaits the AI, so without this
// a double-click grades twice, spends twice, and could award the quest and certificate twice.
const grading = new Set<number>();

export async function submitRun(runId: number, fd: FormData) {
  const u = await requireUser();
  const run = db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, u.id))).get();
  if (!run || run.finishedAt || grading.has(runId)) redirect(`/run/${runId}`);
  grading.add(runId);
  try {
    await gradeRun(u.id, run, runId, fd);
  } finally {
    grading.delete(runId);
  }
  revalidatePath("/dashboard");
  redirect(`/run/${runId}`);
}

// ---- role check: one exam across a ladder's tracks in the role's question mix ----

export async function startRoleExam() {
  const u = await requireUser();
  if (u.audience !== "staff") return;
  const plan = roleExamPlan(u);
  if (!plan) redirect("/journey?roleExam=unavailable");
  const open = openRoleExam(u.id, plan); // only one aimed at where they are now; an older one is left behind
  if (open) redirect(`/role-exam/${open.id}`);
  const id = createRoleExam(u);
  if (!id) redirect("/journey?roleExam=unavailable");
  redirect(`/role-exam/${id}`);
}

const gradingRoleExams = new Set<number>(); // same double-submit guard as track runs

export async function submitRoleExam(examId: number, fd: FormData) {
  const u = await requireUser();
  const exam = db.select().from(roleExams).where(and(eq(roleExams.id, examId), eq(roleExams.userId, u.id))).get();
  if (!exam || exam.finishedAt || gradingRoleExams.has(examId)) redirect(`/role-exam/${examId}`);
  gradingRoleExams.add(examId);
  try {
    if (await gradeRoleExam(examId, (qid) => str(fd.get(`q${qid}`)))) {
      const done = db.select().from(roleExams).where(eq(roleExams.id, examId)).get()!;
      const asked = db.select({ n: sql<number>`count(*)` }).from(roleExamAnswers).where(eq(roleExamAnswers.examId, examId)).get()?.n ?? 0;
      finalizeIntegrity("role", examId, u.id, null, { questionCount: asked, startedAt: done.startedAt, finishedAt: done.finishedAt ?? done.startedAt, passed: !!done.passed, level: done.rung });
    }
  } finally {
    gradingRoleExams.delete(examId);
  }
  revalidatePath("/journey");
  redirect(`/role-exam/${examId}`);
}

async function gradeRun(userId: number, run: typeof runs.$inferSelect, runId: number, fd: FormData) {
  const u = { id: userId };

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
  const finishedAt = Math.floor(Date.now() / 1000);
  const done = db.update(runs).set({ score, passed: score >= PASS_MARK, finishedAt })
    .where(and(eq(runs.id, runId), sql`${runs.finishedAt} is null`)).run();
  if (!done.changes) return; // finished by someone else in the meantime
  const passed = score >= PASS_MARK;
  completeQuest(u.id, run.trackId, "exam");
  // the evidence gathered while the exam was taken (lib/integrity): a pass it flags may wait for a person before its reward is given
  const integrity = finalizeIntegrity("run", runId, u.id, run.trackId, { questionCount: rows.length, startedAt: run.startedAt, finishedAt, passed, level: run.level });
  if (passed && !integrity.hold) awardForPass(u.id, run.trackId, run.level, score); // certificate, XP, voucher or money, as the content's owner has set

  progressionFor(u.id); // records any badge this exam earned
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
  noteDrillAnswer(u.id, q.trackId, q.id);
  return { correct: q.answer === key, answer: q.answer ?? "", hint: q.hint };
}

export async function finishDrill(trackId: number) {
  const u = await requireUser();
  if (!enrolled(u.id, trackId) || !drillCompleted(u.id, trackId)) return 0; // XP only for a drill that was really answered
  const xp = completeQuest(u.id, trackId, "drill");
  revalidatePath("/dashboard");
  return xp;
}

// ---- people: onboarding & offboarding (managers/admins) ----

/** The access level picked on a form; anything unrecognised is the safe one. */
const accessFrom = (fd: FormData): Level => { const v = str(fd.get("access")); return isLevel(v) ? v : "learner"; };

/** Changes one person's access level (learner, manager or admin). The rules are in lib/accessLevel.ts. */
export async function setAccess(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await requireManager();
  const r = setAccessLevel(me, fd);
  if (r?.done) revalidatePath("/admin/people");
  return r;
}

export async function createPerson(_: string | null, fd: FormData): Promise<string | null> {
  const me = await requireManager();
  const p = z.object({
    name: z.string().min(1).max(80),
    email: z.string().email().transform((s) => s.toLowerCase()),
    jobRole: z.string().min(1).max(40),
    password: z.string().min(8).max(200),
    audience: z.enum(["staff", "customer"]),
  }).safeParse({ name: str(fd.get("name")), email: str(fd.get("email")), jobRole: str(fd.get("jobRole")).toLowerCase(), password: str(fd.get("password")), audience: str(fd.get("audience")) || "staff" });
  if (!p.success) return "Name, valid email, role and a temporary password (8+ chars) are required.";
  const scopes = validScopes(db, formScopes(fd));
  if (!scopes.length) return "Pick at least one company, brand or project they belong to.";
  const reach = reachOf(me.id);
  if (scopes.some((s) => !scopeInReach(reach, s))) return "You can only add people to the companies, brands and projects you run.";
  const access = accessFrom(fd);
  const refused = refuseAccess(me, access, scopes, p.data.audience);
  if (refused) return refused;
  if (db.select().from(users).where(eq(users.email, p.data.email)).get()) return "That email already exists.";

  const u = db.insert(users).values({ name: p.data.name, email: p.data.email, jobRole: p.data.jobRole, audience: p.data.audience, role: access, passwordHash: await hashPassword(p.data.password) }).returning().get();
  provision(db, u.id, u.email, p.data.jobRole, p.data.audience, scopes);
  revalidatePath("/admin/people");
  return null;
}

export type InviteState = {
  error?: string;
  invites?: { email: string; jobRole?: string; path: string; url: string }[];
  /** lines of a bulk import that could not be used, each with the reason */
  rejected?: string[];
  /** addresses that already have an account, so no link was made */
  skipped?: string[];
  /** worth knowing before the link goes out, e.g. nothing is set up for this role yet */
  notice?: string;
  /** who is inviting, where to and as what: the form turns these into a ready-to-send message */
  message?: { from: string; where: string; role: string; access: Level };
  /** the result of emailing the invitations, when that was asked for and email is set up */
  mail?: { sent: string[]; failed: { email: string; error: string }[] };
  /** what was typed, returned on an error so the form is not emptied (a form action resets its fields) */
  values?: { emails: string; jobRole: string; audience: "staff" | "customer"; scopes: string; access: Level; sendEmail: boolean };
} | null;

const MAX_INVITES_AT_ONCE = 25;

/**
 * Makes a single-use signup link for each address, each with its own role, and emails them when asked. Shared by the one-by-one form and the
 * bulk import. The caller has already checked the manager may invite to these scopes with this access; addresses that already have an account are skipped.
 */
async function issueInvites(
  me: { id: number; name: string; email: string },
  rows: { email: string; jobRole: string }[],
  o: { audience: "staff" | "customer"; scopes: ReturnType<typeof validScopes>; access: Level; sendEmail: boolean },
  keep: NonNullable<InviteState>["values"],
): Promise<InviteState> {
  const taken = new Set(db.select({ e: users.email }).from(users).where(inArray(users.email, rows.map((r) => r.email))).all().map((r) => r.e));
  const fresh = rows.filter((r) => !taken.has(r.email));
  if (!fresh.length) return { error: rows.length === 1 ? "That email already has an account." : "Every one of those emails already has an account.", values: keep };

  const expiresAt = Math.floor(Date.now() / 1000) + INVITE_TTL_SEC;
  const base = await siteUrl(); // an absolute link, so a message sent from this page works wherever it is opened
  const invites_ = fresh.map(({ email, jobRole }) => {
    const token = newToken();
    db.insert(invites).values({ tokenHash: hashToken(token), email, jobRole, audience: o.audience, scopes: formatScopes(o.scopes), role: o.access, createdBy: me.id, expiresAt }).run();
    return { email, jobRole, path: `/join/${token}`, url: `${base}/join/${token}` };
  });
  // roles with no learning path set up yet: worth knowing before the links go out
  const bare = o.audience === "staff" ? [...new Set(fresh.map((r) => r.jobRole))].filter((r) => hasNoRolePath(coverageFor(r))) : [];
  let notice = bare.length
    ? `Nothing is set up for ${bare.length === 1 ? "the role" : "the roles"} "${bare.join('", "')}" yet, so ${bare.length === 1 ? "they" : "those people"} will only get company-wide learning. Roles with learning: ${knownRoles().join(", ") || "none"}. You can change a role later on People.`
    : undefined;
  // a customer's getting-started subject usually belongs to a product (project), which ticking only its brand does not cover
  if (o.audience === "customer" && !requirementsFor({ id: 0, jobRole: fresh[0].jobRole, audience: "customer" }, o.scopes).length) {
    const brandIds = o.scopes.filter((x) => x.kind === "brand").map((x) => x.id);
    const hint = brandIds.length ? db.select({ n: projects.name }).from(tracks).innerJoin(projects, eq(projects.id, tracks.projectId))
      .where(and(eq(tracks.audience, "customer"), inArray(tracks.brandId, brandIds))).all().map((r) => r.n) : [];
    notice = `Nothing is assigned to customers with this scope yet, so they would start with an empty path.${hint.length ? ` Also tick the product: ${[...new Set(hint)].join(", ")}.` : " Tick the product (project) or brand they bought."}`;
  }
  const where = scopeLabels(o.scopes, scopeOptions()).join(", ");
  // email them too, when the manager asked and the server is set up for it; the links stay on screen either way
  const mail = o.sendEmail && mailConfigured()
    ? await sendInvites(me.id, invites_.map((i) => ({ to: i.email, link: i.url, from: me.name, where, role: i.jobRole, access: o.access, replyTo: me.email, key: `invite-${hashToken(i.path.split("/").pop()!).slice(0, 32)}` })))
    : undefined;
  return { invites: invites_, skipped: taken.size ? [...taken] : undefined, notice, mail, message: { from: me.name, where, role: [...new Set(fresh.map((r) => r.jobRole))].join(", "), access: o.access } };
}

/** Issues a single-use signup link for each email, all with the same role and scope. Tokens are shown once; only hashes are stored. */
export async function createInvite(_: InviteState, fd: FormData): Promise<InviteState> {
  const me = await requireManager();
  const emails = [...new Set(str(fd.get("emails")).toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const keep: NonNullable<InviteState>["values"] = {
    emails: str(fd.get("emails")), jobRole: str(fd.get("jobRole")),
    audience: str(fd.get("audience")) === "customer" ? "customer" : "staff", access: accessFrom(fd), sendEmail: str(fd.get("sendEmail")) === "on", scopes: fd.getAll("scope").filter((v): v is string => typeof v === "string").join(","),
  };
  const p = z.object({
    emails: z.array(z.string().email().max(120)).min(1).max(MAX_INVITES_AT_ONCE),
    jobRole: z.string().min(1).max(40),
    audience: z.enum(["staff", "customer"]),
  }).safeParse({ emails, jobRole: str(fd.get("jobRole")).toLowerCase(), audience: str(fd.get("audience")) || "staff" });
  if (!p.success) return { error: `Enter one to ${MAX_INVITES_AT_ONCE} valid email addresses and a role.`, values: keep };
  const scopes = validScopes(db, formScopes(fd));
  if (!scopes.length) return { error: "Pick at least one company, brand or project they belong to.", values: keep };
  const reach = reachOf(me.id);
  if (scopes.some((s) => !scopeInReach(reach, s))) return { error: "You can only invite people to the companies, brands and projects you run.", values: keep };
  const access = accessFrom(fd);
  const refused = refuseAccess(me, access, scopes, p.data.audience);
  if (refused) return { error: refused, values: keep };

  return issueInvites(me, p.data.emails.map((email) => ({ email, jobRole: p.data.jobRole })), { audience: p.data.audience, scopes, access, sendEmail: keep.sendEmail }, keep);
}

/**
 * Invites a whole list at once, up to MAX_BULK people, each with their own role if the list gives one. The list is pasted or uploaded as a file
 * (a spreadsheet saved as CSV works). Lines that cannot be used are reported and the rest go ahead. The same permission checks as one by one.
 */
export async function bulkInvite(_: InviteState, fd: FormData): Promise<InviteState> {
  const me = await requireManager();
  const file = fd.get("file");
  let text = str(fd.get("csv"));
  if (file instanceof File && file.size > 0) {
    if (file.size > 200_000) return { error: "That file is too big. A list of up to " + MAX_BULK + " people is well under 200 KB." };
    text = await file.text();
  }
  const jobRole = str(fd.get("jobRole")).toLowerCase();
  const audience = str(fd.get("audience")) === "customer" ? "customer" : "staff";
  const keep: NonNullable<InviteState>["values"] = {
    emails: text.slice(0, 20000), jobRole, audience, access: accessFrom(fd), sendEmail: str(fd.get("sendEmail")) === "on",
    scopes: fd.getAll("scope").filter((v): v is string => typeof v === "string").join(","),
  };
  if (!/^[a-z][a-z0-9 &/-]{0,39}$/.test(jobRole)) return { error: "Pick the role to use when a line does not give one.", values: keep };
  const list = parseBulk(text, jobRole);
  if (!list.rows.length) return { error: list.rejected.length ? "Nothing in that list could be used. " + list.rejected.slice(0, 3).join("; ") : "Paste a list or choose a file: one person per line, as email or email,role.", values: keep };
  const scopes = validScopes(db, formScopes(fd));
  if (!scopes.length) return { error: "Pick at least one company, brand or project they belong to.", values: keep };
  if (scopes.some((x) => !scopeInReach(reachOf(me.id), x))) return { error: "You can only invite people to the companies, brands and projects you run.", values: keep };
  const access = accessFrom(fd);
  const refused = refuseAccess(me, access, scopes, audience);
  if (refused) return { error: refused, values: keep };

  const r = await issueInvites(me, list.rows, { audience, scopes, access, sendEmail: keep.sendEmail }, keep);
  const rejected = [...list.rejected, ...(list.tooMany ? [`Only the first ${MAX_BULK} people were used; invite the rest in a second list.`] : [])];
  return r && !r.error && rejected.length ? { ...r, rejected } : r;
}

export type LinkMade = { error?: string; path?: string } | null;

/**
 * Makes one link for a whole team. Anyone with it can create their own account in the places it names, as a learner, until it is full or
 * expires. It can only be made for places the manager runs, and it never gives more than learner access, so it cannot be used to climb.
 */
export async function createJoinLink(_: LinkMade, fd: FormData): Promise<LinkMade> {
  const me = await requireManager();
  const p = z.object({
    jobRole: z.string().min(1).max(40).regex(/^[a-z][a-z0-9 &/-]*$/), label: z.string().max(60),
    audience: z.enum(["staff", "customer"]),
    maxUses: z.coerce.number().int().min(1).max(MAX_LINK_USES), days: z.coerce.number().int().min(1).max(MAX_LINK_DAYS),
  }).safeParse({ jobRole: str(fd.get("jobRole")).toLowerCase(), label: str(fd.get("label")), audience: str(fd.get("audience")) || "staff", maxUses: str(fd.get("maxUses")) || DEFAULT_LINK_USES, days: str(fd.get("days")) || DEFAULT_LINK_DAYS });
  if (!p.success) return { error: `Pick a role, up to ${MAX_LINK_USES} places and up to ${MAX_LINK_DAYS} days.` };
  const scopes = validScopes(db, formScopes(fd));
  if (!scopes.length) return { error: "Pick the company, brand or project the link is for." };
  if (scopes.some((x) => !scopeInReach(reachOf(me.id), x))) return { error: "You can only make a link for the companies, brands and projects you run." };
  const refused = refuseAccess(me, "learner", scopes, p.data.audience);
  if (refused) return { error: refused };
  if (!allowed(`join-link:${me.id}`, 20)) return { error: TOO_MANY };
  hit(`join-link:${me.id}`, 60 * MINUTE);
  const row = db.insert(joinLinks).values({ label: p.data.label, jobRole: p.data.jobRole, audience: p.data.audience, scopes: formatScopes(scopes), createdBy: me.id, maxUses: p.data.maxUses, expiresAt: Math.floor(Date.now() / 1000) + p.data.days * 86400 }).returning().get();
  revalidatePath("/admin/people");
  return { path: linkPath(row.id) };
}

/** Switches a team link off at once. The person who made it, or the platform owner, may do it. */
export async function revokeJoinLink(id: number) {
  const me = await requireManager();
  const l = db.select().from(joinLinks).where(eq(joinLinks.id, id)).get();
  if (!l || (l.createdBy !== me.id && !(me.role === "admin" && isGlobal(reachOf(me.id))))) return;
  db.update(joinLinks).set({ revokedAt: Math.floor(Date.now() / 1000) }).where(and(eq(joinLinks.id, id), isNull(joinLinks.revokedAt))).run();
  revalidatePath("/admin/people");
}

/** Someone opens a team link and makes their own account. Learner access, in exactly the places the link names; an address that already has an account gets the generic answer. */
export async function joinWithLink(token: string, _: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `join-link-use:${await clientIp()}`;
  if (!allowed(ipKey, 10)) return TOO_MANY;
  hit(ipKey, 60 * MINUTE);
  const link = findOpenLink(token);
  if (!link) return "This link is full, has expired or was switched off. Ask whoever sent it for a new one.";
  const p = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(120), password: z.string().min(8).max(200) })
    .safeParse({ name: str(fd.get("name")), email: str(fd.get("email")).toLowerCase(), password: str(fd.get("password")) });
  if (!p.success) return "Enter your name, a valid email and a password of 8 or more characters.";
  const passwordHash = await hashPassword(p.data.password);
  let userId: number;
  try {
    userId = db.transaction((tx) => {
      if (tx.select({ id: users.id }).from(users).where(eq(users.email, p.data.email)).get()) throw new Error("taken");
      if (!claimPlace(tx, link.id)) throw new Error("full"); // taken last, so a failed sign-up never uses up a place
      const u = tx.insert(users).values({ name: p.data.name, email: p.data.email, jobRole: link.jobRole, audience: link.audience, role: "learner", passwordHash }).returning().get();
      provision(tx, u.id, u.email, link.jobRole, link.audience, parseScopes(link.scopes));
      return u.id;
    });
  } catch (e) {
    return e instanceof Error && e.message === "full" ? "This link just filled up. Ask whoever sent it for a new one." : "We could not create an account with those details. If you already have one, sign in instead.";
  }
  await startSession(userId);
  redirect("/dashboard");
}

/**
 * Sign-up on a company's public entry page. The account is a customer of that company: audience "customer", learner access, scoped to the
 * company, so it only ever sees the company's customer-facing topics. Works only while the company has switched its entry page on.
 */
export async function joinAsCustomer(companySlug: string, _: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `entry-join:${await clientIp()}`;
  if (!allowed(ipKey, 8)) return TOO_MANY;
  hit(ipKey, 60 * MINUTE);
  const company = entryCompany(companySlug);
  if (!company) return "This page is not taking sign-ups right now.";
  const p = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(120), password: z.string().min(8).max(200) })
    .safeParse({ name: str(fd.get("name")), email: str(fd.get("email")).toLowerCase(), password: str(fd.get("password")) });
  if (!p.success) return "Enter your name, a valid email and a password of 8 or more characters.";
  const passwordHash = await hashPassword(p.data.password);
  let userId: number;
  try {
    userId = db.transaction((tx) => {
      if (tx.select({ id: users.id }).from(users).where(eq(users.email, p.data.email)).get()) throw new Error("taken");
      const u = tx.insert(users).values({ name: p.data.name, email: p.data.email, jobRole: "customer", audience: "customer", role: "learner", passwordHash }).returning().get();
      provision(tx, u.id, u.email, "customer", "customer", [{ kind: "company", id: company.id }]);
      // start them on what the page promised: up to three of the company's customer topics, so the first thing they see is a lesson to take
      const first = entryTopics(company.id).slice(0, 3);
      if (first.length) tx.insert(enrollments).values(first.map((t) => ({ userId: u.id, trackId: t.id, goal: `Getting started with ${company.name}` }))).onConflictDoNothing().run();
      return u.id;
    });
  } catch {
    return "We could not create an account with those details. If you already have one, sign in instead.";
  }
  await startSession(userId);
  redirect("/dashboard");
}

/** Moves someone to a different set of companies, brands and projects, then enrols them in whatever that now requires. */
export async function updateScopes(fd: FormData) {
  const me = await requireManager();
  if (changePlaces(me.id, Number(fd.get("userId")), validScopes(db, formScopes(fd)))) return; // refused: nothing changes
  revalidatePath("/admin/people");
  revalidatePath("/admin/compliance");
}

/** Admin only: decides what a track is for. Applies to everyone straight away. */
export async function updateTrackPolicy(fd: FormData) {
  const me = await requireManager();
  if (me.role !== "admin") return;
  const p = z.object({
    trackId: z.coerce.number().int().positive(),
    tier: z.enum(["mandatory", "role", "growth"]),
    audience: z.enum(["staff", "customer", "both"]),
    requiredLevel: z.coerce.number().int().min(1).max(MAX_LEVEL),
    dueDays: z.coerce.number().int().min(1).max(365),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  const { trackId, ...policy } = p.data;
  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track || !trackInReach(reachOf(me.id), track)) return;
  db.update(tracks).set({ ...policy, policySource: "admin" }).where(eq(tracks.id, trackId)).run();
  resetCatalogCache(); // the catalogue is kept for a while; this change must show at once
  syncEveryone();
  revalidatePath("/admin/paths");
  revalidatePath("/admin/compliance");
}

/**
 * A company or brand makes a shared academy track required of its own people, or stops requiring it. Only an admin who runs that company or brand, and
 * only for shared tracks (a learning topic, say): the track's general policy, and so every other company, stays as it is.
 */
export async function setScopeRequirement(fd: FormData) {
  const me = await requireManager();
  if (me.role !== "admin") return;
  const p = z.object({
    scope: z.string().regex(/^(company|brand):\d+$/),
    trackId: z.coerce.number().int().positive(),
    required: z.enum(["yes", "no"]),
    requiredLevel: z.coerce.number().int().min(1).max(MAX_LEVEL),
    dueDays: z.coerce.number().int().min(1).max(365),
    roles: z.string().max(200),
  }).safeParse({ ...Object.fromEntries(fd), roles: typeof fd.get("roles") === "string" ? fd.get("roles") : "" });
  if (!p.success) return;
  const [kind, idText] = p.data.scope.split(":") as ["company" | "brand", string], id = Number(idText);
  if (!scopeInReach(reachOf(me.id), { kind, id }) || isGlobal(reachOf(me.id)) && !db.select().from(kind === "company" ? companies : brands).where(eq(kind === "company" ? companies.id : brands.id, id)).get()) return;
  const track = db.select({ id: tracks.id, audience: tracks.audience, kind: brands.kind }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(eq(tracks.id, p.data.trackId)).get();
  if (!track || track.kind !== "shared" || track.audience === "customer") return;
  const reach = catalog().find((t) => t.id === track.id)?.reach ?? 0; // nobody can be held to a level the track has no exam for
  if (p.data.required === "yes" && reach < 1) return;
  p.data.requiredLevel = Math.min(p.data.requiredLevel, Math.max(1, reach));
  const where = and(eq(scopeRequirements.scopeKind, kind), eq(scopeRequirements.scopeId, id), eq(scopeRequirements.trackId, track.id));
  if (p.data.required === "no") db.delete(scopeRequirements).where(where).run();
  else {
    const roles = [...new Set(p.data.roles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean))].join(", ");
    db.insert(scopeRequirements).values({ scopeKind: kind, scopeId: id, trackId: track.id, roles, requiredLevel: p.data.requiredLevel, dueDays: p.data.dueDays, createdBy: me.id })
      .onConflictDoUpdate({ target: [scopeRequirements.scopeKind, scopeRequirements.scopeId, scopeRequirements.trackId], set: { roles, requiredLevel: p.data.requiredLevel, dueDays: p.data.dueDays, createdBy: me.id } }).run();
  }
  resetCatalogCache(); // the catalogue is kept for a while; this change must show at once
  syncEveryone();
  revalidatePath("/admin/paths");
  revalidatePath("/admin/compliance");
}

// ---- careers: promotion ladders ----

/**
 * Records a promotion. A manager can promote someone who has met every step of the next level (and is not overdue on
 * required learning). Only an admin can promote without that, and must say why. Nobody can promote themselves.
 */
export async function promote(fd: FormData) {
  const me = await requireManager();
  const userId = Number(fd.get("userId")), note = str(fd.get("note")).slice(0, 1000);
  if (userId === me.id) return;
  const person = db.select().from(users).where(eq(users.id, userId)).get();
  if (!person || person.status !== "active" || !userInReach(reachOf(me.id), person.id)) return;
  const career = careerFor(person);
  if (!career?.next) return;
  const overridden = !career.ready;
  if (overridden && (me.role !== "admin" || !note)) return;
  db.insert(promotions).values({ userId, jobRole: career.role, level: career.next.level, decidedBy: me.id, note, overridden: overridden ? 1 : 0 }).run();
  revalidatePath("/admin/careers");
  revalidatePath("/dashboard");
}

/** Career ladders are shared by every company, so only an admin who runs the whole academy may edit them. */
const adminOnly = async () => {
  const me = await requireManager();
  return me.role === "admin" && isGlobal(reachOf(me.id));
};

export async function saveCareerLevel(fd: FormData) {
  if (!(await adminOnly())) return;
  const p = z.object({ id: z.coerce.number().int().positive(), title: z.string().trim().min(1).max(80), summary: z.string().trim().max(300) })
    .safeParse({ id: fd.get("id"), title: fd.get("title"), summary: fd.get("summary") ?? "" });
  if (!p.success) return;
  db.update(careerLevels).set({ title: p.data.title, summary: p.data.summary }).where(eq(careerLevels.id, p.data.id)).run();
  revalidatePath("/admin/careers");
}

/** Adds the next level to a role's ladder, or starts a new ladder when the role has none. */
export async function addCareerLevel(fd: FormData) {
  if (!(await adminOnly())) return;
  const p = z.object({ role: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(80) })
    .safeParse({ role: fd.get("role"), title: fd.get("title") });
  if (!p.success) return;
  const role = roleKey(p.data.role);
  const top = db.select({ m: sql<number>`max(${careerLevels.level})` }).from(careerLevels).where(eq(careerLevels.jobRole, role)).get()?.m ?? 0;
  if (top >= 10) return;
  db.insert(careerLevels).values({ jobRole: role, level: top + 1, title: p.data.title }).run();
  revalidatePath("/admin/careers");
}

export async function addCareerStep(fd: FormData) {
  if (!(await adminOnly())) return;
  const p = z.object({ levelId: z.coerce.number().int().positive(), trackId: z.coerce.number().int().positive(), requiredLevel: z.coerce.number().int().min(1).max(MAX_LEVEL) })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  const lvl = db.select().from(careerLevels).where(eq(careerLevels.id, p.data.levelId)).get();
  if (!lvl || lvl.level === 1 || !db.select().from(tracks).where(eq(tracks.id, p.data.trackId)).get()) return; // level 1 is the starting point
  db.insert(careerRequirements).values({ careerLevelId: p.data.levelId, trackId: p.data.trackId, requiredLevel: p.data.requiredLevel })
    .onConflictDoUpdate({ target: [careerRequirements.careerLevelId, careerRequirements.trackId], set: { requiredLevel: p.data.requiredLevel } }).run();
  revalidatePath("/admin/careers");
}

export async function removeCareerStep(id: number) {
  if (!(await adminOnly())) return;
  db.delete(careerRequirements).where(eq(careerRequirements.id, id)).run();
  revalidatePath("/admin/careers");
}

/**
 * Sets (or replaces) the person's career goal: a role and level they can actually reach from where they are, and a date.
 * The target arrives as "role|level" from a list that only offers reachable places, and is checked again here.
 */
export async function setCareerGoal(fd: FormData) {
  const me = await requireUser();
  const p = z.object({ role: z.string().trim().min(1).max(40), level: z.coerce.number().int().min(1).max(10), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse({ role: String(fd.get("target") ?? "").split("|")[0], level: String(fd.get("target") ?? "").split("|")[1], date: fd.get("date") });
  if (!p.success) return;
  const at = Math.floor(Date.parse(`${p.data.date}T12:00:00Z`) / 1000), nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(at) || at <= nowSec || at > nowSec + 20 * 365 * 86400) return;
  if (!canReach(me, p.data.role, p.data.level)) return;
  db.insert(careerGoals).values({ userId: me.id, targetRole: p.data.role, targetLevel: p.data.level, targetDate: at })
    .onConflictDoUpdate({ target: careerGoals.userId, set: { targetRole: p.data.role, targetLevel: p.data.level, targetDate: at, createdAt: nowSec } }).run();
  revalidatePath("/journey");
  revalidatePath("/goal");
  revalidatePath("/dashboard");
}

export async function clearCareerGoal() {
  const me = await requireUser();
  db.delete(careerGoals).where(eq(careerGoals.userId, me.id)).run();
  revalidatePath("/journey");
  revalidatePath("/goal");
  revalidatePath("/dashboard");
}

/** A person ticks their own onboarding items; managers can tick anyone's (including offboarding items). */
export async function toggleChecklist(id: number) {
  const me = await requireUser();
  const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
  if (!item) return;
  const own = item.userId === me.id && item.kind === "onboarding";
  if (!own && (me.role === "learner" || !userInReach(reachOf(me.id), item.userId))) return;
  db.update(checklistItems).set({ done: !item.done }).where(eq(checklistItems.id, id)).run();
  revalidatePath("/admin/people");
  revalidatePath("/dashboard");
}

/** A manager confirms a person has finished an onboarding phase. Only once all its required learning is passed, and only for people they cover. */
export async function signOffPhase(fd: FormData) {
  const me = await requireManager();
  const userId = Number(fd.get("userId")), phase = str(fd.get("phase"));
  if (!Number.isInteger(userId) || !isPhase(phase) || !canSignOff(me, userId)) return;
  const person = db.select().from(users).where(eq(users.id, userId)).get();
  if (!person || person.status !== "active") return;
  const status = onboardingFor(person).phases.find((p) => p.key === phase);
  if (!status || status.state !== "ready") return; // nothing to sign, already signed, held behind an earlier phase, or work left
  db.insert(phaseSignoffs).values({ userId, phase, signedBy: me.id, note: str(fd.get("note")).slice(0, 300) }).run();
  revalidatePath("/admin/people");
  revalidatePath("/dashboard");
}

/** Undoes a sign-off (signed by mistake, or the person's role changed). Kept in the history as revoked. */
export async function revokeSignOff(fd: FormData) {
  const me = await requireManager();
  const id = Number(fd.get("id"));
  const row = db.select().from(phaseSignoffs).where(and(eq(phaseSignoffs.id, id), sql`${phaseSignoffs.revokedAt} is null`)).get();
  if (!row || !canSignOff(me, row.userId)) return;
  db.update(phaseSignoffs).set({ revokedBy: me.id, revokedAt: Math.floor(Date.now() / 1000) }).where(eq(phaseSignoffs.id, id)).run();
  revalidatePath("/admin/people");
  revalidatePath("/dashboard");
}

/** The same, for a form where each item is a button named "id" (one form per person instead of one per item). */
export async function toggleChecklistItem(fd: FormData) {
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) await toggleChecklist(id);
}

export async function addHandover(fd: FormData) {
  const me = await requireManager();
  const userId = Number(fd.get("userId")), notes = str(fd.get("notes")).slice(0, 8000);
  const trackId = Number(fd.get("trackId")) || null;
  if (!notes || !db.select().from(users).where(eq(users.id, userId)).get() || !userInReach(reachOf(me.id), userId)) return;
  db.insert(handovers).values({ userId, trackId, notes }).run();
  revalidatePath("/admin/people");
}

export async function offboard(fd: FormData) {
  const me = await requireManager();
  const userId = Number(fd.get("userId"));
  if (userId === me.id) return; // cannot lock yourself out
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.status === "offboarded" || !userInReach(reachOf(me.id), u.id)) return;
  if (me.role !== "admin" && u.role !== "learner") return; // managers can only offboard learners
  offboardUser(userId); // access ends now (lib/people.ts)
  revalidatePath("/admin/people");
}

export async function retireQuestion(fd: FormData) {
  const me = await requireManager();
  const id = Number(fd.get("id")), status = str(fd.get("status"));
  if (status !== "retired" && status !== "active" && status !== "review") return;
  const owner = db.select({ t: tracks }).from(questions).innerJoin(tracks, eq(tracks.id, questions.trackId)).where(eq(questions.id, id)).get();
  if (!owner || !trackInReach(reachOf(me.id), owner.t)) return;
  const q = db.update(questions).set({ status }).where(eq(questions.id, id)).returning().get();
  resetCatalogCache();
  revalidatePath("/admin/bank");
  if (q) {
    const t = db.select({ slug: tracks.slug }).from(tracks).where(eq(tracks.id, q.trackId)).get();
    if (t) revalidatePath(`/admin/review/${t.slug}`);
    syncEveryone(); // a track may have just gained enough questions to become required
  }
}

/** Admin only: publishes every question of a track that is waiting for review, then enrols whoever it now applies to. */
export async function activateTrackQuestions(trackId: number) {
  const me = await requireManager();
  if (me.role !== "admin") return;
  const t = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!t || !trackInReach(reachOf(me.id), t)) return;
  db.update(questions).set({ status: "active" }).where(and(eq(questions.trackId, trackId), eq(questions.status, "review"))).run();
  resetCatalogCache();
  syncEveryone();
  revalidatePath(`/admin/review/${t.slug}`);
  revalidatePath("/admin/paths");
  revalidatePath("/admin/compliance");
}


// ---- freshness: keeping everyone current when company knowledge changes ----

/** Admin only: saves new text for a knowledge item (a brand moto, tone, policy) and, if material, asks enrolled learners to read it. */
export async function recordKnowledgeChange(_: string | null, fd: FormData): Promise<string | null> {
  const me = await requireManager();
  if (me.role !== "admin") return "Only an admin can change company knowledge.";
  const p = z.object({
    itemId: z.coerce.number().int().positive(),
    body: z.string().trim().min(1).max(20000),
    note: z.string().trim().max(500),
  }).safeParse({ itemId: fd.get("itemId"), body: str(fd.get("body")), note: str(fd.get("note")) });
  if (!p.success) return "Enter the new text (up to 20,000 characters) and a note of up to 500.";
  const material = fd.get("material") === "on";
  if (material && !p.data.note) return "Say in a sentence what changed, so people know what to look for.";
  const done = db.transaction((tx) => {
    const item = tx.select().from(knowledgeItems).where(eq(knowledgeItems.id, p.data.itemId)).get();
    if (!item) return "That item no longer exists.";
    const owner = tx.select().from(tracks).where(eq(tracks.id, item.trackId)).get();
    if (!owner || !trackInReach(reachOf(me.id), owner)) return "That knowledge belongs to a company you do not run.";
    return recordChange(tx, item, p.data.body, { note: p.data.note, material, by: me.id }) ? null : "That is the same text as before.";
  });
  if (done) return done;
  revalidatePath("/admin/freshness");
  revalidatePath("/dashboard");
  revalidatePath("/updates");
  redirect("/admin/freshness");
}

export async function acknowledgeChange(changeId: number) {
  const u = await requireUser();
  acknowledge(u.id, changeId);
  revalidatePath("/updates");
  revalidatePath("/dashboard");
  revalidatePath("/admin/freshness");
}

/**
 * Pick the look for yourself ("me") or for your rival ("rival"). Signed-in people keep it on their account, and may use their
 * uploaded photo for themselves; guests keep it in a cookie on this device.
 */
export async function setAvatarLook(who: "me" | "rival", look: string) {
  if (who !== "me" && who !== "rival") return;
  const user = await currentUser();
  const photo = user && who === "me" && look === "photo" ? db.select({ id: userAvatars.userId }).from(userAvatars).where(eq(userAvatars.userId, user.id)).get() : undefined;
  if (!isLook(look) && !photo) return;
  const value = look === "default" ? null : look;
  if (user) {
    db.update(users).set(who === "me" ? { avatarMe: value } : { avatarRival: value }).where(eq(users.id, user.id)).run();
  } else {
    const jar = await cookies();
    const name = who === "me" ? "gg_av_me" : "gg_av_rival";
    if (value) jar.set(name, value, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
    else jar.delete(name);
  }
  revalidatePath("/", "layout");
}

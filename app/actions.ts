"use server";

import { and, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { phaseSignoffs, projects, userAvatars, answers, careerGoals, careerLevels, careerRequirements, checklistItems, db, enrollments, handovers, invites, knowledgeItems, promotions, questions, roleExams, runs, tracks, users } from "@/lib/db";
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
import { twistFor } from "@/lib/twists";
import { INVITE_TTL_SEC, findOpenInvite, hashToken, newToken } from "@/lib/invites";
import { STARTER_SIZE, starterPlan } from "@/lib/starter";
import { createRoleExam, gradeRoleExam, openRoleExam, roleExamPlan } from "@/lib/roleExam";
import { isLook } from "@/lib/avatars";
import { awardForPass } from "@/lib/rewards";
import { isGlobal, reachOf, scopeInReach, trackInReach, userInReach } from "@/lib/tenancy";
import { canSignOff, gateFor, isPhase, onboardingFor } from "@/lib/onboarding";
import { type Audience, formatScopes, openTo, parseScopes, requirementsFor, scopesOf, setScopes, syncEveryone, syncRequired, validScopes } from "@/lib/paths";

const ONBOARDING = [
  "Read the brand story and values",
  "Meet your manager and agree your 30-60-90 goals",
  "Get access to the tools for your role",
  "Pass level 3 in your first recommended track",
  "Shadow a teammate on a real task",
];
const CUSTOMER_ONBOARDING = [
  "Read the welcome guide for your product",
  "Complete your getting-started path",
  "Tell us what you want to achieve in your first 30 days",
];
const OFFBOARDING = [
  "Write handover notes for each area you own",
  "Transfer ownership of accounts, files and customers",
  "Record answers to the 10 questions only you know",
  "Return equipment and revoke tool access",
];

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

type Tx = Pick<typeof db, "insert" | "select" | "update" | "delete">;

/** Scope checkboxes in a form are all named "scope" with values like "company:1". */
const formScopes = (fd: FormData) => parseScopes(fd.getAll("scope").filter((v): v is string => typeof v === "string").join(","));

/**
 * New-joiner setup: where they belong (companies, brands, projects), an onboarding checklist, and enrolment in everything
 * they are required to pass. Staff with nothing required yet fall back to the tracks recommended for their job role.
 */
function provision(tx: Tx, userId: number, email: string, jobRole: string, audience: Audience, scopes: ReturnType<typeof parseScopes>) {
  claimPendingInvites(tx, userId, email); // contests this address was invited to before it had an account
  setScopes(tx, userId, validScopes(tx, scopes));
  const steps = audience === "customer" ? CUSTOMER_ONBOARDING : ONBOARDING;
  tx.insert(checklistItems).values(steps.map((label) => ({ userId, kind: "onboarding" as const, label }))).run();
  const required = syncRequired({ id: userId, jobRole, audience }, tx);
  if (audience === "staff") {
    // a role-shaped starter plan (question mix + role pillars) on top of what is required; the old open pick only if it finds nothing
    const have = new Set(tx.select({ id: enrollments.trackId }).from(enrollments).where(eq(enrollments.userId, userId)).all().map((e) => e.id));
    let rec: { id: number }[] = starterPlan({ jobRole, audience }, scopesOf(userId, tx), have, STARTER_SIZE - have.size);
    if (!rec.length && !required && !have.size) {
      const hidden = hiddenTrackIds();
      rec = tx.select().from(tracks).where(or(eq(tracks.roles, ""), like(tracks.roles, `%${jobRole}%`))).all()
        .filter((t) => !hidden.has(t.id) && openTo(audience, t.audience)).slice(0, 6);
    }
    if (rec.length) {
      tx.insert(enrollments).values(rec.map((t) => ({ userId, trackId: t.id, goal: `Onboarding path for ${jobRole}` }))).onConflictDoNothing().run();
    }
  }
}

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
      const u = tx.insert(users).values({ name: p.data.name, email: inv.email, jobRole: inv.jobRole, audience: inv.audience, passwordHash }).returning().get();
      provision(tx, u.id, u.email, inv.jobRole, inv.audience, parseScopes(inv.scopes));
      return u.id;
    });
  } catch {
    return "This invite link is invalid or has expired. Ask your manager for a new one.";
  }
  await startSession(userId);
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
  if (needsRehash(u.passwordHash)) {
    db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, u.id)).run(); // legacy or weaker params
  }
  syncRequired(u); // picks up tracks that became required since their last visit
  await startSession(u.id);
  redirect("/dashboard");
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
    await gradeRoleExam(examId, (qid) => str(fd.get(`q${qid}`)));
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
  const done = db.update(runs).set({ score, passed: score >= PASS_MARK, finishedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(runs.id, runId), sql`${runs.finishedAt} is null`)).run();
  if (!done.changes) return; // finished by someone else in the meantime
  const passed = score >= PASS_MARK;
  completeQuest(u.id, run.trackId, "exam");
  if (passed) awardForPass(u.id, run.trackId, run.level, score); // certificate, XP, voucher or money, as the content's owner has set

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
  if (db.select().from(users).where(eq(users.email, p.data.email)).get()) return "That email already exists.";

  const u = db.insert(users).values({ name: p.data.name, email: p.data.email, jobRole: p.data.jobRole, audience: p.data.audience, passwordHash: await hashPassword(p.data.password) }).returning().get();
  provision(db, u.id, u.email, p.data.jobRole, p.data.audience, scopes);
  revalidatePath("/admin/people");
  return null;
}

export type InviteState = {
  error?: string;
  invites?: { email: string; path: string }[];
  /** addresses that already have an account, so no link was made */
  skipped?: string[];
  /** worth knowing before the link goes out, e.g. nothing is set up for this role yet */
  notice?: string;
} | null;

const MAX_INVITES_AT_ONCE = 25;

/** Issues a single-use signup link for each email, all with the same role and scope. Tokens are shown once; only hashes are stored. */
export async function createInvite(_: InviteState, fd: FormData): Promise<InviteState> {
  const me = await requireManager();
  const emails = [...new Set(str(fd.get("emails")).toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const p = z.object({
    emails: z.array(z.string().email().max(120)).min(1).max(MAX_INVITES_AT_ONCE),
    jobRole: z.string().min(1).max(40),
    audience: z.enum(["staff", "customer"]),
  }).safeParse({ emails, jobRole: str(fd.get("jobRole")).toLowerCase(), audience: str(fd.get("audience")) || "staff" });
  if (!p.success) return { error: `Enter one to ${MAX_INVITES_AT_ONCE} valid email addresses and a role.` };
  const scopes = validScopes(db, formScopes(fd));
  if (!scopes.length) return { error: "Pick at least one company, brand or project they belong to." };
  const reach = reachOf(me.id);
  if (scopes.some((s) => !scopeInReach(reach, s))) return { error: "You can only invite people to the companies, brands and projects you run." };

  const taken = new Set(db.select({ e: users.email }).from(users).where(inArray(users.email, p.data.emails)).all().map((r) => r.e));
  const fresh = p.data.emails.filter((e) => !taken.has(e));
  if (!fresh.length) return { error: p.data.emails.length === 1 ? "That email already has an account." : "Every one of those emails already has an account." };

  const expiresAt = Math.floor(Date.now() / 1000) + INVITE_TTL_SEC;
  const invites_ = fresh.map((email) => {
    const token = newToken();
    db.insert(invites).values({ tokenHash: hashToken(token), email, jobRole: p.data.jobRole, audience: p.data.audience, scopes: formatScopes(scopes), createdBy: me.id, expiresAt }).run();
    return { email, path: `/join/${token}` };
  });
  const cov = p.data.audience === "staff" ? coverageFor(p.data.jobRole) : null;
  let notice = cov && hasNoRolePath(cov)
    ? `Nothing is set up for the role "${p.data.jobRole}" yet, so they will only get company-wide learning. Roles with learning: ${knownRoles().join(", ") || "none"}. You can change their role later on People.`
    : undefined;
  // a customer's getting-started subject usually belongs to a product (project), which ticking only its brand does not cover
  if (p.data.audience === "customer" && !requirementsFor({ id: 0, jobRole: p.data.jobRole, audience: "customer" }, scopes).length) {
    const brandIds = scopes.filter((x) => x.kind === "brand").map((x) => x.id);
    const hint = brandIds.length ? db.select({ n: projects.name }).from(tracks).innerJoin(projects, eq(projects.id, tracks.projectId))
      .where(and(eq(tracks.audience, "customer"), inArray(tracks.brandId, brandIds))).all().map((r) => r.n) : [];
    notice = `Nothing is assigned to customers with this scope yet, so they would start with an empty path.${hint.length ? ` Also tick the product: ${[...new Set(hint)].join(", ")}.` : " Tick the product (project) or brand they bought."}`;
  }
  return { invites: invites_, skipped: taken.size ? [...taken] : undefined, notice };
}

/** Moves someone to a different set of companies, brands and projects, then enrols them in whatever that now requires. */
export async function updateScopes(fd: FormData) {
  const me = await requireManager();
  const u = db.select().from(users).where(eq(users.id, Number(fd.get("userId")))).get();
  if (!u || u.status !== "active") return;
  const reach = reachOf(me.id);
  if (!userInReach(reach, u.id)) return;
  const next = validScopes(db, formScopes(fd));
  // someone with no scopes runs everything, so only the platform owner may leave a manager without any
  if (!isGlobal(reach) && (next.some((s) => !scopeInReach(reach, s)) || (!next.length && u.role !== "learner"))) return;
  db.transaction((tx) => {
    setScopes(tx, u.id, next);
    syncRequired(u, tx);
  });
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
  revalidatePath("/dashboard");
}

export async function clearCareerGoal() {
  const me = await requireUser();
  db.delete(careerGoals).where(eq(careerGoals.userId, me.id)).run();
  revalidatePath("/journey");
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
  db.update(users).set({ status: "offboarded", sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)).run(); // access ends now
  db.insert(checklistItems).values(OFFBOARDING.map((label) => ({ userId, kind: "offboarding" as const, label }))).run();
  revalidatePath("/admin/people");
}

export async function retireQuestion(fd: FormData) {
  const me = await requireManager();
  const id = Number(fd.get("id")), status = str(fd.get("status"));
  if (status !== "retired" && status !== "active" && status !== "review") return;
  const owner = db.select({ t: tracks }).from(questions).innerJoin(tracks, eq(tracks.id, questions.trackId)).where(eq(questions.id, id)).get();
  if (!owner || !trackInReach(reachOf(me.id), owner.t)) return;
  const q = db.update(questions).set({ status }).where(eq(questions.id, id)).returning().get();
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

/** Changes what someone does at the company, then enrols them in what that role requires. Managers can only change learners. */
export async function updateRole(_: string | null, fd: FormData): Promise<string | null> {
  const me = await requireManager();
  const p = z.object({ userId: z.coerce.number().int().positive(), jobRole: z.string().trim().toLowerCase().min(1).max(40) })
    .safeParse({ userId: fd.get("userId"), jobRole: str(fd.get("jobRole")) });
  if (!p.success) return "Enter a role of up to 40 characters.";
  const u = db.select().from(users).where(eq(users.id, p.data.userId)).get();
  if (!u || u.status !== "active" || !userInReach(reachOf(me.id), u.id)) return "That person is not active.";
  if (me.role !== "admin" && u.role !== "learner") return "Only an admin can change a manager's role.";
  db.transaction((tx) => {
    tx.update(users).set({ jobRole: p.data.jobRole }).where(eq(users.id, u.id)).run();
    syncRequired({ id: u.id, jobRole: p.data.jobRole, audience: u.audience }, tx);
  });
  revalidatePath("/admin/people");
  revalidatePath("/admin/compliance");
  revalidatePath("/admin/careers");
  return null;
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

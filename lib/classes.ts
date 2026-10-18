import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { classAssignments, dailyQuests, db, runs, teamMembers, teams, tracks, users } from "@/lib/db";
import { enrol } from "@/lib/contests";
import { publicTracks } from "@/lib/publicCatalog";
import { topicLabel } from "@/lib/topicName";
import { MAX_LEVEL } from "@/lib/levels";

/**
 * Classes: a team whose owner is a teacher. A teacher sets assignments ("reach level N in this topic by this date") and sees how each student is getting on;
 * students see their own assignments and nobody else's, and there is no board to compare. What a teacher sees is deliberately narrow: only the assigned
 * topics (levels passed in them, when the student last practised on them) and whether each assignment is done, late or still open. Never the student's other
 * topics, XP, streak, email or anything outside the class. Students are told this before they join. Whether an assignment is done is worked out from real exams.
 * Only topics anyone may take (the public ones, lib/publicCatalog.ts) can be assigned, so every student can really do them.
 */
export const MAX_ASSIGNMENTS = 30, MAX_DUE_DAYS = 180;
type Team = typeof teams.$inferSelect;
const nowSec = () => Math.floor(Date.now() / 1000);

export type Result = { ok: true; id?: number } | { error: string };
export const isTeacher = (userId: number, t: Pick<Team, "kind" | "ownerId">) => t.kind === "class" && t.ownerId === userId;

const teamOf = (id: number) => db.select().from(teams).where(eq(teams.id, id)).get();
const studentIds = (teamId: number, ownerId: number) => db.select({ id: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.teamId, teamId)).all().map((r) => r.id).filter((id) => id !== ownerId);

/** The topics a teacher may assign: public ones with questions, so every student can really take them. */
export function assignableTopics(): { id: number; name: string }[] {
  return publicTracks().map((r) => ({ id: r.track.id, name: topicLabel(r.track.name) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Sets an assignment and puts the students already in the class on the topic. */
export function createAssignment(teacher: number, teamId: number, trackId: number, level: number, dueDays: number, at = nowSec()): Result {
  const t = teamOf(teamId);
  if (!t || t.archivedAt || !isTeacher(teacher, t)) return { error: "Only the class's teacher can set an assignment." };
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return { error: `Choose a level from 1 to ${MAX_LEVEL}.` };
  if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > MAX_DUE_DAYS) return { error: `Choose a deadline from 1 to ${MAX_DUE_DAYS} days away.` };
  if (!publicTracks().some((r) => r.track.id === trackId)) return { error: "Pick a topic from the list." };
  const open = db.select({ n: sql<number>`count(*)` }).from(classAssignments).where(and(eq(classAssignments.teamId, teamId), isNull(classAssignments.removedAt))).get()?.n ?? 0;
  if (Number(open) >= MAX_ASSIGNMENTS) return { error: `A class can have ${MAX_ASSIGNMENTS} assignments at once. Remove one first.` };
  const row = db.insert(classAssignments).values({ teamId, trackId, level, dueAt: at + dueDays * 86400 }).returning().get();
  for (const s of studentIds(teamId, t.ownerId)) enrol(db, s, trackId, `Class: ${t.name}`);
  return { ok: true, id: row.id };
}

export function removeAssignment(teacher: number, assignmentId: number): Result {
  const a = db.select().from(classAssignments).where(eq(classAssignments.id, assignmentId)).get();
  const t = a && teamOf(a.teamId);
  if (!a || !t || !isTeacher(teacher, t)) return { error: "That assignment is not yours to remove." };
  db.update(classAssignments).set({ removedAt: nowSec() }).where(and(eq(classAssignments.id, a.id), isNull(classAssignments.removedAt))).run();
  return { ok: true };
}

/** A student joined: they go onto every topic the class has been assigned. */
export function enrolInClass(teamId: number, userId: number) {
  const t = teamOf(teamId);
  if (!t || t.kind !== "class") return;
  for (const a of assignmentsOf(teamId)) enrol(db, userId, a.trackId, `Class: ${t.name}`);
}

export type Assignment = { id: number; trackId: number; topic: string; level: number; dueAt: number };
export function assignmentsOf(teamId: number): Assignment[] {
  return db.select({ a: classAssignments, n: tracks.name }).from(classAssignments).innerJoin(tracks, eq(tracks.id, classAssignments.trackId))
    .where(and(eq(classAssignments.teamId, teamId), isNull(classAssignments.removedAt))).orderBy(asc(classAssignments.dueAt), asc(classAssignments.id)).all()
    .map((r) => ({ id: r.a.id, trackId: r.a.trackId, topic: topicLabel(r.n), level: r.a.level, dueAt: r.a.dueAt }));
}

export type Status = "done" | "open" | "late";
export const statusOf = (passed: number, a: { level: number; dueAt: number }, at = nowSec()): Status => (passed >= a.level ? "done" : at > a.dueAt ? "late" : "open");

/** The highest level each person has passed in each topic, for the people and topics asked about. */
function passedLevels(userIds: number[], trackIds: number[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!userIds.length || !trackIds.length) return out;
  for (const r of db.select({ u: runs.userId, t: runs.trackId, m: sql<number>`max(${runs.level})` }).from(runs).where(and(inArray(runs.userId, userIds), inArray(runs.trackId, trackIds), eq(runs.passed, true))).groupBy(runs.userId, runs.trackId).all()) out.set(`${r.u}:${r.t}`, Number(r.m));
  return out;
}

export type MyAssignment = Assignment & { passed: number; status: Status };
/** A student's own view of the class's assignments. Only theirs. */
export function myAssignments(userId: number, teamId: number, at = nowSec()): MyAssignment[] {
  const list = assignmentsOf(teamId), p = passedLevels([userId], list.map((a) => a.trackId));
  return list.map((a) => ({ ...a, passed: p.get(`${userId}:${a.trackId}`) ?? 0, status: statusOf(p.get(`${userId}:${a.trackId}`) ?? 0, a, at) }));
}

export type StudentRow = { userId: number; name: string; joinedAt: number; done: number; late: number; total: number; lastPracticed: number | null; each: { assignmentId: number; passed: number; status: Status }[] };
/**
 * The teacher's roster. Returns null for anyone who is not this class's teacher. Per student: the status of each assignment and when they last practised
 * on an assigned topic: nothing else about them.
 */
export function rosterFor(teacher: number, teamId: number, at = nowSec()): { assignments: Assignment[]; students: StudentRow[] } | null {
  const t = teamOf(teamId);
  if (!t || !isTeacher(teacher, t)) return null;
  const assignments = assignmentsOf(teamId), tracksUsed = [...new Set(assignments.map((a) => a.trackId))];
  const people = db.select({ id: users.id, name: users.name, joinedAt: teamMembers.joinedAt }).from(teamMembers).innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(eq(teamMembers.teamId, teamId), eq(users.status, "active"))).all().filter((p) => p.id !== t.ownerId);
  const ids = people.map((p) => p.id), passed = passedLevels(ids, tracksUsed);
  const last = new Map<number, number>();
  if (ids.length && tracksUsed.length) {
    for (const r of db.select({ u: runs.userId, m: sql<number>`max(${runs.finishedAt})` }).from(runs).where(and(inArray(runs.userId, ids), inArray(runs.trackId, tracksUsed), gte(runs.finishedAt, 1))).groupBy(runs.userId).all()) last.set(r.u, Number(r.m));
    for (const r of db.select({ u: dailyQuests.userId, m: sql<string>`max(${dailyQuests.day})` }).from(dailyQuests).where(and(inArray(dailyQuests.userId, ids), inArray(dailyQuests.trackId, tracksUsed))).groupBy(dailyQuests.userId).all()) last.set(r.u, Math.max(last.get(r.u) ?? 0, Math.floor(new Date(`${r.m}T00:00:00Z`).getTime() / 1000)));
  }
  const students = people.map((p): StudentRow => {
    const each = assignments.map((a) => { const pl = passed.get(`${p.id}:${a.trackId}`) ?? 0; return { assignmentId: a.id, passed: pl, status: statusOf(pl, a, at) }; });
    return { userId: p.id, name: p.name, joinedAt: p.joinedAt, done: each.filter((e) => e.status === "done").length, late: each.filter((e) => e.status === "late").length, total: each.length, lastPracticed: last.get(p.id) ?? null, each };
  }).sort((a, b) => b.late - a.late || a.done - b.done || a.name.localeCompare(b.name)); // who needs attention first
  return { assignments, students };
}

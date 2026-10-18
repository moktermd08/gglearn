import { and, eq, inArray, sql } from "drizzle-orm";
import { certificates, db, enrollments, mentorships, runs, tracks, users } from "@/lib/db";
import { allowed, hit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { pickableTopics } from "@/lib/pickTopics";
import { goalOf, roleLabel } from "@/lib/journey";
import { referrerOf } from "@/lib/referrals";
import { shortName } from "@/lib/seasons";
import { topicLabel } from "@/lib/topicName";
import { weekStats } from "@/lib/friends";

/**
 * Mentoring. The learner (the mentee) chooses their mentor: the link a mentee shares is their consent, and pressing the button on it is the mentor's.
 * Either side can end it at any time, and nobody is told when it ends. A mentor sees what a mentee would show a coach and nothing more: their name, this
 * week's XP, their streak, the topics they have been working on with the level reached, their career goal, and how many certificates they have. Never
 * their email, their other relationships or anything about anyone else. A topic is named only if the mentor could see that topic themselves. A mentor can
 * send a short note of encouragement, which arrives as a notification.
 */
export const MAX_MENTEES = 25, MAX_MENTORS = 3, NOTE_MAX = 140;
/** A parent or guardian follows a child the same way, with their own limits: up to 4 parents per child, 10 children per parent. The child is the one who agrees (by sharing the parent link); a parent cannot add themselves. */
export const MAX_PARENTS = 4, MAX_CHILDREN = 10;
export type Kind = "mentor" | "parent";
const LABEL: Record<Kind, string> = { mentor: "mentor", parent: "parent" };
const nowSec = () => Math.floor(Date.now() / 1000);
export type Result = { ok: true; message?: string } | { error: string };

export const isMentor = (mentorId: number, menteeId: number) => mentorId !== menteeId && !!db.select().from(mentorships).where(and(eq(mentorships.mentorId, mentorId), eq(mentorships.menteeId, menteeId))).get();
const active = (id: number) => db.select({ s: users.status }).from(users).where(eq(users.id, id)).get()?.s === "active";
const count = (col: typeof mentorships.mentorId | typeof mentorships.menteeId, id: number, kind: Kind = "mentor") => Number(db.select({ n: sql<number>`count(*)` }).from(mentorships).where(and(eq(col, id), eq(mentorships.kind, kind))).get()?.n ?? 0);
/** How one person follows another, or null if they do not. */
export const kindOf = (followerId: number, learnerId: number): Kind | null => db.select({ k: mentorships.kind }).from(mentorships).where(and(eq(mentorships.mentorId, followerId), eq(mentorships.menteeId, learnerId))).get()?.k ?? null;

/** Someone opened a mentee's invite link and pressed the button: they are now that person's mentor. */
export function acceptMentorship(mentorId: number, code: string, kind: Kind = "mentor"): Result {
  const menteeId = referrerOf(code);
  if (menteeId === null || !active(menteeId)) return { error: "This mentor invitation is not valid any more." };
  if (menteeId === mentorId) return { error: "That is your own invitation. Send it to the person you want as a mentor." };
  const have = kindOf(mentorId, menteeId);
  if (have === kind) return { ok: true, message: kind === "parent" ? "You already follow them as a parent." : "You already mentor them." };
  if (have) return { error: `You already follow them as their ${LABEL[have]}. End that first if you want to change it.` };
  const maxIn = kind === "parent" ? MAX_PARENTS : MAX_MENTORS, maxOut = kind === "parent" ? MAX_CHILDREN : MAX_MENTEES;
  if (count(mentorships.menteeId, menteeId, kind) >= maxIn) return { error: `They already have ${maxIn} ${LABEL[kind]}s.` };
  if (count(mentorships.mentorId, mentorId, kind) >= maxOut) return { error: kind === "parent" ? `You already follow ${MAX_CHILDREN} children.` : `You already mentor ${MAX_MENTEES} people.` };
  db.insert(mentorships).values({ mentorId, menteeId, kind }).onConflictDoNothing().run();
  const name = db.select({ n: users.name }).from(users).where(eq(users.id, mentorId)).get()?.n ?? "Someone";
  notify(menteeId, { key: `mentor-yes-${mentorId}`, kind: "system", title: `${shortName(name)} is now your ${LABEL[kind]}`, body: "They can see your progress and goals. You can end it any time.", href: "/mentoring" });
  return { ok: true };
}

/** Ends it. Either side may; neither is told. */
export function endMentorship(me: number, otherId: number) {
  db.delete(mentorships).where(and(eq(mentorships.mentorId, me), eq(mentorships.menteeId, otherId))).run();
  db.delete(mentorships).where(and(eq(mentorships.mentorId, otherId), eq(mentorships.menteeId, me))).run();
}

export const mentorsOf = (menteeId: number) => db.select({ id: users.id, name: users.name, kind: mentorships.kind }).from(mentorships).innerJoin(users, eq(users.id, mentorships.mentorId)).where(and(eq(mentorships.menteeId, menteeId), eq(users.status, "active"))).all().map((u) => ({ id: u.id, name: shortName(u.name), kind: u.kind }));
export const menteesOf = (mentorId: number) => db.select({ id: users.id, name: users.name, kind: mentorships.kind }).from(mentorships).innerJoin(users, eq(users.id, mentorships.menteeId)).where(and(eq(mentorships.mentorId, mentorId), eq(users.status, "active"))).all().map((u) => ({ id: u.id, name: u.name, kind: u.kind }));

export type MenteeSummary = {
  name: string; weekXp: number; streak: number; certificates: number;
  topics: { name: string; passed: number; lastAt: number }[];
  goal: { role: string; date: number } | null;
};

/** What a mentor sees of a mentee: null unless this person really is their mentor. */
export function menteeSummary(mentorId: number, menteeId: number, at = nowSec()): MenteeSummary | null {
  if (!isMentor(mentorId, menteeId) || !active(menteeId)) return null;
  const me = db.select({ name: users.name }).from(users).where(eq(users.id, menteeId)).get()!;
  const st = weekStats([menteeId], at).get(menteeId) ?? { weekXp: 0, streak: 0 };
  const mentor = db.select({ role: users.role, audience: users.audience }).from(users).where(eq(users.id, mentorId)).get();
  const visible = new Set(mentor ? pickableTopics({ id: mentorId, role: mentor.role, audience: mentor.audience }).map((t) => t.id) : []);
  const enrolled = db.select({ t: enrollments.trackId, at: enrollments.startedAt }).from(enrollments).where(eq(enrollments.userId, menteeId)).all();
  const ids = enrolled.map((e) => e.t);
  const best = new Map(ids.length ? db.select({ t: runs.trackId, m: sql<number>`max(case when ${runs.passed} then ${runs.level} else 0 end)`, l: sql<number>`max(${runs.finishedAt})` }).from(runs).where(and(eq(runs.userId, menteeId), inArray(runs.trackId, ids))).groupBy(runs.trackId).all().map((r) => [r.t, r]) : []);
  const names = new Map(ids.length ? db.select({ id: tracks.id, n: tracks.name }).from(tracks).where(inArray(tracks.id, ids)).all().map((t) => [t.id, t.n]) : []);
  const topics = enrolled.map((e) => ({ name: visible.has(e.t) ? topicLabel(names.get(e.t) ?? "a topic") : "a topic", passed: Number(best.get(e.t)?.m ?? 0), lastAt: Number(best.get(e.t)?.l ?? e.at) }))
    .sort((a, b) => b.lastAt - a.lastAt).slice(0, 6);
  const g = goalOf(menteeId);
  return {
    name: me.name, weekXp: st.weekXp, streak: st.streak, topics,
    certificates: Number(db.select({ n: sql<number>`count(*)` }).from(certificates).where(and(eq(certificates.userId, menteeId), sql`${certificates.revokedAt} is null`)).get()?.n ?? 0),
    goal: g ? { role: roleLabel(g.targetRole), date: g.targetDate } : null,
  };
}

/** A short note from a mentor to a mentee, as a notification. Only an actual mentor can send one, in plain text of up to NOTE_MAX characters, a few a day. */
export function encourage(mentorId: number, menteeId: number, text: string, at = nowSec()): Result {
  if (!isMentor(mentorId, menteeId) || !active(menteeId)) return { error: "You are not this person's mentor." };
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 2) return { error: "Write a few words." };
  if (t.length > NOTE_MAX) return { error: `Keep it to ${NOTE_MAX} characters.` };
  const key = `mentor-note:${mentorId}:${menteeId}`;
  if (!allowed(key, 5)) return { error: "That is plenty for one day. They will see what you have sent." };
  hit(key, 24 * 60 * 60 * 1000);
  const name = db.select({ n: users.name }).from(users).where(eq(users.id, mentorId)).get()?.n ?? "Your mentor";
  notify(menteeId, { key: `mentor-note-${mentorId}-${at}-${Math.random().toString(36).slice(2, 7)}`, kind: "system", title: `${shortName(name)}, your ${LABEL[kindOf(mentorId, menteeId) ?? "mentor"]}, says:`, body: t, href: "/mentoring" });
  return { ok: true };
}

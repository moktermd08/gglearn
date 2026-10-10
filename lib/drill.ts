import { and, eq, lte } from "drizzle-orm";
import { db, enrollments, questions } from "@/lib/db";
import { levelsPassed } from "@/lib/progress";

/**
 * Highest level a drill may draw from. Drills never touch the level the learner is about to
 * sit (that would reveal exam answers); only levels already passed. A brand-new learner has
 * passed nothing, so they drill level 1.
 */
export function drillMaxLevel(userId: number, trackId: number): number {
  return Math.max(levelsPassed(userId, trackId), 1);
}

export function isEnrolled(userId: number, trackId: number): boolean {
  return !!db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId))).get();
}

/** The question, only if this learner is allowed to drill on it. */
export function drillQuestion(userId: number, questionId: number) {
  const q = db.select().from(questions).where(eq(questions.id, questionId)).get();
  if (!q || q.type !== "mcq" || q.status !== "active") return null;
  if (!isEnrolled(userId, q.trackId) || q.level > drillMaxLevel(userId, q.trackId)) return null;
  return q;
}

export const drillLevelFilter = (userId: number, trackId: number) => lte(questions.level, drillMaxLevel(userId, trackId));

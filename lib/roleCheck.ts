import { and, eq, gte } from "drizzle-orm";
import { db, roleExams } from "@/lib/db";
import { hasDynamic } from "@/lib/dynamic/store";

/** A role check pass counts towards a promotion for this many days. */
export const ROLE_CHECK_VALID_DAYS = 90;
/** A role check below this many drawable questions is not offered: it would not be a fair sample of the mix. */
export const ROLE_EXAM_MIN = 10;

const DAY = 86400;

/** When the person's latest passing role check for this role, aimed at `minRung` or higher, stops counting. Null if there is none in date. */
export function roleCheckValidUntil(userId: number, role: string, minRung: number, at: number): number | null {
  const rows = db.select().from(roleExams)
    .where(and(eq(roleExams.userId, userId), eq(roleExams.role, role), eq(roleExams.passed, true), gte(roleExams.finishedAt, at - ROLE_CHECK_VALID_DAYS * DAY))).all()
    .filter((r) => r.rung >= minRung && r.finishedAt != null);
  if (!rows.length) return null;
  return Math.max(...rows.map((r) => r.finishedAt!)) + ROLE_CHECK_VALID_DAYS * DAY;
}

/**
 * Could a role check be drawn from these tracks? A track with generated questions can always supply them; otherwise the stored
 * questions must reach the minimum. Used so nobody is held back by a check that cannot be offered.
 */
export function roleCheckDrawable(tracks: { slug: string; questions: number; level: number }[]): boolean {
  if (tracks.some((t) => hasDynamic(t.slug, t.level))) return true;
  return tracks.reduce((a, t) => a + t.questions, 0) >= ROLE_EXAM_MIN;
}

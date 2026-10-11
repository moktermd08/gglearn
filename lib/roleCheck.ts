import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, questions, roleExams } from "@/lib/db";
import { DOMAIN_KEYS, apportion, examPlan, type Domain, type Mix } from "@/lib/blueprint";
import { hasDynamic } from "@/lib/dynamic/store";

/** A role check pass counts towards a promotion for this many days. */
export const ROLE_CHECK_VALID_DAYS = 90;
/** How many questions a role check asks. */
export const ROLE_EXAM_SIZE = 20;
/** A role check below this many drawable questions is not offered: it would not be a fair sample of the mix. */
export const ROLE_EXAM_MIN = 10;
/** How far below a step's level a stored question may come from, so the check is not only the hardest material. */
export const LEVEL_SPREAD = 2;

const DAY = 86400;

let tablesReady = false;

/** Is this the database saying the table is not there (as opposed to being busy, locked or broken)? Drizzle may wrap the driver's error. */
export function isMissingTable(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if (/no such table/i.test(String((e as { message?: unknown }).message ?? ""))) return true;
  }
  return false;
}

/**
 * Are the role check tables there? They arrive with `npm run db:push`. Until then nobody can take a check, so nothing may
 * depend on one: promotion is not held for it, and pages that mention it stay quiet instead of failing. Only a missing table
 * counts: any other error (busy, locked, broken) is rethrown, because treating it as "no tables" would silently drop the
 * requirement and let people be promoted without a check.
 */
export function roleExamsAvailable(): boolean {
  if (tablesReady) return true;
  try {
    db.select({ id: roleExams.id }).from(roleExams).limit(1).all();
    return (tablesReady = true);
  } catch (err) {
    if (isMissingTable(err)) return false;
    throw err;
  }
}

/** When the person's latest passing role check for this role, aimed at level `minLevel` or higher, stops counting. Null if there is none in date. (`role_exams.rung` holds the target level's number.) */
export function roleCheckValidUntil(userId: number, role: string, minLevel: number, at: number): number | null {
  const rows = db.select().from(roleExams)
    .where(and(eq(roleExams.userId, userId), eq(roleExams.role, role), eq(roleExams.passed, true), gte(roleExams.finishedAt, at - ROLE_CHECK_VALID_DAYS * DAY))).all()
    .filter((r) => r.rung >= minLevel && r.finishedAt != null);
  if (!rows.length) return null;
  return Math.max(...rows.map((r) => r.finishedAt!)) + ROLE_CHECK_VALID_DAYS * DAY;
}

export type CheckSource = { trackId: number; slug: string; domain: Domain; level: number };

/** How many questions each track can give a role check: unlimited where it generates them, else its stored ones near the step's level. */
function capacities(sources: CheckSource[]): Map<number, number> {
  const out = new Map<number, number>();
  const stored = sources.filter((s) => !hasDynamic(s.slug, s.level));
  for (const s of sources) if (hasDynamic(s.slug, s.level)) out.set(s.trackId, Infinity);
  if (stored.length) {
    const rows = db.select({ t: questions.trackId, l: questions.level, n: sql<number>`count(*)` }).from(questions)
      .where(and(eq(questions.status, "active"), inArray(questions.trackId, stored.map((s) => s.trackId)))).groupBy(questions.trackId, questions.level).all();
    for (const s of stored) {
      out.set(s.trackId, rows.filter((r) => r.t === s.trackId && r.l >= Math.max(1, s.level - LEVEL_SPREAD) && r.l <= s.level).reduce((a, r) => a + r.n, 0));
    }
  }
  return out;
}

/**
 * How many questions each domain gets. The role's mix says what is wanted; a domain with no examinable track, or fewer
 * questions than its share, hands the rest to the domains that still have room, in proportion to what those were asked for.
 * The same plan decides whether a check can be offered and what it draws, so the two cannot disagree.
 */
export function planDomains(role: string, rung: number, rungs: number, sources: CheckSource[], size = ROLE_EXAM_SIZE): { wanted: Mix; planned: Mix } {
  const wanted = examPlan(role, rung, rungs, size);
  const cap = capacities(sources);
  const room = Object.fromEntries(DOMAIN_KEYS.map((d) => [d, sources.filter((s) => s.domain === d).reduce((a, s) => a + (cap.get(s.trackId) ?? 0), 0)])) as Record<Domain, number>;
  const given = Object.fromEntries(DOMAIN_KEYS.map((d) => [d, 0])) as Mix;
  let remaining = size, open = DOMAIN_KEYS.filter((d) => room[d] > 0);
  while (remaining > 0 && open.length) {
    const part = apportion(remaining, open.map((d) => wanted[d] || 1));
    let used = 0;
    for (const [i, d] of open.entries()) {
      const take = Math.min(part[i], room[d] - given[d]);
      given[d] += take;
      used += take;
    }
    if (!used) break;
    remaining -= used;
    open = open.filter((d) => given[d] < room[d]);
  }
  return { wanted, planned: given };
}

/** Could a fair role check be drawn for this rung from these tracks? */
export function roleCheckDrawable(role: string, rung: number, rungs: number, sources: CheckSource[]): boolean {
  if (!sources.length) return false;
  const { planned } = planDomains(role, rung, rungs, sources);
  return DOMAIN_KEYS.reduce((a, d) => a + planned[d], 0) >= ROLE_EXAM_MIN;
}

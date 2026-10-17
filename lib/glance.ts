import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, invites, questions, tracks } from "@/lib/db";
import { complianceReport, parseScopes } from "@/lib/paths";
import { pendingCounts } from "@/lib/freshness";
import { expiryWatch } from "@/lib/certsAdmin";
import { type Reach, personInReach, reachOf, trackInReach, usersInReach } from "@/lib/tenancy";

/**
 * The numbers behind "Needs your attention", counted only over what this manager or admin runs. A company's manager never sees
 * another company's overdue people, open invites, unread updates or expiring certificates; the platform owner (no scopes) sees all.
 */
type Counts = ReturnType<typeof computeGlance>;
const memo = new Map<string, { at: number; v: Counts }>();
const ttlMs = () => Number(process.env.GLANCE_TTL_MS ?? 30_000); // read each time so a script can switch it off
const reachKey = (r: Reach) => (r.all ? "all" : [...r.keys].sort().join(","));

/**
 * Kept for a short while per person and scope: for the platform owner these cover the whole academy, which is the slowest thing on the
 * dashboard, and a count that is half a minute old is fine for "what needs your attention". Sign-offs are not part of it (they are asked for fresh).
 * `reach`: the whole of what they run, or the company or brand they have switched to in the admin.
 */
export function glanceCounts(viewer: { id: number; role: string }, reach: Reach = reachOf(viewer.id)): Counts {
  const key = `${viewer.id}:${viewer.role}:${reachKey(reach)}`, hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs()) return hit.v;
  const v = computeGlance(viewer, reach);
  if (memo.size > 500) memo.clear();
  memo.set(key, { at: Date.now(), v });
  return v;
}

function computeGlance(viewer: { id: number; role: string }, reach: Reach) {
  const mine = usersInReach(reach);
  const rows = complianceReport(mine); // only the people in scope, so a company manager never pays for the whole academy
  const now = Math.floor(Date.now() / 1000);
  const invitesWaiting = db.select().from(invites).where(and(isNull(invites.usedAt), gt(invites.expiresAt, now))).all()
    .filter((i) => reach.all || personInReach(reach, parseScopes(i.scopes))).length;
  let held = 0;
  if (viewer.role === "admin") {
    const byTrack = db.select({ id: questions.trackId, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "review")).groupBy(questions.trackId).all();
    if (reach.all) held = byTrack.reduce((a, r) => a + r.n, 0);
    else {
      const ok = new Set(db.select().from(tracks).all().filter((t) => trackInReach(reach, t)).map((t) => t.id));
      held = byTrack.filter((r) => ok.has(r.id)).reduce((a, r) => a + r.n, 0);
    }
  }
  const unread = [...pendingCounts(mine)].reduce((a, [, n]) => a + n, 0);
  return {
    overdue: rows.filter((r) => r.state === "overdue").length,
    unassigned: rows.filter((r) => r.state === "no-scope").length,
    invitesWaiting, held, unread,
    certs: expiryWatch(mine),
  };
}

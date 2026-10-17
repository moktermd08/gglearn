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
export function glanceCounts(viewer: { id: number; role: string }, reach: Reach = reachOf(viewer.id)) {
  const mine = usersInReach(reach); // `reach`: the whole of what they run, or the company or brand they have switched to
  const inMine = (id: number) => !mine || mine.has(id);
  const rows = complianceReport().filter((r) => inMine(r.person.id));
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
  const unread = [...pendingCounts()].filter(([id]) => inMine(id)).reduce((a, [, n]) => a + n, 0);
  return {
    overdue: rows.filter((r) => r.state === "overdue").length,
    unassigned: rows.filter((r) => r.state === "no-scope").length,
    invitesWaiting, held, unread,
    certs: expiryWatch(mine),
  };
}

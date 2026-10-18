import { and, desc, eq, inArray, isNull, like, not } from "drizzle-orm";
import { competitionMembers, competitions, db, tracks, users } from "@/lib/db";
import { isGlobal, reachOf, userInReach, usersInReach } from "@/lib/tenancy";
import { stateOf } from "@/lib/competitions";

/**
 * Who may moderate a contest. The organiser always may (their own contest). An admin may moderate a contest only when its organiser is someone
 * they run, by the same rule as people, topics and rewards (lib/tenancy.ts): a company's admin moderates their company's people's contests,
 * and the platform owner (an admin with no company, who runs everything) moderates all of them, including the public campaigns and those run
 * by individuals. Managers and learners moderate only their own. Nobody can moderate a contest by being an admin somewhere else.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };

export function canModerate(me: Me, c: { createdBy: number }): boolean {
  if (c.createdBy === me.id) return true;
  return me.role === "admin" && userInReach(reachOf(me.id), c.createdBy);
}

/** Cancels a contest if this person may. Returns whether it was cancelled. Already finished or cancelled contests are left alone. */
export function cancelContest(me: Me, id: number, at = Math.floor(Date.now() / 1000)): boolean {
  const c = db.select().from(competitions).where(eq(competitions.id, id)).get();
  if (!c || !canModerate(me, c)) return false;
  return !!db.update(competitions).set({ canceledAt: at }).where(and(eq(competitions.id, c.id), isNull(competitions.canceledAt))).run().changes;
}

/** Switches off a contest's invite link (never turns one on: that is the organiser's choice). */
export function switchOffInviteLink(me: Me, id: number): boolean {
  const c = db.select().from(competitions).where(eq(competitions.id, id)).get();
  if (!c || !canModerate(me, c) || c.guestLinkVersion == null) return false;
  return !!db.update(competitions).set({ guestLinkVersion: null }).where(eq(competitions.id, c.id)).run().changes;
}

export type ContestRow = { id: number; slug: string; title: string; topic: string; organiser: string; campaign: boolean; state: string; humans: number; bots: number; visibility: "public" | "private"; linkOn: boolean; endsAt: number };

/** The contests this admin may moderate, newest first. The public campaign rounds are left out unless asked for, as there are hundreds. */
export function contestsInReach(me: Me, opts: { campaigns?: boolean; state?: "live" | "upcoming" | "finished" | "canceled"; limit?: number; offset?: number } = {}): { rows: ContestRow[]; total: number } {
  if (me.role !== "admin") return { rows: [], total: 0 };
  const reach = reachOf(me.id), people = usersInReach(reach);
  const base = db.select({ c: competitions, topic: tracks.name, organiser: users.name }).from(competitions).innerJoin(tracks, eq(tracks.id, competitions.trackId)).innerJoin(users, eq(users.id, competitions.createdBy))
    .where(and(opts.campaigns ? undefined : not(like(competitions.slug, "camp-%")), people ? inArray(competitions.createdBy, [...people].length ? [...people] : [-1]) : undefined)).orderBy(desc(competitions.id)).all()
    .filter((r) => !opts.state || stateOf(r.c) === opts.state);
  const slice = base.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
  const ids = slice.map((r) => r.c.id);
  const members = ids.length ? db.select().from(competitionMembers).where(inArray(competitionMembers.competitionId, ids)).all() : [];
  return {
    total: base.length,
    rows: slice.map(({ c, topic, organiser }): ContestRow => ({
      id: c.id, slug: c.slug, title: c.title, topic, organiser, campaign: c.slug.startsWith("camp-"), state: stateOf(c), visibility: c.visibility, linkOn: c.guestLinkVersion != null, endsAt: c.endsAt,
      humans: members.filter((m) => m.competitionId === c.id && m.kind === "human" && m.status === "joined").length, bots: members.filter((m) => m.competitionId === c.id && m.kind === "bot").length,
    })),
  };
}

export const isOwner = (me: Me) => me.role === "admin" && isGlobal(reachOf(me.id));

/** Of the admins, the one who should own the public campaigns: the first who runs the whole academy. An admin tied to one company never does, or the campaigns would only be listed inside that company. */
export function pickOwner(admins: { id: number; scoped: boolean }[]): number | null {
  return [...admins].filter((a) => !a.scoped).sort((a, b) => a.id - b.id)[0]?.id ?? null;
}

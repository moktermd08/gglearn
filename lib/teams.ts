import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { dailyQuests, db, runs, teamMembers, teams, users } from "@/lib/db";

/**
 * Teams anyone can start. The link is `${id}.${signature}` (an HMAC of the id), so nothing secret is stored and the owner can copy it again;
 * who may join is decided by the row: the team must be open and not closed, and have room.
 */
export const MAX_TEAM_SIZE = 30, MAX_OWNED_TEAMS = 10, MAX_MY_TEAMS = 25;

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (id: number) => createHmac("sha256", secret()).update(`team:${id}`).digest("base64url").slice(0, 20);

export const teamToken = (id: number) => `${id}.${sign(id)}`;
export const teamPath = (id: number) => `/t/${teamToken(id)}`;

type Team = typeof teams.$inferSelect;

/** The team behind a join-link token, whatever its state; null for anything that is not a genuine token. */
export function teamByToken(token: string): Team | null {
  const m = /^(\d{1,9})\.([A-Za-z0-9_-]{20})$/.exec(token);
  if (!m) return null;
  const want = Buffer.from(sign(Number(m[1]))), got = Buffer.from(m[2]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return db.select().from(teams).where(eq(teams.id, Number(m[1]))).get() ?? null;
}

export const memberCount = (teamId: number) => Number(db.select({ n: sql<number>`count(*)` }).from(teamMembers).where(eq(teamMembers.teamId, teamId)).get()?.n ?? 0);

export type JoinState = "open" | "closed" | "full" | "archived";
export const joinState = (t: Team, members = memberCount(t.id)): JoinState => t.archivedAt ? "archived" : !t.joinOpen ? "closed" : members >= MAX_TEAM_SIZE ? "full" : "open";

/** Adds a person. Returns an error message, or null. Room is checked inside the same transaction as the insert. */
export function addMember(teamId: number, userId: number, opts: { force?: boolean } = {}): string | null {
  return db.transaction((tx) => {
    const t = tx.select().from(teams).where(eq(teams.id, teamId)).get();
    if (!t || t.archivedAt) return "This team is closed.";
    if (!opts.force && !t.joinOpen) return "This team is not taking new members right now.";
    const n = Number(tx.select({ n: sql<number>`count(*)` }).from(teamMembers).where(eq(teamMembers.teamId, teamId)).get()?.n ?? 0);
    if (tx.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).get()) return null; // already in
    if (n >= MAX_TEAM_SIZE) return "This team is full.";
    const mine = Number(tx.select({ n: sql<number>`count(*)` }).from(teamMembers).innerJoin(teams, eq(teams.id, teamMembers.teamId)).where(and(eq(teamMembers.userId, userId), isNull(teams.archivedAt))).get()?.n ?? 0);
    if (mine >= MAX_MY_TEAMS) return `You are in ${MAX_MY_TEAMS} teams already. Leave one first.`;
    tx.insert(teamMembers).values({ teamId, userId }).onConflictDoNothing().run();
    return null;
  });
}

export type Member = { userId: number; name: string; owner: boolean; joinedAt: number; weekXp: number; levels: number };

/** Everyone in a team with what they did in the last seven days (quests and finished exams) and the levels they have passed in all. Best week first. */
export function membersOf(team: Team, since = Math.floor(Date.now() / 1000) - 7 * 86400): Member[] {
  const rows = db.select({ id: users.id, name: users.name, joinedAt: teamMembers.joinedAt }).from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId)).where(and(eq(teamMembers.teamId, team.id), eq(users.status, "active"))).all();
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id), sinceDay = new Date(since * 1000).toISOString().slice(0, 10);
  const quest = new Map(db.select({ u: dailyQuests.userId, v: sql<number>`coalesce(sum(${dailyQuests.xp}), 0)` }).from(dailyQuests)
    .where(and(inArray(dailyQuests.userId, ids), sql`${dailyQuests.day} >= ${sinceDay}`)).groupBy(dailyQuests.userId).all().map((r) => [r.u, Number(r.v)]));
  const exam = new Map(db.select({ u: runs.userId, v: sql<number>`coalesce(sum(round(${runs.score} * 100) + case when ${runs.passed} then 50 else 0 end), 0)` }).from(runs)
    .where(and(inArray(runs.userId, ids), gt(runs.finishedAt, since))).groupBy(runs.userId).all().map((r) => [r.u, Number(r.v)]));
  const levels = new Map(db.select({ u: runs.userId, n: sql<number>`count(distinct ${runs.trackId} * 100 + ${runs.level})` }).from(runs)
    .where(and(inArray(runs.userId, ids), eq(runs.passed, true))).groupBy(runs.userId).all().map((r) => [r.u, Number(r.n)]));
  return rows.map((r): Member => ({ userId: r.id, name: r.name, owner: r.id === team.ownerId, joinedAt: r.joinedAt, weekXp: (quest.get(r.id) ?? 0) + (exam.get(r.id) ?? 0), levels: levels.get(r.id) ?? 0 }))
    .sort((a, b) => b.weekXp - a.weekXp || b.levels - a.levels || a.name.localeCompare(b.name));
}

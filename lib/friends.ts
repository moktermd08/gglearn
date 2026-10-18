import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { cheers, certificates, dailyQuests, db, friendships, runs, tracks, userBadges, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { pickableTopics } from "@/lib/pickTopics";
import { shortName } from "@/lib/seasons";
import { certTitle } from "@/lib/levels";
import { topicLabel } from "@/lib/topicName";
import { BADGES, factsOf, streakOf } from "@/lib/progression";

/**
 * Friends. A friendship is mutual and agreed, never a public follow: either a request the other person accepts, or a friend link that both people used (the
 * person who shared it asked, the person who opened it agreed). Friends see each other's first name and initial, this week's XP, their streak, and a feed
 * of real things they did (a level passed, a badge, a certificate). The feed is worked out from the same records everything else uses, so it cannot
 * show anything that did not happen, and a topic's name is shown only if the person looking could see that topic anyway.
 * A friend can cheer one thing another friend did, once. Either side can end a friendship at any time, with no notice to the other.
 */
export const MAX_FRIENDS = 200, MAX_PENDING_OUT = 15, FEED_DAYS = 14;
type Row = typeof friendships.$inferSelect;
export const nowSec = () => Math.floor(Date.now() / 1000);

const between = (a: number, b: number) => or(and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)), and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)));
export const relation = (a: number, b: number): Row | undefined => db.select().from(friendships).where(between(a, b)).get();
export const areFriends = (a: number, b: number) => a !== b && relation(a, b)?.status === "accepted";

export function friendIds(userId: number): number[] {
  return db.select().from(friendships).where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)))).all()
    .map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export type Result = { ok: true; message?: string } | { error: string };
const active = (id: number) => db.select({ s: users.status }).from(users).where(eq(users.id, id)).get()?.s === "active";

/**
 * Asks someone to be friends, by email. The answer never says whether the address has an account: a stranger cannot use this to find out who is
 * registered. If they have already asked you, you are simply friends now.
 */
export function requestByEmail(me: number, email: string): Result {
  const msg = "If that address has an account, they have been asked. You will be told if they say yes.";
  if (db.select().from(friendships).where(and(eq(friendships.requesterId, me), eq(friendships.status, "pending"))).all().length >= MAX_PENDING_OUT) return { error: `You have ${MAX_PENDING_OUT} requests waiting already. Wait for some to be answered.` };
  const other = db.select({ id: users.id }).from(users).where(and(eq(users.email, email.trim().toLowerCase()), eq(users.status, "active"))).get();
  if (!other || other.id === me) return { ok: true, message: msg };
  const have = relation(me, other.id);
  if (have?.status === "accepted") return { ok: true, message: msg };
  if (have) { // they asked first (or this is a repeat): either way the two of them agree
    if (have.requesterId === other.id) { accept(have); return { ok: true, message: msg }; }
    return { ok: true, message: msg };
  }
  if (friendIds(me).length >= MAX_FRIENDS || friendIds(other.id).length >= MAX_FRIENDS) return { ok: true, message: msg };
  db.insert(friendships).values({ requesterId: me, addresseeId: other.id }).onConflictDoNothing().run();
  const name = db.select({ n: users.name }).from(users).where(eq(users.id, me)).get()?.n ?? "Someone";
  notify(other.id, { key: `friend-req-${me}`, kind: "system", title: `${shortName(name)} wants to be friends`, body: "Friends see each other's week and achievements, and can cheer them on.", href: "/friends" });
  return { ok: true, message: msg };
}

/** Both people used a friend link, so there is nothing to wait for: they are friends now. */
export function befriendByLink(owner: number, me: number): Result {
  if (owner === me) return { error: "That is your own friend link. Send it to a friend." };
  if (!active(owner)) return { error: "This friend link is not valid any more." };
  const have = relation(me, owner);
  if (have?.status === "accepted") return { ok: true, message: "You are already friends." };
  if (friendIds(me).length >= MAX_FRIENDS || friendIds(owner).length >= MAX_FRIENDS) return { error: "One of you has reached the limit of friends." };
  if (have) accept(have);
  else db.insert(friendships).values({ requesterId: owner, addresseeId: me, status: "accepted", respondedAt: nowSec() }).onConflictDoNothing().run();
  const name = db.select({ n: users.name }).from(users).where(eq(users.id, me)).get()?.n ?? "Someone";
  notify(owner, { key: `friend-yes-${me}`, kind: "system", title: `${shortName(name)} is now your friend`, body: "They used your friend link.", href: "/friends" });
  return { ok: true };
}

function accept(r: Row) { db.update(friendships).set({ status: "accepted", respondedAt: nowSec() }).where(eq(friendships.id, r.id)).run(); }

/** Answers a request that was sent to me. */
export function respond(me: number, requestId: number, yes: boolean): Result {
  const r = db.select().from(friendships).where(eq(friendships.id, requestId)).get();
  if (!r || r.addresseeId !== me || r.status !== "pending") return { error: "That request is not waiting for you." };
  if (!yes) { db.delete(friendships).where(eq(friendships.id, r.id)).run(); return { ok: true }; } // declined: it just goes, so the asker is not told
  if (friendIds(me).length >= MAX_FRIENDS) return { error: "You have reached the limit of friends." };
  accept(r);
  const name = db.select({ n: users.name }).from(users).where(eq(users.id, me)).get()?.n ?? "Someone";
  notify(r.requesterId, { key: `friend-yes-${me}`, kind: "system", title: `${shortName(name)} accepted your request`, body: "You can now see each other's week and cheer each other on.", href: "/friends" });
  return { ok: true };
}

/** Ends a friendship, or withdraws a request. Neither side is told. */
export function remove(me: number, otherId: number) {
  const r = relation(me, otherId);
  if (r) db.delete(friendships).where(eq(friendships.id, r.id)).run();
}

export function requestsFor(me: number): { id: number; userId: number; name: string }[] {
  return db.select({ id: friendships.id, userId: friendships.requesterId, name: users.name }).from(friendships).innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, me), eq(friendships.status, "pending"), eq(users.status, "active"))).orderBy(desc(friendships.id)).all().map((r) => ({ ...r, name: shortName(r.name) }));
}

// ---- the week ----

export type FriendRow = { userId: number; name: string; me: boolean; weekXp: number; streak: number };

/** Me and my friends, best week first: XP from quests and finished exams in the last seven days, and the current streak. */
export function weekBoard(me: number, at = nowSec()): FriendRow[] {
  const ids = [me, ...friendIds(me)];
  const people = db.select({ id: users.id, name: users.name }).from(users).where(and(inArray(users.id, ids), eq(users.status, "active"))).all();
  const stats = weekStats(people.map((p) => p.id), at);
  return people.map((p) => ({ userId: p.id, name: p.id === me ? "You" : shortName(p.name), me: p.id === me, weekXp: stats.get(p.id)?.weekXp ?? 0, streak: stats.get(p.id)?.streak ?? 0 }))
    .sort((a, b) => b.weekXp - a.weekXp || b.streak - a.streak || a.name.localeCompare(b.name));
}

/** XP from quests and finished exams in the last seven days, and the current streak, for these people. */
export function weekStats(ids: number[], at = nowSec()): Map<number, { weekXp: number; streak: number }> {
  const out = new Map<number, { weekXp: number; streak: number }>();
  if (!ids.length) return out;
  const since = at - 7 * 86400, sinceDay = new Date(since * 1000).toISOString().slice(0, 10);
  const quest = new Map(db.select({ u: dailyQuests.userId, v: sql<number>`coalesce(sum(${dailyQuests.xp}), 0)` }).from(dailyQuests).where(and(inArray(dailyQuests.userId, ids), sql`${dailyQuests.day} >= ${sinceDay}`)).groupBy(dailyQuests.userId).all().map((r) => [r.u, Number(r.v)]));
  const exam = new Map(db.select({ u: runs.userId, v: sql<number>`coalesce(sum(round(${runs.score} * 100) + case when ${runs.passed} then 50 else 0 end), 0)` }).from(runs).where(and(inArray(runs.userId, ids), gte(runs.finishedAt, since), lt(runs.finishedAt, at + 1))).groupBy(runs.userId).all().map((r) => [r.u, Number(r.v)]));
  const today = new Date(at * 1000).toISOString().slice(0, 10);
  for (const id of ids) out.set(id, { weekXp: (quest.get(id) ?? 0) + (exam.get(id) ?? 0), streak: streakOf(factsOf(id).days, today).current });
  return out;
}

// ---- the feed ----

export type FeedItem = { key: string; userId: number; name: string; at: number; text: string; cheers: number; cheered: boolean };

/**
 * What my friends did lately, newest first. Each item is a real record: a level passed for the first time, a badge earned, a certificate issued.
 * A topic is named only if I could see that topic myself; otherwise it says "a topic". `key` identifies the event, for cheering it.
 */
export function feedFor(me: number, at = nowSec(), limit = 30): FeedItem[] {
  const friends = friendIds(me);
  if (!friends.length) return [];
  const since = at - FEED_DAYS * 86400;
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).where(and(inArray(users.id, friends), eq(users.status, "active"))).all().map((u) => [u.id, shortName(u.name)]));
  const mine = new Set(pickableTopics({ id: me, ...(db.select({ role: users.role, audience: users.audience }).from(users).where(eq(users.id, me)).get() ?? { role: "learner" as const, audience: "staff" as const }) }).map((t) => t.id));
  const topicName = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).all().map((t) => [t.id, t.name]));
  const label = (trackId: number) => (mine.has(trackId) ? topicLabel(topicName.get(trackId) ?? "a topic") : "a topic");
  const items: Omit<FeedItem, "cheers" | "cheered">[] = [];

  // a level passed for the first time: the earliest passing run of each person, topic and level
  const passes = db.select({ id: runs.id, u: runs.userId, t: runs.trackId, l: runs.level, at: runs.finishedAt }).from(runs).where(and(inArray(runs.userId, friends), eq(runs.passed, true))).orderBy(runs.finishedAt).all();
  const first = new Map<string, (typeof passes)[number]>();
  for (const p of passes) { const k = `${p.u}:${p.t}:${p.l}`; if (!first.has(k)) first.set(k, p); }
  for (const p of first.values()) if ((p.at ?? 0) >= since && names.has(p.u)) items.push({ key: `pass:${p.id}`, userId: p.u, name: names.get(p.u)!, at: p.at ?? 0, text: `passed level ${p.l} in ${label(p.t)}` });

  const nameOf = new Map(BADGES.map((b) => [b.key, b.name]));
  for (const b of db.select().from(userBadges).where(and(inArray(userBadges.userId, friends), gte(userBadges.earnedAt, since))).all())
    if (names.has(b.userId) && nameOf.has(b.key)) items.push({ key: `badge:${b.userId}:${b.key}`, userId: b.userId, name: names.get(b.userId)!, at: b.earnedAt, text: `earned the ${nameOf.get(b.key)} badge` });

  for (const c of db.select().from(certificates).where(and(inArray(certificates.userId, friends), gte(certificates.issuedAt, since))).all())
    if (names.has(c.userId) && !c.revokedAt) items.push({ key: `cert:${c.code}`, userId: c.userId, name: names.get(c.userId)!, at: c.issuedAt, text: `earned a ${certTitle(c.level)} certificate in ${label(c.trackId)}` });

  const top = items.sort((a, b) => b.at - a.at).slice(0, limit);
  if (!top.length) return [];
  const counts = new Map(db.select({ k: cheers.eventKey, n: sql<number>`count(*)` }).from(cheers).where(inArray(cheers.eventKey, top.map((i) => i.key))).groupBy(cheers.eventKey).all().map((r) => [r.k, Number(r.n)]));
  const mineCheered = new Set(db.select({ k: cheers.eventKey }).from(cheers).where(and(eq(cheers.fromId, me), inArray(cheers.eventKey, top.map((i) => i.key)))).all().map((r) => r.k));
  return top.map((i) => ({ ...i, cheers: counts.get(i.key) ?? 0, cheered: mineCheered.has(i.key) }));
}

/** Cheers one thing a friend did. It must be in my feed (so a real event of a real friend), and each person cheers each event once. */
export function cheer(me: number, eventKey: string): Result {
  if (typeof eventKey !== "string" || eventKey.length > 80) return { error: "That is not something you can cheer." };
  const item = feedFor(me, nowSec(), 200).find((i) => i.key === eventKey);
  if (!item || !areFriends(me, item.userId)) return { error: "That is not something you can cheer." };
  const added = db.insert(cheers).values({ fromId: me, toId: item.userId, eventKey }).onConflictDoNothing().run();
  if (added.changes) {
    const name = db.select({ n: users.name }).from(users).where(eq(users.id, me)).get()?.n ?? "A friend";
    notify(item.userId, { key: `cheer-${me}-${eventKey}`, kind: "system", title: `${shortName(name)} cheered you`, body: `For: ${item.text.replace(/ in a topic$/, "")}.`, href: "/friends" });
  }
  return { ok: true };
}

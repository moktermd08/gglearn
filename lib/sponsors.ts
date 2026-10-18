import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { certificates, db, runs, sponsorships, tracks, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { pickableTopics } from "@/lib/pickTopics";
import { MAX_LEVEL } from "@/lib/levels";
import { shortName } from "@/lib/seasons";
import { topicLabel } from "@/lib/topicName";

/**
 * Sponsors. A sponsor backs one learner to reach one level in one topic ("I will cheer you to Python level 10"). The learner asks: the link they share
 * names the topic and level and is signed, so nobody can make one up for someone else, and pressing the button on it is the sponsor's yes. The learner can
 * end it, and so can the sponsor, at any time and silently. A sponsor sees progress on that single goal and nothing else: the learner's first name, the
 * topic, the target level, the best level passed so far, and (once it is reached) the certificate for it if there is one, which anyone can verify. Never
 * their email, other topics, XP, streak or anything else. Reaching the goal is recognised when the pass is awarded (lib/rewards.ts), so a pass that is held
 * for an integrity review does not count until it is cleared; both sides are told. Sponsoring does not move money: it is a promise and a spotlight.
 */
export const MAX_SPONSORS_PER_GOAL = 5, MAX_SPONSORED = 25, MAX_OPEN_GOALS = 5;
const nowSec = () => Math.floor(Date.now() / 1000);
export type Result = { ok: true; message?: string } | { error: string };

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (learner: number, track: number, level: number) => createHmac("sha256", secret()).update(`sponsor:${learner}:${track}:${level}`).digest("base64url").slice(0, 12);

/** The link code for one goal: learner (base 36), topic, level and a signature. */
export const sponsorCode = (learner: number, track: number, level: number) => `${learner.toString(36)}.${track}.${level}.${sign(learner, track, level)}`;

export function parseSponsorCode(code: string | null | undefined): { learner: number; track: number; level: number } | null {
  const m = /^([0-9a-z]{1,8})\.(\d{1,9})\.(\d{1,2})\.([A-Za-z0-9_-]{12})$/.exec(code ?? "");
  if (!m) return null;
  const learner = parseInt(m[1], 36), track = Number(m[2]), level = Number(m[3]);
  const want = Buffer.from(sign(learner, track, level)), got = Buffer.from(m[4]);
  return want.length === got.length && timingSafeEqual(want, got) ? { learner, track, level } : null;
}

const active = (id: number) => db.select({ s: users.status }).from(users).where(eq(users.id, id)).get()?.s === "active";
/** The best level a person has passed in a topic. */
export const passedIn = (userId: number, trackId: number): number =>
  Number(db.select({ m: sql<number>`max(${runs.level})` }).from(runs).where(and(eq(runs.userId, userId), eq(runs.trackId, trackId), eq(runs.passed, true))).get()?.m ?? 0);

/** What a learner may ask a sponsor to back: a topic they could pick themselves, and a level above where they already are. */
export function goalOptions(me: { id: number; role: "admin" | "manager" | "learner"; audience: "staff" | "customer" }): { id: number; name: string }[] {
  return pickableTopics(me).map((t) => ({ id: t.id, name: topicLabel(t.name) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Checks a goal a learner wants to share; returns the link code, or why not. */
export function askForSponsor(me: { id: number; role: "admin" | "manager" | "learner"; audience: "staff" | "customer" }, trackId: number, level: number): { code: string } | { error: string } {
  if (!pickableTopics(me).some((t) => t.id === trackId)) return { error: "Pick a topic from the list." };
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return { error: `Choose a level from 1 to ${MAX_LEVEL}.` };
  if (passedIn(me.id, trackId) >= level) return { error: "You have already passed that level. Choose a higher one." };
  const open = db.select({ t: sponsorships.trackId, l: sponsorships.level }).from(sponsorships).where(and(eq(sponsorships.learnerId, me.id), isNull(sponsorships.endedAt), isNull(sponsorships.reachedAt))).all();
  if (new Set(open.map((o) => `${o.t}:${o.l}`)).size >= MAX_OPEN_GOALS && !open.some((o) => o.t === trackId && o.l === level)) return { error: `You have ${MAX_OPEN_GOALS} sponsored goals going. Finish or end one first.` };
  return { code: sponsorCode(me.id, trackId, level) };
}

/** The sponsor presses the button on a learner's link. */
export function acceptSponsorship(sponsorId: number, code: string): Result {
  const g = parseSponsorCode(code);
  if (!g || !active(g.learner)) return { error: "This sponsor link is not valid any more." };
  if (g.learner === sponsorId) return { error: "That is your own goal. Send the link to someone who would back you." };
  const t = db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, g.track)).get();
  if (!t || g.level < 1 || g.level > MAX_LEVEL) return { error: "This sponsor link is not valid any more." };
  if (passedIn(g.learner, g.track) >= g.level) return { error: "They have already reached this goal." };
  const have = db.select().from(sponsorships).where(and(eq(sponsorships.sponsorId, sponsorId), eq(sponsorships.learnerId, g.learner), eq(sponsorships.trackId, g.track), eq(sponsorships.level, g.level))).get();
  if (have && !have.endedAt) return { ok: true, message: "You already back this goal." };
  const live = (extra: ReturnType<typeof eq>) => Number(db.select({ n: sql<number>`count(*)` }).from(sponsorships).where(and(extra, isNull(sponsorships.endedAt))).get()?.n ?? 0);
  if (live(and(eq(sponsorships.learnerId, g.learner), eq(sponsorships.trackId, g.track), eq(sponsorships.level, g.level))!) >= MAX_SPONSORS_PER_GOAL) return { error: `This goal already has ${MAX_SPONSORS_PER_GOAL} sponsors.` };
  if (live(eq(sponsorships.sponsorId, sponsorId)) >= MAX_SPONSORED) return { error: `You already back ${MAX_SPONSORED} goals.` };
  if (have) db.update(sponsorships).set({ endedAt: null, createdAt: nowSec() }).where(eq(sponsorships.id, have.id)).run();
  else db.insert(sponsorships).values({ sponsorId, learnerId: g.learner, trackId: g.track, level: g.level }).run();
  const name = db.select({ n: users.name }).from(users).where(eq(users.id, sponsorId)).get()?.n ?? "Someone";
  notify(g.learner, { key: `sponsor-yes-${sponsorId}-${g.track}-${g.level}`, kind: "system", title: `${shortName(name)} is backing you`, body: `${topicLabel(t.n)}, level ${g.level}. They see only your progress on this goal.`, href: "/sponsoring" });
  return { ok: true };
}

/** Either side ends it; neither is told. */
export function endSponsorship(me: number, id: number) {
  const s = db.select().from(sponsorships).where(eq(sponsorships.id, id)).get();
  if (!s || (s.sponsorId !== me && s.learnerId !== me)) return;
  db.update(sponsorships).set({ endedAt: nowSec() }).where(and(eq(sponsorships.id, id), isNull(sponsorships.endedAt))).run();
}

/** A pass was awarded: any open goal of this learner that is now reached is closed with a thank-you to both sides. Safe to call again. */
export function settleSponsorships(learnerId: number, at = nowSec()) {
  const open = db.select({ s: sponsorships, n: tracks.name }).from(sponsorships).innerJoin(tracks, eq(tracks.id, sponsorships.trackId))
    .where(and(eq(sponsorships.learnerId, learnerId), isNull(sponsorships.endedAt), isNull(sponsorships.reachedAt))).all();
  const learner = db.select({ n: users.name }).from(users).where(eq(users.id, learnerId)).get()?.n ?? "Your learner";
  for (const { s, n } of open) {
    if (passedIn(learnerId, s.trackId) < s.level) continue;
    if (!db.update(sponsorships).set({ reachedAt: at }).where(and(eq(sponsorships.id, s.id), isNull(sponsorships.reachedAt))).run().changes) continue;
    notify(s.sponsorId, { key: `sponsor-done-${s.id}`, kind: "system", title: `${shortName(learner)} reached the goal you backed`, body: `${topicLabel(n)}, level ${s.level}.`, href: "/sponsoring" });
    notify(learnerId, { key: `sponsor-done-me-${s.id}`, kind: "system", title: "You reached a goal someone backed", body: `${topicLabel(n)}, level ${s.level}. Thank them.`, href: "/sponsoring" });
  }
}

export type SponsorView = { id: number; topic: string; level: number; passed: number; since: number; reachedAt: number | null; certificate: string | null; person: string };
const view = (r: { s: typeof sponsorships.$inferSelect; n: string; who: string }, learner: number): SponsorView => {
  const cert = r.s.reachedAt ? db.select({ c: certificates.code }).from(certificates).where(and(eq(certificates.userId, learner), eq(certificates.trackId, r.s.trackId), eq(certificates.level, r.s.level), isNull(certificates.revokedAt))).get()?.c ?? null : null;
  return { id: r.s.id, topic: topicLabel(r.n), level: r.s.level, passed: Math.min(r.s.level, passedIn(learner, r.s.trackId)), since: r.s.createdAt, reachedAt: r.s.reachedAt, certificate: cert, person: shortName(r.who) };
};

/** What a sponsor sees: one line per goal they back, naming the learner by first name and initial. */
export function backedBy(sponsorId: number): SponsorView[] {
  return db.select({ s: sponsorships, n: tracks.name, who: users.name }).from(sponsorships).innerJoin(tracks, eq(tracks.id, sponsorships.trackId)).innerJoin(users, eq(users.id, sponsorships.learnerId))
    .where(and(eq(sponsorships.sponsorId, sponsorId), isNull(sponsorships.endedAt), eq(users.status, "active"))).orderBy(desc(sponsorships.createdAt)).all().map((r) => view(r, r.s.learnerId));
}

/** What a learner sees: who backs which of their goals. */
export function backers(learnerId: number): SponsorView[] {
  return db.select({ s: sponsorships, n: tracks.name, who: users.name }).from(sponsorships).innerJoin(tracks, eq(tracks.id, sponsorships.trackId)).innerJoin(users, eq(users.id, sponsorships.sponsorId))
    .where(and(eq(sponsorships.learnerId, learnerId), isNull(sponsorships.endedAt), eq(users.status, "active"))).orderBy(desc(sponsorships.createdAt)).all().map((r) => view(r, learnerId));
}

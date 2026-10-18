import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { brands, competitionMembers, competitions, db, tracks, users } from "@/lib/db";
import { baselineLevel, now, stateOf } from "@/lib/competitions";
import { claimPendingInvites, enrol } from "@/lib/contests";
import { MAX_LEVEL } from "@/lib/levels";
import { openTo } from "@/lib/paths";

/**
 * The invite link of a contest: how a friend with no account gets in. The organiser turns it on; anyone who opens it can join the
 * race (and create an account on the spot if they have none) until the contest is over or full.
 *
 * The key is signed, not stored: HMAC(secret, slug + version). `competitions.guestLinkVersion` is the version (null = link off), so
 * switching it off or making a new link kills the old one without keeping a secret in the database.
 *
 * What a guest account is: no company, no manager access, no onboarding checklist, nothing required. Staff or customer is decided
 * by the topic, so a guest never sees more than the topic they were invited to race on needs, and a link is only offered for topics
 * that are safe to show an outsider (see guestAudience).
 */
type Contest = typeof competitions.$inferSelect;
type Tx = Pick<typeof db, "insert" | "select" | "update" | "delete">;

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
export const guestKey = (slug: string, version: number) => createHmac("sha256", secret()).update(`guest:${slug}:${version}`).digest("base64url").slice(0, 32);
export const guestPath = (c: { slug: string; guestLinkVersion: number | null }) => (c.guestLinkVersion == null ? null : `/competitions/${c.slug}/join/${guestKey(c.slug, c.guestLinkVersion)}`);

function keyMatches(c: Contest, key: string): boolean {
  if (c.guestLinkVersion == null || !/^[A-Za-z0-9_-]{32}$/.test(key)) return false;
  const want = Buffer.from(guestKey(c.slug, c.guestLinkVersion)), got = Buffer.from(key);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * Who a guest of this topic would be, or null when the topic is not for outsiders. Company topics (staff material that belongs to one
 * company) are never offered to someone with no account; shared academy topics become staff accounts, customer-facing ones customers.
 */
export function guestAudience(trackId: number): "staff" | "customer" | null {
  const t = db.select({ audience: tracks.audience, brandKind: brands.kind }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(eq(tracks.id, trackId)).get();
  if (!t) return null;
  if (t.audience === "customer" || t.audience === "both") return "customer";
  return t.brandKind === "shared" ? "staff" : null;
}

export const placesLeft = (c: Contest, tx: Tx = db) =>
  Math.max(0, c.maxHumans - (tx.select({ n: sql<number>`count(*)` }).from(competitionMembers)
    .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).get()?.n ?? 0));

export type Entry = { c: Contest; track: typeof tracks.$inferSelect; audience: "staff" | "customer"; left: number };
export type EntryError = "invalid" | "over" | "full";

/** What a link opens, or why it does not. "invalid" covers every way a link can be wrong, so a guess learns nothing. */
export function entryFor(slug: string, key: string): Entry | { error: EntryError } {
  const c = db.select().from(competitions).where(eq(competitions.slug, slug)).get();
  if (!c || !keyMatches(c, key)) return { error: "invalid" };
  const track = db.select().from(tracks).where(eq(tracks.id, c.trackId)).get();
  const audience = track ? guestAudience(track.id) : null;
  if (!track || !audience) return { error: "invalid" };
  if (["finished", "canceled"].includes(stateOf(c))) return { error: "over" };
  const left = placesLeft(c);
  return left > 0 ? { c, track, audience, left } : { error: "full" };
}

/** Puts a person in the race as a joined member and on its topic. Refuses what joining by invitation refuses. Returns an error message or null. */
export function admitMember(tx: Tx, c: Contest, user: { id: number; audience: "staff" | "customer" }): string | null {
  if (["finished", "canceled"].includes(stateOf(c))) return "This race is over.";
  const track = tx.select({ a: tracks.audience }).from(tracks).where(eq(tracks.id, c.trackId)).get();
  if (!track || !openTo(user.audience, track.a)) return "This topic is not open to your account.";
  const mine = tx.select().from(competitionMembers).where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, user.id))).get();
  if (mine?.status === "joined") return null;
  if (placesLeft(c, tx) < 1) return "This race is full.";
  if (baselineLevel(user.id, c.trackId, Math.max(now(), c.startsAt)) >= MAX_LEVEL) return "You have already reached Titan in this topic.";
  tx.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: user.id, status: "joined", joinedAt: now(), invitedBy: c.createdBy })
    .onConflictDoUpdate({ target: [competitionMembers.competitionId, competitionMembers.userId], set: { status: "joined", joinedAt: now() } }).run();
  enrol(tx, user.id, c.trackId, c.title);
  return null;
}

/**
 * Creates a guest account and puts it in the race, in one step so a failed join leaves no account behind. An email that already has an
 * account gets the same answer as any other failure: the form must not tell strangers who is registered.
 */
export function admitNewGuest(entry: Entry, who: { name: string; email: string; passwordHash: string }): { userId: number } | { error: string } {
  try {
    return db.transaction((tx) => {
      const email = who.email.toLowerCase();
      if (tx.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) throw new Error("taken");
      const u = tx.insert(users).values({ name: who.name, email, jobRole: "general", audience: entry.audience, guest: "yes", passwordHash: who.passwordHash, referredBy: entry.c.createdBy }).returning().get();
      claimPendingInvites(tx, u.id, u.email); // other contests this address was invited to
      const no = admitMember(tx, entry.c, { id: u.id, audience: entry.audience });
      if (no) throw new Error(no);
      return { userId: u.id };
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { error: m === "This race is full." || m === "This race is over." ? m : "We could not create an account with those details. If you already have an account, sign in first and open the link again." };
  }
}

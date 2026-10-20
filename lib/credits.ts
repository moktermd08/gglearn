import { and, desc, eq, inArray, max } from "drizzle-orm";
import { db, enrollments, levelCredits, runs, tracks, users } from "@/lib/db";
import { MAX_LEVEL } from "@/lib/levels";
import { notify } from "@/lib/notifications";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { creditInForce, levelsPassed } from "@/lib/progress";
import { loadRoles } from "@/lib/lifecycle/roles";
import { reachOf, userInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

/**
 * Starting levels. A person can begin a track above level 0 without passing its exams, three ways:
 *  - an assessment (the placement check, lib/placement.ts, stored on the enrolment),
 *  - what their job role normally holds (a suggestion that they, or their manager, confirm),
 *  - a manager or admin who runs them, with a reason on record.
 * A starting level lifts where they start and unlocks what comes next. It is never an exam pass: certificates still need the exam. Only
 * an admin can mark one "counts as complete", which lets it satisfy required training. Nothing is deleted; a revoked one stays as the record.
 */
export const MANAGER_CAP = 10; // a manager can give up to here; more takes an admin
export const ROLE_START_CAP = 10; // what a job role is ever assumed to hold
export const EXPIRY_DAYS = [30, 90, 180, 365] as const;

type Me = { id: number; role: "admin" | "manager" | "learner" };
type Target = { id: number; status: string };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const now = () => Math.floor(Date.now() / 1000);

/** May this person give that person a starting level of this size? Same rules as everywhere: in reach, never yourself, and managers have a ceiling. */
export function mayGrant(me: Me, target: Target, level: number, countsAsComplete: boolean): string | null {
  if (me.role !== "admin" && me.role !== "manager") return "Only managers and admins can give a starting level.";
  if (target.status !== "active") return "That person is not active.";
  if (target.id === me.id) return "Nobody gives themselves a starting level.";
  if (!userInReach(reachOf(me.id), target.id)) return "You do not run that person.";
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return `Choose a level from 1 to ${MAX_LEVEL}.`;
  if (me.role !== "admin" && level > MANAGER_CAP) return `A manager can give up to level ${MANAGER_CAP}. Ask an admin for more.`;
  if (me.role !== "admin" && countsAsComplete) return "Only an admin can mark a starting level as complete.";
  return null;
}

export type CreditView = {
  id: number; level: number; source: "manager" | "admin" | "role"; byId: number; by: string; reason: string; at: number; expiresAt: number | null; countsAsComplete: boolean;
};
export type Detail = {
  /** highest exam pass */ earned: number;
  /** from the placement check */ placed: number;
  /** the highest starting level in force, if any */ credit: CreditView | null;
  /** what the map shows: the highest of the three */ shown: number;
};

/** For each track: where a person's level comes from. One read for everything they have, so the map costs a few queries. */
export function detailsFor(userId: number): Map<number, Detail> {
  const out = new Map<number, Detail>();
  const at = (t: number) => { let d = out.get(t); if (!d) out.set(t, (d = { earned: 0, placed: 0, credit: null, shown: 0 })); return d; };
  for (const r of db.select({ t: runs.trackId, m: max(runs.level) }).from(runs).where(and(eq(runs.userId, userId), eq(runs.passed, true))).groupBy(runs.trackId).all()) at(r.t).earned = Math.min(r.m ?? 0, MAX_LEVEL);
  for (const e of db.select({ t: enrollments.trackId, p: enrollments.placedLevel }).from(enrollments).where(eq(enrollments.userId, userId)).all()) if (e.p > 0) at(e.t).placed = e.p;
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  for (const c of db.select().from(levelCredits).where(and(eq(levelCredits.userId, userId), creditInForce())).orderBy(desc(levelCredits.level), desc(levelCredits.id)).all()) {
    const d = at(c.trackId);
    if (!d.credit) d.credit = { id: c.id, level: c.level, source: c.source, byId: c.grantedBy, by: names.get(c.grantedBy) ?? "Someone", reason: c.reason, at: c.createdAt, expiresAt: c.expiresAt, countsAsComplete: c.countsAsComplete };
  }
  for (const d of out.values()) d.shown = Math.min(MAX_LEVEL, Math.max(d.earned, d.placed, d.credit?.level ?? 0));
  return out;
}

/** What a person's job role normally holds, as starting levels they do not have yet. A suggestion only: nothing is set until they or their manager confirm. */
export type RoleStart = { trackId: number; slug: string; name: string; level: number };
export function suggestedStarts(userId: number): { role: string; starts: RoleStart[] } | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u || u.audience !== "staff") return null;
  const role = loadRoles().find((r) => r.key === u.jobRole.toLowerCase());
  if (!role?.entry) return null;
  const scopes = scopesOf(u.id), have = detailsFor(u.id);
  const starts: RoleStart[] = [];
  for (const t of catalog()) {
    const asks = role.entry[t.slug];
    if (!asks || !inScope(t, u.audience, scopes)) continue;
    const level = Math.min(asks, ROLE_START_CAP, t.reach); // never more than the role asks, the cap, or what the track can be taken to
    if (level >= 1 && level > (have.get(t.id)?.shown ?? 0)) starts.push({ trackId: t.id, slug: t.slug, name: t.name.replace(/^\d+\.\s*/, ""), level });
  }
  return { role: role.name, starts: starts.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)) };
}

const nameOf = (id: number) => db.select({ n: users.name }).from(users).where(eq(users.id, id)).get()?.n ?? "Someone";

/** Gives a person a starting level in one track, with the reason on record, and tells them. */
export function grantCredit(me: Me, fd: FormData): SetupState {
  const userId = Number(fd.get("userId")), trackId = Number(fd.get("trackId")), level = Number(fd.get("level"));
  const reason = str(fd.get("reason")).slice(0, 500), counts = fd.get("counts") === "on", days = Number(fd.get("days")) || 0;
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return { error: "Pick a person." };
  const no = mayGrant(me, u, level, counts);
  if (no) return { error: no };
  const t = catalog().find((x) => x.id === trackId);
  if (!t || !inScope(t, u.audience, scopesOf(u.id))) return { error: "Pick a track that person can take." };
  if (level > t.reach) return { error: `That track can only be taken to level ${t.reach}.` };
  if (reason.length < 3) return { error: "Give the reason: it is kept on record and the person sees it." };
  if (days && !(EXPIRY_DAYS as readonly number[]).includes(days)) return { error: "Choose how long it lasts, or leave it without an end." };
  const have = levelsPassed(u.id, t.id);
  if (level <= have) return { error: `${u.name} is already at level ${have} in ${t.name.replace(/^\d+\.\s*/, "")}.` };
  const row = db.insert(levelCredits).values({
    userId: u.id, trackId: t.id, level, source: me.role === "admin" ? "admin" : "manager", grantedBy: me.id, reason, countsAsComplete: counts, expiresAt: days ? now() + days * 86400 : null,
  }).returning().get();
  const trackName = t.name.replace(/^\d+\.\s*/, "");
  notify(u.id, { key: `credit:${row.id}`, kind: "system", title: `${nameOf(me.id)} set your starting point in ${trackName}`, body: `You start at level ${level}. Reason: ${reason}`, href: `/tracks/${t.slug}` });
  return { done: `${u.name} now starts ${trackName} at level ${level}.` };
}

/** Takes a starting level back. Their exams and placement stay; only the starting level goes, and the row stays as the record. */
export function revokeCredit(me: Me, fd: FormData): SetupState {
  const c = db.select().from(levelCredits).where(eq(levelCredits.id, Number(fd.get("creditId")))).get();
  if (!c || c.revokedAt) return { error: "That starting level is already gone." };
  const u = db.select().from(users).where(eq(users.id, c.userId)).get();
  if (!u) return { error: "That person no longer exists." };
  const no = mayGrant(me, u, c.level, false);
  if (no && !(c.level > MANAGER_CAP && me.role === "admin")) return { error: no };
  if (me.role !== "admin" && c.source === "admin") return { error: "Only an admin can take back what an admin gave." };
  if (me.role !== "admin" && c.grantedBy !== me.id && c.source === "manager") return { error: "Only the manager who gave it, or an admin, can take it back." };
  db.update(levelCredits).set({ revokedAt: now(), revokedBy: me.id }).where(eq(levelCredits.id, c.id)).run();
  const t = db.select({ name: tracks.name, slug: tracks.slug }).from(tracks).where(eq(tracks.id, c.trackId)).get();
  const name = (t?.name ?? "that track").replace(/^\d+\.\s*/, "");
  notify(u.id, { key: `credit-revoked:${c.id}`, kind: "system", title: `Your starting point in ${name} was changed`, body: `${nameOf(me.id)} took back the level ${c.level} start. Your exam results are unchanged.`, href: t ? `/tracks/${t.slug}` : "" });
  return { done: `${u.name}'s level ${c.level} start in ${name} was taken back.` };
}

/** A manager or admin confirms the starting levels a person's job role normally holds, all at once. */
export function applyRoleStarts(me: Me, userId: number): SetupState {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return { error: "Pick a person." };
  const no = mayGrant(me, u, 1, false);
  if (no) return { error: no };
  const sug = suggestedStarts(u.id);
  if (!sug?.starts.length) return { error: "Their role holds nothing they do not already have." };
  insertRoleStarts(u.id, sug, me.id);
  return { done: `${u.name} now starts ${sug.starts.length} track${sug.starts.length === 1 ? "" : "s"} where a ${sug.role} normally is.` };
}

/** A person confirms one starting level their own role normally holds. Only the level the server works out; nothing they type is used. */
export function acceptRoleStart(userId: number, slug: string): SetupState {
  const sug = suggestedStarts(userId), one = sug?.starts.find((s) => s.slug === slug);
  if (!sug || !one) return { error: "Your role does not suggest a starting level there." };
  insertRoleStarts(userId, { role: sug.role, starts: [one] }, userId);
  return { done: `You now start ${one.name} at level ${one.level}.` };
}

function insertRoleStarts(userId: number, sug: { role: string; starts: RoleStart[] }, by: number) {
  db.transaction((tx) => {
    for (const s of sug.starts) tx.insert(levelCredits).values({ userId, trackId: s.trackId, level: s.level, source: "role", grantedBy: by, reason: `Where a ${sug.role} normally is` }).run();
  });
  if (by !== userId) notify(userId, { key: `credit-role:${userId}:${Date.now()}`, kind: "system", title: `Your starting points were set from your role`, body: `${nameOf(by)} confirmed ${sug.starts.length} starting level${sug.starts.length === 1 ? "" : "s"} for a ${sug.role}.`, href: "/map" });
}

/** Every starting level a person has had, newest first, with who gave it and whether it is still in force. For the admin page. */
export function creditHistory(userId: number) {
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  const trackName = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).where(inArray(tracks.id, db.select({ t: levelCredits.trackId }).from(levelCredits).where(eq(levelCredits.userId, userId)))).all().map((t) => [t.id, t.name.replace(/^\d+\.\s*/, "")]));
  const at = now();
  return db.select().from(levelCredits).where(eq(levelCredits.userId, userId)).orderBy(desc(levelCredits.createdAt), desc(levelCredits.id)).all().map((c) => ({
    ...c, track: trackName.get(c.trackId) ?? "A track", by: names.get(c.grantedBy) ?? "Someone", revoker: c.revokedBy ? names.get(c.revokedBy) ?? "Someone" : null,
    state: c.revokedAt ? ("revoked" as const) : c.expiresAt && c.expiresAt <= at ? ("expired" as const) : ("active" as const),
  }));
}

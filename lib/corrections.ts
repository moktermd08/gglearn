import { and, eq, isNull } from "drizzle-orm";
import { certificates, db, deadlineExtensions, runVoids, runs, tracks, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { catalog, requirementsFor, scopesOf } from "@/lib/paths";
import { recordSecurityEvent } from "@/lib/securityLog";
import type { SetupState } from "@/lib/setup";
import { reachOf, userInReach } from "@/lib/tenancy";

/**
 * What a manager or admin may correct on someone they run: give them more time on one required course, and mark one exam attempt as not
 * counting (and put it back). Starting levels and certificates have their own rules (lib/credits.ts, lib/certsAdmin.ts) and are reused as they are.
 *
 * The same rules for all of it: the person must be active, in the actor's reach, and not the actor; a reason is required and kept; the person
 * is told; every change is written to the security log. Nothing is deleted: an extension is marked revoked, a voided attempt keeps what it
 * scored so it can be restored.
 */
type Me = { id: number; role: "admin" | "manager" | "learner" };
const DAY = 86400, now = () => Math.floor(Date.now() / 1000);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export const MIN_REASON = 8, MAX_REASON = 300;
export const EXTEND_DAYS = [7, 14, 30, 60, 90] as const;
export const MANAGER_EXTEND_MAX = 30; // a manager can give up to here at a time; more takes an admin
export const EXTEND_HORIZON_DAYS = 180; // however many times, the deadline is never pushed further than this from now

/** Why this person may not correct that person's record, or null when they may. */
export function whyNotCorrect(me: Me, target: { id: number; status: string } | undefined, reach = reachOf(me.id)): string | null {
  if (me.role !== "admin" && me.role !== "manager") return "Only managers and admins can correct a record.";
  if (!target) return "That person does not exist.";
  if (target.id === me.id) return "Nobody corrects their own record.";
  if (target.status !== "active") return "That person is not active.";
  if (!userInReach(reach, target.id)) return "You do not run that person.";
  return null;
}

function reasonOf(fd: FormData): { reason: string } | { error: string } {
  const reason = str(fd.get("reason"));
  if (reason.length < MIN_REASON) return { error: `Say why, in at least ${MIN_REASON} characters. It is kept on record and the person is told.` };
  if (reason.length > MAX_REASON) return { error: `Keep the reason under ${MAX_REASON} characters.` };
  return { reason };
}

const dateText = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const courseName = (name: string) => name.replace(/^\d+\.\s*/, "");

/** More time on one required course for one person. Only a course they must still pass; it is added to today or their current deadline, whichever is later. */
export function extendDeadline(me: Me, fd: FormData, ip = ""): SetupState {
  const userId = Number(fd.get("userId")), trackId = Number(fd.get("trackId")), days = Number(fd.get("days"));
  const u = Number.isInteger(userId) ? db.select().from(users).where(eq(users.id, userId)).get() : undefined;
  const no = whyNotCorrect(me, u);
  if (no) return { error: no };
  if (!(EXTEND_DAYS as readonly number[]).includes(days)) return { error: "Choose how much more time." };
  if (me.role !== "admin" && days > MANAGER_EXTEND_MAX) return { error: `A manager can give up to ${MANAGER_EXTEND_MAX} days at a time. Ask an admin for more.` };
  const r = reasonOf(fd);
  if ("error" in r) return r;
  const person = u!;
  const req = requirementsFor(person, scopesOf(person.id), catalog()).find((x) => x.track.id === trackId);
  if (!req) return { error: "That is not a required course for them." };
  if (req.done) return { error: "They have already passed it." };
  const from = Math.max(req.dueAt, now()), newDueAt = from + days * DAY;
  if (newDueAt > now() + EXTEND_HORIZON_DAYS * DAY) return { error: `That would push the deadline more than ${EXTEND_HORIZON_DAYS} days from now.` };
  db.insert(deadlineExtensions).values({ userId: person.id, trackId, newDueAt, reason: r.reason, grantedBy: me.id }).run();
  const name = courseName(req.track.name);
  notify(person.id, { key: `deadline-ext:${person.id}:${trackId}:${newDueAt}`, kind: "system", title: `More time on ${name}`, body: `Your deadline is now ${dateText(newDueAt)}. Reason: ${r.reason}`, href: `/tracks/${req.track.slug}` });
  recordSecurityEvent({ actorId: me.id, targetId: person.id, action: "deadline_extend", detail: `${name}: +${days} days to ${dateText(newDueAt)}. ${r.reason}`, ip });
  return { done: `${person.name} now has until ${dateText(newDueAt)} for ${name}.` };
}

/** The open (not restored) void on a run, if any. */
export const openVoid = (runId: number) => db.select().from(runVoids).where(and(eq(runVoids.runId, runId), isNull(runVoids.restoredAt))).get();

/** Marks one finished exam attempt as not counting. What it scored is kept; the attempt then scores 0 and does not pass, so passes, XP and deadlines follow. */
export function voidRun(me: Me, fd: FormData, ip = ""): SetupState {
  const runId = Number(fd.get("runId"));
  const run = Number.isInteger(runId) ? db.select().from(runs).where(eq(runs.id, runId)).get() : undefined;
  if (!run) return { error: "That attempt does not exist." };
  const u = db.select().from(users).where(eq(users.id, run.userId)).get();
  const no = whyNotCorrect(me, u);
  if (no) return { error: no };
  if (run.finishedAt == null) return { error: "That attempt is not finished yet." };
  if (openVoid(run.id)) return { error: "That attempt is already marked as not counting." };
  const r = reasonOf(fd);
  if ("error" in r) return r;
  db.transaction((tx) => {
    tx.insert(runVoids).values({ runId: run.id, originalScore: run.score, originalPassed: run.passed, reason: r.reason, voidedBy: me.id }).run();
    tx.update(runs).set({ score: 0, passed: false }).where(eq(runs.id, run.id)).run();
  });
  const t = db.select({ name: tracks.name, slug: tracks.slug }).from(tracks).where(eq(tracks.id, run.trackId)).get();
  const name = courseName(t?.name ?? "a course");
  notify(run.userId, { key: `run-void:${run.id}:${now()}`, kind: "system", title: "An exam attempt was marked as not counting", body: `${name}, level ${run.level}. Reason: ${r.reason}`, href: t ? `/tracks/${t.slug}` : "/profile" });
  recordSecurityEvent({ actorId: me.id, targetId: run.userId, action: "run_void", detail: `${name} level ${run.level}, was ${Math.round((run.score ?? 0) * 100)}%${run.passed ? " (passed)" : ""}. ${r.reason}`, ip });
  const stands = run.passed ? !!db.select({ id: certificates.id }).from(certificates).where(and(eq(certificates.userId, run.userId), eq(certificates.trackId, run.trackId), eq(certificates.level, run.level), isNull(certificates.revokedAt))).get() : false;
  return { done: `That attempt no longer counts.${stands ? " A certificate for this level was issued from it and still stands: revoke it separately if it should not." : ""}` };
}

/** Puts a voided attempt back exactly as it was. */
export function restoreRun(me: Me, fd: FormData, ip = ""): SetupState {
  const runId = Number(fd.get("runId"));
  const run = Number.isInteger(runId) ? db.select().from(runs).where(eq(runs.id, runId)).get() : undefined;
  const v = run ? openVoid(run.id) : undefined;
  if (!run || !v) return { error: "That attempt is not marked as not counting." };
  const u = db.select().from(users).where(eq(users.id, run.userId)).get();
  const no = whyNotCorrect(me, u);
  if (no) return { error: no };
  const r = reasonOf(fd);
  if ("error" in r) return r;
  db.transaction((tx) => {
    tx.update(runs).set({ score: v.originalScore, passed: v.originalPassed }).where(eq(runs.id, run.id)).run();
    tx.update(runVoids).set({ restoredBy: me.id, restoredAt: now() }).where(eq(runVoids.id, v.id)).run();
  });
  const name = courseName(db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, run.trackId)).get()?.n ?? "a course");
  notify(run.userId, { key: `run-restore:${run.id}:${now()}`, kind: "system", title: "An exam attempt counts again", body: `${name}, level ${run.level}. Reason: ${r.reason}`, href: "/profile" });
  recordSecurityEvent({ actorId: me.id, targetId: run.userId, action: "run_restore", detail: `${name} level ${run.level}. ${r.reason}`, ip });
  return { done: "That attempt counts again, as it was." };
}

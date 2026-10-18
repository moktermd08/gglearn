import { and, eq, isNull } from "drizzle-orm";
import { brands, certificates, db, integrityPolicies, integritySessions, roleExams, runs, tracks } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { awardForPass } from "@/lib/rewards";
import { revokeCertificate } from "@/lib/certsAdmin";
import { isGlobal, reachOf, scopeInReach, trackInReach, userInReach, usersInReach, type Reach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";
import { FIELDS, PRESETS, type Key, type Scope, type Settings, type Stored, coerce, layersAt, resolveFor } from "@/lib/integrity/policy";
import { reviewQueue, runOf } from "@/lib/integrity/session";

type Me = { id: number; role: "admin" | "manager" | "learner" };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * May this admin set the policy at this place? The whole-academy layer belongs to the platform owner (an admin who runs no particular
 * company). A company, brand or track needs to be one they run, the same rule as rewards. An academy-wide (shared) brand is the owner's.
 */
export function scopeAllowed(me: Me, scope: Scope, refId: number): boolean {
  const reach = reachOf(me.id);
  if (scope === "global") return isGlobal(reach) && refId === 0;
  if (scope === "company") return scopeInReach(reach, { kind: "company", id: refId });
  if (scope === "brand") {
    const b = db.select().from(brands).where(eq(brands.id, refId)).get();
    return !!b && (b.kind === "company" ? scopeInReach(reach, { kind: "brand", id: b.id }) : isGlobal(reach));
  }
  const t = db.select().from(tracks).where(eq(tracks.id, refId)).get();
  return !!t && trackInReach(reach, t);
}

const SCOPE_NAMES: Scope[] = ["global", "company", "brand", "track"];

/**
 * Saves what one layer sets. Each field arrives as `f_<key>`: "inherit" (or blank) to leave it to the layer above, else a value. A tick on
 * `lock_<key>` stops everything below from changing it. A key a wider layer has already locked is ignored here (and the page shows it as locked).
 * A preset fills every field it knows from a ready-made set, then the admin's own choices for the other fields still apply.
 */
export function savePolicy(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set exam integrity." };
  const scope = str(fd.get("scope")) as Scope, refId = Number(str(fd.get("refId")) || 0);
  if (!SCOPE_NAMES.includes(scope) || !Number.isInteger(refId) || refId < 0) return { error: "Pick where this applies." };
  if (!scopeAllowed(me, scope, refId)) return { error: scope === "global" ? "Only the platform owner can set the whole-academy policy." : "You can only set this for a company, brand or track you run." };

  const above = resolveFor(layersAt(scope, refId).slice(0, -1)); // what the layers above already fix
  const preset = PRESETS[str(fd.get("preset"))];
  const v: Partial<Settings> = {}, lock: Key[] = [];
  for (const f of FIELDS) {
    if (above.lockedBy[f.key]) continue; // locked above: not ours to change, and nothing here should be stored for it
    let raw: unknown = str(fd.get(`f_${f.key}`));
    if (preset && f.key in preset.values) raw = (preset.values as Record<string, unknown>)[f.key];
    if (raw !== "" && raw !== "inherit" && raw !== undefined) {
      const c = coerce(f.key, raw);
      if (c === undefined) return { error: `"${f.label}" is not a valid value.` };
      (v as Record<string, unknown>)[f.key] = c;
    }
    if (str(fd.get(`lock_${f.key}`)) === "on") lock.push(f.key); // with no value of its own here, this locks what is inherited
  }
  if (scope === "track" && lock.length) return { error: "A track is the last layer, so there is nothing below it to lock." };

  const settings: Stored = { v, lock };
  const empty = !Object.keys(v).length && !lock.length;
  const existing = db.select().from(integrityPolicies).where(and(eq(integrityPolicies.scope, scope), eq(integrityPolicies.refId, refId))).get();
  if (empty) {
    if (existing) db.delete(integrityPolicies).where(eq(integrityPolicies.id, existing.id)).run();
    return { done: "Saved: this level now inherits everything." };
  }
  db.insert(integrityPolicies).values({ scope, refId, settings: JSON.stringify(settings), updatedBy: me.id }).onConflictDoUpdate({
    target: [integrityPolicies.scope, integrityPolicies.refId],
    set: { settings: JSON.stringify(settings), updatedBy: me.id, updatedAt: nowSec() },
  }).run();
  return { done: `Saved: ${Object.keys(v).length} setting${Object.keys(v).length === 1 ? "" : "s"} set here${lock.length ? `, ${lock.length} locked for everything below` : ""}. Exams already begun keep the policy they started with.` };
}

/** Clears a layer so it inherits everything again. */
export function resetPolicy(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can set exam integrity." };
  const scope = str(fd.get("scope")) as Scope, refId = Number(str(fd.get("refId")) || 0);
  if (!SCOPE_NAMES.includes(scope) || !Number.isInteger(refId) || !scopeAllowed(me, scope, refId)) return { error: "You can only change what you run." };
  db.delete(integrityPolicies).where(and(eq(integrityPolicies.scope, scope), eq(integrityPolicies.refId, refId))).run();
  return { done: "This level now inherits everything." };
}

// ---- review ----

/** Sessions waiting for a person that this admin runs. */
export function queueFor(reach: Reach, limit = 100) {
  const ids = usersInReach(reach);
  return reviewQueue(limit).filter((s) => ids === null || ids.has(s.userId));
}
export const queueCount = (reach: Reach) => queueFor(reach, 500).length;

/**
 * An admin's call on a flagged pass. Clear: the result stands, and any certificate and rewards that were held are given now.
 * Reject: the pass is withdrawn (the level counts as not passed), a certificate already issued for it is revoked, and the person is told.
 * Never your own, never someone outside what you run, and a rejection needs a reason.
 */
export function decide(me: Me, fd: FormData): SetupState {
  if (me.role !== "admin") return { error: "Only an admin can decide this." };
  const id = Number(str(fd.get("sessionId"))), to = str(fd.get("to")), note = str(fd.get("note")).slice(0, 300);
  const s = Number.isInteger(id) ? db.select().from(integritySessions).where(eq(integritySessions.id, id)).get() : undefined;
  if (!s || s.userId === me.id || !userInReach(reachOf(me.id), s.userId)) return { error: "You can only review exams of people in the companies you run, and not your own." };
  if (s.status !== "review") return { error: "That one has already been decided." };
  if (to !== "clear" && to !== "reject") return { error: "Choose clear or reject." };
  if (to === "reject" && note.length < 3) return { error: "Say why it is being rejected (a few words). The person will see it." };

  const taken = db.update(integritySessions).set({ status: to === "clear" ? "cleared" : "rejected", note, reviewedBy: me.id, reviewedAt: nowSec() })
    .where(and(eq(integritySessions.id, s.id), eq(integritySessions.status, "review"))).run();
  if (!taken.changes) return { error: "Someone else decided that first." };

  const run = runOf(s);
  if (to === "clear") {
    if (run?.passed && s.award === "held") {
      awardForPass(s.userId, run.trackId, run.level, run.score ?? 0);
      db.update(integritySessions).set({ award: "released" }).where(eq(integritySessions.id, s.id)).run();
    }
    notify(s.userId, { key: `integrity-${s.id}`, kind: "system", title: "Your exam result is confirmed", body: s.award === "held" ? "Your certificate and rewards have been released." : "", href: run ? `/run/${run.id}` : "/journey" });
    return { done: s.award === "held" ? "Cleared. The held certificate and rewards were given." : "Cleared." };
  }

  let extra = "";
  if (run) {
    db.update(runs).set({ passed: false }).where(eq(runs.id, run.id)).run();
    const other = db.select({ id: runs.id }).from(runs).where(and(eq(runs.userId, run.userId), eq(runs.trackId, run.trackId), eq(runs.level, run.level), eq(runs.passed, true))).get();
    const cert = !other && db.select().from(certificates).where(and(eq(certificates.userId, run.userId), eq(certificates.trackId, run.trackId), eq(certificates.level, run.level), isNull(certificates.revokedAt))).get();
    if (cert) {
      const f = new FormData(); f.set("id", String(cert.id)); f.set("reason", `Exam not accepted after review: ${note}`.slice(0, 300));
      const r = revokeCertificate(me, f);
      extra = r?.error ? ` The certificate could not be revoked (${r.error}); do it on Certificates.` : " Its certificate was revoked.";
    }
    if (s.award === "released") extra += " Any bonus XP, voucher or money already given stays in the ledger: void it on Rewards if needed.";
  } else if (s.examKind === "role") {
    db.update(roleExams).set({ passed: false }).where(eq(roleExams.id, s.examId)).run();
  }
  notify(s.userId, { key: `integrity-${s.id}`, kind: "system", title: "Your exam result was not accepted", body: note, href: run ? `/run/${run.id}` : "/journey" });
  return { done: `Rejected. The pass is withdrawn.${extra}` };
}


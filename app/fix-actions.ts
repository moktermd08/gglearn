"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { certificates, db, levelCredits, runs } from "@/lib/db";
import { realUser, refuseWhileViewingAs, requireManager } from "@/lib/auth";
import { extendDeadline, restoreRun, voidRun } from "@/lib/corrections";
import { grantCredit, revokeCredit } from "@/lib/credits";
import { reinstateCertificate, revokeCertificate } from "@/lib/certsAdmin";
import { clientIp } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/securityLog";
import type { SetupState } from "@/lib/setup";

/**
 * The corrections on a person's manager profile. Each one runs the lib function that holds the rules (reach, role, reasons, notifying the
 * person), as the real signed-in manager: never while viewing as someone else, so a correction is always on record under the person who
 * actually made it. The security log gets a row for each one that goes through.
 */
const BLOCKED: SetupState = { error: "Exit the view first: corrections are made as yourself, not as the person you are viewing." };

async function run(fd: FormData, personOf: (fd: FormData) => number | null, work: (me: Awaited<ReturnType<typeof requireManager>>, ip: string) => SetupState): Promise<SetupState> {
  const me = await requireManager();
  if (await refuseWhileViewingAs()) return BLOCKED;
  const real = await realUser();
  if (!real || real.id !== me.id) return BLOCKED;
  const r = work(me, await clientIp());
  const id = personOf(fd);
  if (r?.done && id != null) revalidatePath(`/admin/people/${id}`);
  return r;
}

const userOfRun = (fd: FormData) => { const r = db.select({ u: runs.userId }).from(runs).where(eq(runs.id, Number(fd.get("runId")))).get(); return r?.u ?? null; };
const userOfCredit = (fd: FormData) => db.select({ u: levelCredits.userId }).from(levelCredits).where(eq(levelCredits.id, Number(fd.get("creditId")))).get()?.u ?? null;
const userField = (fd: FormData) => { const n = Number(fd.get("userId")); return Number.isInteger(n) && n > 0 ? n : null; };

export const extendDeadlineAction = async (_: SetupState, fd: FormData) => run(fd, userField, (me, ip) => extendDeadline(me, fd, ip));
export const voidRunAction = async (_: SetupState, fd: FormData) => run(fd, userOfRun, (me, ip) => voidRun(me, fd, ip));
export const restoreRunAction = async (_: SetupState, fd: FormData) => run(fd, userOfRun, (me, ip) => restoreRun(me, fd, ip));

export const grantCreditAction = async (_: SetupState, fd: FormData) => run(fd, userField, (me, ip) => {
  const r = grantCredit(me, fd);
  if (r?.done) recordSecurityEvent({ actorId: me.id, targetId: Number(fd.get("userId")), action: "credit_grant", detail: r.done, ip });
  return r;
});
export const revokeCreditAction = async (_: SetupState, fd: FormData) => run(fd, userOfCredit, (me, ip) => {
  const target = userOfCredit(fd);
  const r = revokeCredit(me, fd);
  if (r?.done && target != null) recordSecurityEvent({ actorId: me.id, targetId: target, action: "credit_revoke", detail: r.done, ip });
  return r;
});

const userOfCert = (fd: FormData) => db.select({ u: certificates.userId }).from(certificates).where(eq(certificates.id, Number(fd.get("id")))).get()?.u ?? null; // from the certificate itself, never from a form field
export const revokeCertAction = async (_: SetupState, fd: FormData) => run(fd, userOfCert, (me, ip) => {
  const r = revokeCertificate(me, fd);
  if (r?.done) recordSecurityEvent({ actorId: me.id, targetId: userOfCert(fd) ?? 0, action: "cert_revoke", detail: String(fd.get("reason") ?? "").slice(0, 300), ip });
  return r;
});
export const reinstateCertAction = async (_: SetupState, fd: FormData) => run(fd, userOfCert, (me, ip) => {
  const r = reinstateCertificate(me, fd);
  if (r?.done) recordSecurityEvent({ actorId: me.id, targetId: userOfCert(fd) ?? 0, action: "cert_reinstate", detail: String(fd.get("reason") ?? "").slice(0, 300), ip });
  return r;
});

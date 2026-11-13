import { and, eq, gte } from "drizzle-orm";
import { db, securityLog } from "@/lib/db";

/** Appends one row to the security log. There is deliberately no function here (or anywhere) that edits or removes a row. */
export function recordSecurityEvent(e: { actorId: number; targetId: number; action: "impersonate_start" | "impersonate_end" | "details_edit" | "profile_view" | "deadline_extend" | "run_void" | "run_restore" | "credit_grant" | "credit_revoke" | "cert_revoke" | "cert_reinstate"; detail?: string; ip?: string }) {
  db.insert(securityLog).values({ actorId: e.actorId, targetId: e.targetId, action: e.action, detail: (e.detail ?? "").slice(0, 400), ip: (e.ip ?? "").slice(0, 64) }).run();
}

/** A super admin opened someone's manager profile. Once per person per ten minutes, so a refresh does not fill the log. */
export function recordProfileView(actorId: number, targetId: number, ip = "") {
  const since = Math.floor(Date.now() / 1000) - 600;
  const recent = db.select({ id: securityLog.id }).from(securityLog).where(and(eq(securityLog.actorId, actorId), eq(securityLog.targetId, targetId), eq(securityLog.action, "profile_view"), gte(securityLog.at, since))).get();
  if (!recent) recordSecurityEvent({ actorId, targetId, action: "profile_view", ip });
}

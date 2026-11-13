import { db, securityLog } from "@/lib/db";

/** Appends one row to the security log. There is deliberately no function here (or anywhere) that edits or removes a row. */
export function recordSecurityEvent(e: { actorId: number; targetId: number; action: "impersonate_start" | "impersonate_end" | "details_edit"; detail?: string; ip?: string }) {
  db.insert(securityLog).values({ actorId: e.actorId, targetId: e.targetId, action: e.action, detail: (e.detail ?? "").slice(0, 400), ip: (e.ip ?? "").slice(0, 64) }).run();
}

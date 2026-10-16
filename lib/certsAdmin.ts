import { and, desc, eq, isNull } from "drizzle-orm";
import { certificateEvents, certificates, db, tracks, users } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { nowSec, signatureOf } from "@/lib/certs";
import { reachOf, userInReach } from "@/lib/tenancy";
import type { SetupState } from "@/lib/setup";

type Me = { id: number; role: string };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
export const MAX_REASON = 300;

/**
 * Revoking and reinstating certificates. Only an admin, only for people in their reach (a company's admin cannot touch another
 * company's certificates), never their own. A revocation needs a reason; the holder is told, the public page shows the certificate as
 * revoked (without the reason), and the record is re-signed so editing it back in the database no longer verifies. Every change is kept
 * in `certificate_events`.
 */
function target(me: Me, fd: FormData): { error: string } | { cert: typeof certificates.$inferSelect } {
  if (me.role !== "admin") return { error: "Only an admin can revoke or reinstate certificates." };
  const id = Number(fd.get("id"));
  const cert = Number.isInteger(id) ? db.select().from(certificates).where(eq(certificates.id, id)).get() : undefined;
  if (!cert || cert.userId === me.id || !userInReach(reachOf(me.id), cert.userId)) return { error: "You can only change certificates of people in the companies you run, and not your own." };
  return { cert };
}

export function revokeCertificate(me: Me, fd: FormData): SetupState {
  const t = target(me, fd);
  if ("error" in t) return t;
  const reason = str(fd.get("reason"));
  if (reason.length < 3) return { error: "Say why it is being revoked (at least a few words). The holder will see it." };
  if (reason.length > MAX_REASON) return { error: `Keep the reason under ${MAX_REASON} characters.` };
  const at = nowSec();
  const c = t.cert;
  const revoked = db.transaction((tx) => {
    const done = tx.update(certificates).set({ revokedAt: at, revokedBy: me.id, revokedReason: reason, signature: signatureOf({ ...c, revokedAt: at, revokedReason: reason }) })
      .where(and(eq(certificates.id, c.id), isNull(certificates.revokedAt))).run();
    if (!done.changes) return false; // someone else revoked it first
    tx.insert(certificateEvents).values({ certificateId: c.id, kind: "revoked", byUser: me.id, reason, at }).run();
    return true;
  });
  if (!revoked) return { error: "That certificate is already revoked." };
  const name = db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, c.trackId)).get()?.n ?? "a subject";
  notify(c.userId, { key: `cert-revoked-${c.id}-${at}`, kind: "system", title: "A certificate was revoked", body: `${name}, level ${c.level}. Reason: ${reason}`, href: "/profile" });
  return { done: "Revoked. The certificate page now shows it as revoked, and the holder has been told." };
}

export function reinstateCertificate(me: Me, fd: FormData): SetupState {
  const t = target(me, fd);
  if ("error" in t) return t;
  const c = t.cert;
  if (!c.revokedAt) return { error: "That certificate is not revoked." };
  const at = nowSec(), note = str(fd.get("reason")).slice(0, MAX_REASON);
  db.transaction((tx) => {
    tx.update(certificates).set({ revokedAt: null, revokedBy: null, revokedReason: "", signature: signatureOf({ ...c, revokedAt: null, revokedReason: "" }) }).where(eq(certificates.id, c.id)).run();
    tx.insert(certificateEvents).values({ certificateId: c.id, kind: "reinstated", byUser: me.id, reason: note, at }).run();
  });
  const name = db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, c.trackId)).get()?.n ?? "a subject";
  notify(c.userId, { key: `cert-reinstated-${c.id}-${at}`, kind: "system", title: "A certificate was reinstated", body: `${name}, level ${c.level} is valid again.`, href: "/profile" });
  return { done: "Reinstated. The certificate is valid again." };
}

/** The most recent revocations and reinstatements, newest first. */
export function revocationLog(limit = 30) {
  return db.select({ e: certificateEvents, by: users.name }).from(certificateEvents).innerJoin(users, eq(users.id, certificateEvents.byUser))
    .orderBy(desc(certificateEvents.at), desc(certificateEvents.id)).limit(limit).all();
}

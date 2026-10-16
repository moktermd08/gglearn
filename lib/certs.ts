import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { companies, db, certificates } from "@/lib/db";
import { singleCompany } from "@/lib/brand";
import { scopesOf } from "@/lib/paths";

/**
 * Certificate expiry and signature.
 *
 * Expiry: a company sets how many months a new certificate stays valid (0 = never). The date is stored on the certificate when it
 * is issued, so changing the setting later never changes one already given. Passing the same level again once a certificate is
 * within RENEW_WINDOW_DAYS of expiring (or past it) renews it. Certificates issued before this existed never expire.
 *
 * Signature: the company's named signatory is copied onto the certificate at issue, together with a keyed fingerprint (HMAC with the
 * server's secret) of every field that matters. The public page recomputes it, so a record edited directly in the database, a changed
 * level, score or expiry, no longer matches and is shown as altered instead of verified.
 */
export const RENEW_WINDOW_DAYS = 60;
export const MAX_VALID_MONTHS = 120;
const DAY = 86400;
export const nowSec = () => Math.floor(Date.now() / 1000);

export type CertPolicy = { validMonths: number; signer: string; signerTitle: string };
export const NO_POLICY: CertPolicy = { validMonths: 0, signer: "", signerTitle: "" };

/** The policy of the company this person belongs to, when exactly one; the default (no expiry, no signatory) otherwise. */
export function policyFor(userId: number): CertPolicy {
  const id = singleCompany(scopesOf(userId));
  const c = id == null ? undefined : db.select().from(companies).where(eq(companies.id, id)).get();
  return c ? { validMonths: c.certValidMonths, signer: c.certSigner, signerTitle: c.certSignerTitle } : NO_POLICY;
}

export function addMonths(at: number, months: number): number {
  const d = new Date(at * 1000);
  d.setUTCMonth(d.getUTCMonth() + months);
  return Math.floor(d.getTime() / 1000);
}

type Cert = typeof certificates.$inferSelect;
export type CertState = "permanent" | "valid" | "expiring" | "expired";
export function certState(c: Pick<Cert, "expiresAt">, at = nowSec()): { state: CertState; expiresAt: number | null; daysLeft: number | null } {
  if (c.expiresAt == null) return { state: "permanent", expiresAt: null, daysLeft: null };
  const daysLeft = Math.ceil((c.expiresAt - at) / DAY);
  return { state: at >= c.expiresAt ? "expired" : daysLeft <= RENEW_WINDOW_DAYS ? "expiring" : "valid", expiresAt: c.expiresAt, daysLeft };
}

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
type Signed = Pick<Cert, "code" | "userId" | "trackId" | "level" | "score" | "issuedAt" | "expiresAt" | "renewedAt" | "signer" | "signerTitle"> & Partial<Pick<Cert, "revokedAt" | "revokedReason">>;
/** 20 hex characters (80 bits) of an HMAC over the certificate's fields, with its own prefix so it can never double as a session token. */
export function signatureOf(c: Signed): string {
  // a certificate that was never revoked signs exactly as before, so signatures made before revocation existed still verify
  const body = ["cert1", c.code, c.userId, c.trackId, c.level, Math.round(c.score * 100), c.issuedAt, c.expiresAt ?? 0, c.renewedAt ?? 0, c.signer, c.signerTitle, ...(c.revokedAt ? ["revoked", c.revokedAt, c.revokedReason ?? ""] : [])].join("|");
  return createHmac("sha256", secret()).update(body).digest("hex").slice(0, 20).toUpperCase();
}

export type SignatureStatus = "valid" | "altered" | "unsigned";
export function signatureStatus(c: Cert): SignatureStatus {
  if (!c.signature) return "unsigned";
  const want = Buffer.from(signatureOf(c)), have = Buffer.from(c.signature);
  return want.length === have.length && timingSafeEqual(want, have) ? "valid" : "altered";
}

/**
 * Gives a certificate for a passed level, or renews the one the person already has when it is expiring or expired.
 * Safe to call again: a certificate that is current is left alone.
 */
export function issueCertificate(tx: Pick<typeof db, "insert" | "select" | "update">, userId: number, trackId: number, level: number, score: number, code: string): void {
  const at = nowSec(), pol = policyFor(userId);
  const have = tx.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.trackId, trackId), eq(certificates.level, level))).get();
  if (!have) {
    const row = { userId, trackId, level, score, code, issuedAt: at, expiresAt: pol.validMonths > 0 ? addMonths(at, pol.validMonths) : null, renewedAt: null, signer: pol.signer, signerTitle: pol.signerTitle };
    tx.insert(certificates).values({ ...row, signature: signatureOf(row) }).onConflictDoNothing().run();
    return;
  }
  if (have.revokedAt) return; // a revoked certificate stays revoked until an admin reinstates it, whatever the person passes
  if (have.expiresAt == null || pol.validMonths <= 0 || have.expiresAt - at > RENEW_WINDOW_DAYS * DAY) return;
  const next = { ...have, expiresAt: addMonths(at, pol.validMonths), renewedAt: at, signer: pol.signer || have.signer, signerTitle: pol.signer ? pol.signerTitle : have.signerTitle };
  tx.update(certificates).set({ expiresAt: next.expiresAt, renewedAt: next.renewedAt, signer: next.signer, signerTitle: next.signerTitle, signature: signatureOf(next) }).where(eq(certificates.id, have.id)).run();
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db, joinLinks } from "@/lib/db";

/**
 * Team links. The token is `${id}.${signature}` where the signature is an HMAC of the id, so nothing secret is stored, a guessed id is useless,
 * and a manager can copy the link again later. Who can use it, and for how long, lives in the row: it stops when it is switched off,
 * expires, or has been used `maxUses` times. The place it is claimed is atomic, so two people cannot take the last seat together.
 */
export { MAX_LINK_USES, DEFAULT_LINK_USES, MAX_LINK_DAYS, DEFAULT_LINK_DAYS } from "@/lib/joinLinks-shared";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (id: number) => createHmac("sha256", secret()).update(`joinlink:${id}`).digest("base64url").slice(0, 24);

export const linkToken = (id: number) => `${id}.${sign(id)}`;
export const linkPath = (id: number) => `/join/l/${linkToken(id)}`;

type Link = typeof joinLinks.$inferSelect;
const nowSec = () => Math.floor(Date.now() / 1000);

/** The row behind a token, whatever its state; null for anything that is not a genuine token. */
export function linkOf(token: string): Link | null {
  const m = /^(\d{1,9})\.([A-Za-z0-9_-]{24})$/.exec(token);
  if (!m) return null;
  const want = Buffer.from(sign(Number(m[1]))), got = Buffer.from(m[2]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return db.select().from(joinLinks).where(eq(joinLinks.id, Number(m[1]))).get() ?? null;
}

export type LinkState = "open" | "revoked" | "expired" | "full";
export const stateOfLink = (l: Link, t = nowSec()): LinkState => l.revokedAt ? "revoked" : l.expiresAt <= t ? "expired" : l.uses >= l.maxUses ? "full" : "open";

/** The link behind a token, only while it can still be used. */
export function findOpenLink(token: string): Link | null {
  const l = linkOf(token);
  return l && stateOfLink(l) === "open" ? l : null;
}

/** Takes one place. False when the link filled up, expired or was switched off between the page and the click. */
export function claimPlace(tx: Pick<typeof db, "update">, id: number): boolean {
  const t = nowSec();
  return !!tx.update(joinLinks).set({ uses: sql`${joinLinks.uses} + 1` })
    .where(and(eq(joinLinks.id, id), isNull(joinLinks.revokedAt), gt(joinLinks.expiresAt, t), lt(joinLinks.uses, joinLinks.maxUses))).returning().get();
}

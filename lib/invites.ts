import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, invites } from "@/lib/db";

export const INVITE_TTL_SEC = 7 * 24 * 60 * 60;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(24).toString("base64url");
export { hashToken };

/** The invite behind a token, only while it is unused and unexpired. */
export function findOpenInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const inv = db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).get();
  if (!inv || inv.usedAt || inv.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return inv;
}

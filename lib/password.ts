import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

// Request paths use the async versions: scrypt is slow on purpose and must not block the event loop.
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scryptAsync(pw, salt, 64)).toString("hex")}`;
}

/** For scripts (seed) only. */
export function hashPasswordSync(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex"), b = await scryptAsync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Verified against when the email is unknown, so "no such user" costs the same time as "wrong password".
const DUMMY_HASH = hashPasswordSync(randomBytes(16).toString("hex"));
export const verifyAgainstDummy = (pw: string) => verifyPassword(pw, DUMMY_HASH);

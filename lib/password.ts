import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Stored format: `scrypt$N$r$p$salt$hash`. The cost parameters travel with the hash, so they can be raised
 * later and old hashes keep verifying until the person next signs in (see needsRehash).
 * Legacy hashes are `salt:hash` made with Node's defaults (N=16384, r=8, p=1).
 */
const PARAMS = { N: 32768, r: 8, p: 1 };
const LEGACY = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
const MAX_N = 1 << 17; // refuse absurd costs from a damaged or tampered row

type Params = typeof PARAMS;
const opts = (c: Params): ScryptOptions => ({ N: c.N, r: c.r, p: c.p, maxmem: 256 * c.N * c.r });

const scryptAsync = (pw: string, salt: string, c: Params) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, KEYLEN, opts(c), (e, k) => (e ? reject(e) : resolve(k))));

function parse(stored: string): { c: Params; salt: string; hash: string } | null {
  if (stored.startsWith("scrypt$")) {
    const [, N, r, p, salt, hash] = stored.split("$");
    const c = { N: Number(N), r: Number(r), p: Number(p) };
    if (!salt || !hash || !(c.N >= 2 && c.N <= MAX_N && (c.N & (c.N - 1)) === 0) || !(c.r >= 1 && c.r <= 16) || !(c.p >= 1 && c.p <= 4)) return null;
    return { c, salt, hash };
  }
  const [salt, hash] = stored.split(":");
  return salt && hash ? { c: LEGACY, salt, hash } : null;
}

const format = (c: Params, salt: string, hash: Buffer) => `scrypt$${c.N}$${c.r}$${c.p}$${salt}$${hash.toString("hex")}`;

// Request paths use the async versions: scrypt is slow on purpose and must not block the event loop.
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return format(PARAMS, salt, await scryptAsync(pw, salt, PARAMS));
}

/** For scripts (seed) only. */
export function hashPasswordSync(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return format(PARAMS, salt, scryptSync(pw, salt, KEYLEN, opts(PARAMS)));
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const s = parse(stored);
  if (!s) return false;
  const a = Buffer.from(s.hash, "hex"), b = await scryptAsync(pw, s.salt, s.c);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True for legacy hashes and anything made with weaker settings than today's. Rehash after a successful login. */
export function needsRehash(stored: string): boolean {
  const s = parse(stored);
  return !s || s.c.N < PARAMS.N || s.c.r < PARAMS.r || s.c.p < PARAMS.p;
}

// Verified against when the email is unknown, so "no such user" costs the same time as "wrong password".
const DUMMY_HASH = hashPasswordSync(randomBytes(16).toString("hex"));
export const verifyAgainstDummy = (pw: string) => verifyPassword(pw, DUMMY_HASH);

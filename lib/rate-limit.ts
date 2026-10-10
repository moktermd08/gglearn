import { headers } from "next/headers";

/**
 * Fixed-window attempt limiter held in process memory. Fine while the app runs as one PM2 process
 * (see ecosystem.config.cjs); counters reset on restart. Move to the DB if that ever changes.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** True while `key` is still under `limit` hits for the current window. Does not count a hit. */
export function allowed(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return !b || b.resetAt <= Date.now() || b.count < limit;
}

export function hit(key: string, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else b.count++;
}

export function clear(key: string) {
  buckets.delete(key);
}

/**
 * Apache appends the real client address to X-Forwarded-For, so the LAST entry is the one our own
 * proxy saw; earlier entries are client-supplied and spoofable.
 */
export async function clientIp(): Promise<string> {
  const xff = (await headers()).get("x-forwarded-for");
  return xff?.split(",").pop()?.trim() || "local";
}

export const MINUTE = 60_000;

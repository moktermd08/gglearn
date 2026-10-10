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
 * The client address from X-Forwarded-For. Production is Cloudflare -> Apache -> Next, and each hop
 * appends the address it saw the request come from:
 *   spoofable entries..., real client (added by Cloudflare), Cloudflare edge (added by Apache)
 * so the real client is TRUSTED_PROXY_HOPS entries from the end (default 2). Anything a visitor puts in the
 * header sits to the left of that and is ignored. With fewer entries than hops (a direct request, or local
 * dev) the first entry is used. Caveat: someone who reaches Apache directly, bypassing Cloudflare, can still
 * spoof the entry; restrict Apache to Cloudflare's address ranges if that matters.
 */
export function pickClientIp(xff: string | null | undefined, hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 2)): string {
  const parts = (xff ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "local";
  return parts[Math.max(parts.length - Math.max(hops, 1), 0)].slice(0, 64);
}

export async function clientIp(): Promise<string> {
  return pickClientIp((await headers()).get("x-forwarded-for"));
}

export const MINUTE = 60_000;

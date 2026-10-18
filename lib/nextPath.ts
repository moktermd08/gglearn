/**
 * Where to send someone after they sign in, from a `next` field a link can carry. Only a path inside this site is accepted: it must start
 * with a single "/" and may not hold a backslash, a scheme, whitespace or control characters, so a link can never send a person to another
 * site after they have typed their password. Anything else is null and the caller uses its default.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\s\u0000-\u001f]/.test(raw) || raw.includes("://")) return null;
  return raw;
}

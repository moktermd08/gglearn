/** Tidying and checking what people type into a CV. No database, so the forms can use it too. Everything is plain text; nothing is ever rendered as HTML. */

/** One line: spaces tidied, control characters dropped, cut to `max`. */
export function cleanLine(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Several lines (one bullet each): blank lines and runs of spaces tidied, cut to `max`. */
export function cleanBlock(v: unknown, max: number): string {
  const s = typeof v === "string" ? v : "";
  return s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").split("\n").map((l) => l.replace(/[^\S\n]+/g, " ").replace(/^[-•*]\s*/, "").trim()).filter(Boolean).join("\n").slice(0, max);
}

/** A web address a reader may be sent to: https (or http), no credentials, nothing else. Returns the cleaned address or null. */
export function safeUrl(v: unknown): string | null {
  const s = cleanLine(v, 300);
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch { return null; }
}

export const isEmail = (v: string) => v.length <= 120 && /^[^\s@<>"',;:()\\]+@[^\s@<>"',;:()\\]+\.[^\s@<>"',;:()\\]+$/.test(v);

/** "2024-05" -> "May 2024", "2024" -> "2024", anything else -> "". */
export function monthYear(v: string): string {
  const m = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(v);
  if (!m) return "";
  return m[2] ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m[2]) - 1]} ${m[1]}` : m[1];
}

/** "May 2024 – Present", "2019 – 2022", "From 2023", or "". */
export function dateRange(starts: string, ends: string, current: boolean): string {
  const a = monthYear(starts), b = current ? "Present" : monthYear(ends);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a ? `From ${a}` : b;
}

export const isHexColour = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** Parses JSON a person's row holds, falling back rather than throwing if it is ever not what was written. */
export function parseJson<T>(s: string, fallback: T): T {
  try { const v = JSON.parse(s); return v ?? fallback; } catch { return fallback; }
}

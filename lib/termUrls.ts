import { asc, eq } from "drizzle-orm";
import { careerLevels, db } from "@/lib/db";
import { EVERYONE, roleList } from "@/lib/termStudy";
import { slugify } from "@/lib/urlText";

/**
 * The addresses of a role's term pages, in words: /terms/role/casework-officer/senior-caseworker. A role and a level are each written as their name with
 * hyphens, so nothing needs percent-encoding. Addresses made before this (/terms/role/casework%20officer?level=3) are still understood and sent on.
 */

export type TermPage = "role" | "study" | "build";

const ladderOf = (role: string) => db.select().from(careerLevels).where(eq(careerLevels.jobRole, role)).orderBy(asc(careerLevels.level)).all();

/** The words for a level of a role: its title, or its number when the title would not be unique or the role has only one level. */
function levelSlug(role: string, level: number): string | null {
  if (role === EVERYONE) return null; // one level only, so the address stops at the role
  const ladder = ladderOf(role), row = ladder.find((l) => l.level === level);
  if (!row) return String(level);
  const slug = slugify(row.title);
  const clash = !slug || /^\d+$/.test(slug) || ladder.some((l) => l.level !== level && slugify(l.title) === slug);
  return clash ? String(level) : slug;
}

export function termUrl(page: TermPage, role: string, level: number): string {
  const key = role.trim().toLowerCase(), last = levelSlug(key, level);
  return `/terms/${page}/${slugify(key)}${last ? `/${last}` : ""}`;
}

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** The role an address names: written with hyphens, or (older addresses) the role itself, percent-encoded or not. Null when no list has that name. */
export function findRole(part: string): string | null {
  const raw = decode(part).trim().toLowerCase();
  if (!raw) return null;
  const roles = [EVERYONE, ...new Set(db.select({ r: careerLevels.jobRole }).from(careerLevels).all().map((x) => x.r))];
  return roles.find((r) => r === raw) ?? roles.find((r) => slugify(r) === slugify(raw)) ?? null;
}

/** The level an address names, by its words or its number. Null when the role has no such level. */
export function findLevel(role: string, part: string): number | null {
  const raw = decode(part).trim().toLowerCase();
  if (/^\d+$/.test(raw)) return roleList(role, Number(raw))?.level ?? null;
  const ladder = role === EVERYONE ? [] : ladderOf(role);
  return ladder.find((l) => slugify(l.title) === slugify(raw))?.level ?? null;
}

export type Where = { role: string; level: number; /** the address to send the person to when theirs is not the readable one */ canonical: string | null };

/**
 * Reads a term page's address: the path parts after /terms/<page>, plus the old ?role= and ?level= forms. `fallback` is the level to use when none is named.
 * Null when no role is named that has a list.
 */
export function readTermUrl(page: TermPage, parts: string[], query: { role?: string; level?: string }, fallback: (role: string) => number): Where | null {
  if (parts.length > 2) return null;
  const [first = query.role ?? "", second = query.level ?? ""] = parts;
  const role = findRole(first);
  if (!role) return null;
  const named = second ? findLevel(role, second) : null;
  // a level that no longer exists (a title that was renamed) falls back to the person's own level rather than a dead end
  const level = named ?? (roleList(role, fallback(role)) ? fallback(role) : (role === EVERYONE ? 1 : ladderOf(role)[0]?.level ?? 1));
  if (!roleList(role, level)) return null;
  const url = termUrl(page, role, level);
  const asked = `/terms/${page}${parts.length ? `/${parts.join("/")}` : ""}`;
  return { role, level, canonical: asked !== url || query.role != null || query.level != null ? url : null };
}

import { db, userScopes, users } from "@/lib/db";
import { companyMaps, singleCompanyIn } from "@/lib/brand";

/**
 * Who competes with whom. A person who belongs to exactly one company competes in that company's arena ("c<id>");
 * everyone else (several companies, or none: individuals, customers of no company, the platform owner) shares the "open" arena.
 * Season boards, group boards and open contests only ever mix people from the same arena. It is the same rule that picks a
 * person's branding, so what you see and who you race always agree.
 */
export type Arena = string;
export const OPEN: Arena = "open";

/** Every user's arena, in one pass. */
export function arenaMap(): Map<number, Arena> {
  const maps = companyMaps();
  const by = new Map<number, { kind: "company" | "brand" | "project"; id: number }[]>();
  for (const s of db.select().from(userScopes).all()) by.set(s.userId, [...(by.get(s.userId) ?? []), { kind: s.kind, id: s.refId }]);
  const out = new Map<number, Arena>();
  for (const u of db.select({ id: users.id }).from(users).all()) {
    const c = singleCompanyIn(by.get(u.id) ?? [], maps);
    out.set(u.id, c == null ? OPEN : `c${c}`);
  }
  return out;
}

export const arenaOf = (userId: number, m: Map<number, Arena> = arenaMap()): Arena => m.get(userId) ?? OPEN;

/** An admin with no scopes runs the whole academy; what they organise is for everyone, in every arena. */
export function isPlatformOwner(userId: number, owners = platformOwners()): boolean {
  return owners.has(userId);
}
export function platformOwners(): Set<number> {
  const scoped = new Set(db.select({ id: userScopes.userId }).from(userScopes).all().map((s) => s.id));
  return new Set(db.select({ id: users.id, role: users.role }).from(users).all().filter((u) => u.role === "admin" && !scoped.has(u.id)).map((u) => u.id));
}

import { inArray } from "drizzle-orm";
import { companies, db } from "@/lib/db";
import { companyMaps } from "@/lib/brand";
import { scopesOf, type Scope } from "@/lib/paths";
import { notify } from "@/lib/notifications";

/**
 * Where a person belongs, in plain words. A person belongs to a company through a company scope, a brand of it, or one of its projects. What that means
 * for them is decided by how many companies it is (the same rules the rest of the app uses, lib/arena.ts and lib/brand.ts):
 *   none      the open arena with everyone who is not in a single company, and gglearn's own look
 *   one       that company's arena (its people race and rank together) and that company's name, colours and certificates
 *   several   the open arena and gglearn's own look, as for none, because no single company's arena or look is the right one
 * This file only works out the companies and writes the words; it changes nothing about who races with whom.
 */
export type Membership = { companies: string[]; kind: "none" | "one" | "many" };

const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The headline and the explanation for a set of company names. Pure. */
export function explain(names: string[]): { kind: Membership["kind"]; headline: string; body: string } {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  if (sorted.length === 0) return { kind: "none", headline: "You are not part of a company", body: "You race, and appear on the boards and the league, in the open arena with everyone else who is not in a single company. You see gglearn's own look. Contests you start or are invited to are open to anyone you invite." };
  if (sorted.length === 1) return { kind: "one", headline: `You belong to ${sorted[0]}`, body: `You race, and appear on the boards and the league, with ${sorted[0]}'s people. You see its name, colours and certificates, and your managers there can see your progress and assign you learning. A contest is still open to anyone you invite from outside.` };
  return { kind: "many", headline: `You belong to ${list(sorted)}`, body: `Because you belong to more than one company you race in the open arena, not in any one company's own, and you see gglearn's own look instead of a company's. Each company's managers can still see you in their people list, assign you learning and see your progress on their topics. If you should belong to only one, ask a manager to change it.` };
}

/** What to tell someone whose companies changed, or null when the set is the same. Pure. */
export function changeNote(before: string[], after: string[]): { title: string; body: string } | null {
  const b = new Set(before), a = new Set(after);
  const added = [...a].filter((n) => !b.has(n)).sort(), removed = [...b].filter((n) => !a.has(n)).sort();
  if (!added.length && !removed.length) return null;
  const now = explain(after);
  const what = added.length && removed.length ? `You were moved: you now belong to ${list(added)} and no longer to ${list(removed)}.` : added.length ? `You now belong to ${list(added)}.` : `You no longer belong to ${list(removed)}.`;
  return { title: what, body: now.body };
}

/** The companies a set of scopes puts someone in: through the company itself, a brand of it, or a project of it. */
export function companyNames(scopes: Scope[]): string[] {
  if (!scopes.length) return [];
  const m = companyMaps(), ids = new Set<number>();
  for (const s of scopes) {
    if (s.kind === "company") ids.add(s.id);
    else if (s.kind === "brand") { const c = m.brands.get(s.id)?.companyId; if (c != null) ids.add(c); }
    else { const p = m.projects.get(s.id); const c = p?.companyId ?? (p?.brandId != null ? m.brands.get(p.brandId)?.companyId : null); if (c != null) ids.add(c); }
  }
  return ids.size ? db.select({ n: companies.name }).from(companies).where(inArray(companies.id, [...ids])).all().map((r) => r.n).sort((x, y) => x.localeCompare(y)) : [];
}

export function membershipOf(userId: number): Membership & { headline: string; body: string } {
  const names = companyNames(scopesOf(userId)), e = explain(names);
  return { companies: names, kind: e.kind, headline: e.headline, body: e.body };
}

/** After someone's scopes change: tells them, once, if the set of companies they belong to is now different. */
export function noteMembershipChange(userId: number, before: Scope[], after: Scope[], at = Math.floor(Date.now() / 1000)) {
  const n = changeNote(companyNames(before), companyNames(after));
  if (n) notify(userId, { key: `membership-${userId}-${at}-${Math.random().toString(36).slice(2, 7)}`, kind: "system", title: n.title, body: n.body, href: "/profile#belong" });
}

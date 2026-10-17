import { eq } from "drizzle-orm";
import { brands, db, projects, userScopes } from "@/lib/db";
import { scopesOf, type Scope } from "@/lib/paths";

/**
 * Which part of the academy a manager or admin may run.
 *
 * A manager or admin with NO scopes runs the whole academy (the platform owner). One with scopes runs only those
 * companies, brands and projects, and everything beneath them: a company covers its brands and projects, a brand
 * covers its projects. A person is in reach when their own scopes (expanded the same way) overlap.
 */
export type Reach = { all: true } | { all: false; keys: Set<string> };

const key = (kind: Scope["kind"], id: number) => `${kind}:${id}`;

type Structure = { brands: { id: number; companyId: number | null }[]; projects: { id: number; companyId: number | null; brandId: number | null }[] };
/** The brands and projects, read once so a list of many people does not read them again for each person. */
const structure = (): Structure => ({ brands: db.select({ id: brands.id, companyId: brands.companyId }).from(brands).all(), projects: db.select({ id: projects.id, companyId: projects.companyId, brandId: projects.brandId }).from(projects).all() });

/** Scopes plus everything beneath them, as "kind:id" keys. */
function expand(scopes: Scope[], st: Structure = structure()): Set<string> {
  const keys = new Set(scopes.map((s) => key(s.kind, s.id)));
  const allBrands = st.brands, allProjects = st.projects;
  for (const b of allBrands) if (b.companyId != null && keys.has(key("company", b.companyId))) keys.add(key("brand", b.id));
  for (const p of allProjects) {
    if ((p.companyId != null && keys.has(key("company", p.companyId))) || (p.brandId != null && keys.has(key("brand", p.brandId)))) keys.add(key("project", p.id));
  }
  return keys;
}

export function reachOf(userId: number): Reach {
  const scopes = scopesOf(userId);
  return scopes.length ? { all: false, keys: expand(scopes) } : { all: true };
}

/** The reach of just these scopes and what is beneath them: a manager who runs several companies, looking at one. Never wider than what they run: check scopeInReach first. */
export function reachFor(scopes: Scope[]): Reach {
  return { all: false, keys: expand(scopes) };
}

export const isGlobal = (r: Reach): r is { all: true } => r.all;

/** May this manager grant or touch this scope? */
export function scopeInReach(r: Reach, s: Scope): boolean {
  return r.all || r.keys.has(key(s.kind, s.id));
}

/** Is a person (identified by their scopes) someone this manager runs? People with no scopes are only reachable by the platform owner. */
export function personInReach(r: Reach, personScopes: Scope[], st?: Structure): boolean {
  if (r.all) return true;
  if (!personScopes.length) return false;
  const theirs = expand(personScopes, st);
  for (const k of theirs) if (r.keys.has(k)) return true;
  return false;
}

export function userInReach(r: Reach, userId: number): boolean {
  return r.all || personInReach(r, scopesOf(userId));
}

/** Ids of the users in reach (null = everyone). One query for all scopes, for list pages. */
export function usersInReach(r: Reach): Set<number> | null {
  if (r.all) return null;
  const by = new Map<number, Scope[]>();
  for (const s of db.select().from(userScopes).all()) by.set(s.userId, [...(by.get(s.userId) ?? []), { kind: s.kind, id: s.refId }]);
  const st = structure();
  return new Set([...by].filter(([, sc]) => personInReach(r, sc, st)).map(([id]) => id));
}

/** Does a track belong to something this manager runs? Shared academy tracks (no company) belong to the platform owner only. */
export function trackInReach(r: Reach, t: { scope: "company" | "brand" | "project"; projectId: number | null; brandId: number }): boolean {
  if (r.all) return true;
  if (t.scope === "project" && t.projectId != null) return r.keys.has(key("project", t.projectId));
  const brand = db.select().from(brands).where(eq(brands.id, t.brandId)).get();
  if (!brand || brand.kind === "shared") return false;
  return r.keys.has(key("brand", brand.id)) || (brand.companyId != null && r.keys.has(key("company", brand.companyId)));
}

/** The companies, brands and projects a manager may pick when adding or moving people. */
export function limitOptions<O extends { companies: { id: number }[]; brands: { id: number }[]; projects: { id: number }[] }>(o: O, r: Reach): O {
  if (r.all) return o;
  return {
    ...o,
    companies: o.companies.filter((x) => r.keys.has(key("company", x.id))),
    brands: o.brands.filter((x) => r.keys.has(key("brand", x.id))),
    projects: o.projects.filter((x) => r.keys.has(key("project", x.id))),
  };
}

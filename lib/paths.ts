import { and, eq, inArray, sql } from "drizzle-orm";
import { brands, companies, db, enrollments, pillars, projects, questions, tracks, userScopes, users } from "@/lib/db";
import { levelsEarned } from "@/lib/progress";
import { MAX_LEVEL } from "@/lib/levels";
import { tagsFor } from "@/lib/dynamic/tags";
import { hiddenTrackIds } from "@/lib/tracks";
import { isLibraryBrand, pillarStance } from "@/lib/blueprint";

export type Audience = "staff" | "customer";
export type ScopeKind = "company" | "brand" | "project";
export type Scope = { kind: ScopeKind; id: number };
type Tx = Pick<typeof db, "insert" | "select" | "update" | "delete">;
type Person = { id: number; jobRole: string; audience: Audience };

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

/** "company:1,brand:2" -> scopes. Anything malformed is dropped. */
export function parseScopes(raw: string): Scope[] {
  const out: Scope[] = [];
  for (const part of raw.split(",")) {
    const [kind, id] = part.trim().split(":");
    if ((kind === "company" || kind === "brand" || kind === "project") && /^\d+$/.test(id ?? "")) out.push({ kind, id: Number(id) });
  }
  return out;
}
export const formatScopes = (s: Scope[]) => s.map((x) => `${x.kind}:${x.id}`).join(",");

/** Keeps only scopes that point at a real company, brand or project. */
export function validScopes(tx: Tx, scopes: Scope[]): Scope[] {
  const ids = (kind: ScopeKind) => scopes.filter((s) => s.kind === kind).map((s) => s.id);
  const have = {
    company: new Set(ids("company").length ? tx.select({ id: companies.id }).from(companies).where(inArray(companies.id, ids("company"))).all().map((r) => r.id) : []),
    brand: new Set(ids("brand").length ? tx.select({ id: brands.id }).from(brands).where(inArray(brands.id, ids("brand"))).all().map((r) => r.id) : []),
    project: new Set(ids("project").length ? tx.select({ id: projects.id }).from(projects).where(inArray(projects.id, ids("project"))).all().map((r) => r.id) : []),
  };
  const seen = new Set<string>();
  return scopes.filter((s) => have[s.kind].has(s.id) && !seen.has(`${s.kind}:${s.id}`) && seen.add(`${s.kind}:${s.id}`));
}

export function scopesOf(userId: number, tx: Tx = db): Scope[] {
  return tx.select().from(userScopes).where(eq(userScopes.userId, userId)).all().map((r) => ({ kind: r.kind, id: r.refId }));
}

export function setScopes(tx: Tx, userId: number, scopes: Scope[]) {
  tx.delete(userScopes).where(eq(userScopes.userId, userId)).run();
  if (scopes.length) tx.insert(userScopes).values(scopes.map((s) => ({ userId, kind: s.kind, refId: s.id }))).onConflictDoNothing().run();
}

/** Customers only ever get customer-facing tracks; staff get staff and shared ones. */
export const openTo = (audience: Audience, trackAudience: "staff" | "customer" | "both") => trackAudience === "both" || trackAudience === audience;

/** `reach` = the highest level a person can actually pass: levels unlock in order, so it stops at the first level with no questions. */
type CatalogTrack = typeof tracks.$inferSelect & { brand: typeof brands.$inferSelect; questions: number; reach: number; pillar: string | null };

/** Every visible track with its brand and how many active questions it has. Load once, reuse for many people. */
export function catalog(): CatalogTrack[] {
  const hidden = hiddenTrackIds();
  const counts = new Map(
    db.select({ id: questions.trackId, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "active")).groupBy(questions.trackId).all().map((r) => [r.id, r.n]),
  );
  const levels = new Map<number, Set<number>>();
  for (const r of db.select({ id: questions.trackId, l: questions.level }).from(questions).where(eq(questions.status, "active")).groupBy(questions.trackId, questions.level).all()) {
    levels.set(r.id, (levels.get(r.id) ?? new Set()).add(r.l));
  }
  const reachOf = (id: number, slug: string) => {
    if (tagsFor(slug).length) return MAX_LEVEL; // generated questions cover every level
    const have = levels.get(id);
    let l = 0;
    while (have?.has(l + 1)) l++;
    return l;
  };
  const pillarSlug = new Map(db.select({ id: pillars.id, slug: pillars.slug }).from(pillars).all().map((p) => [p.id, p.slug]));
  return db.select({ t: tracks, b: brands }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).all()
    .filter((r) => !hidden.has(r.t.id)).map((r) => ({
      ...r.t, brand: r.b, questions: counts.get(r.t.id) ?? 0, reach: reachOf(r.t.id, r.t.slug),
      pillar: r.t.pillarId == null ? null : pillarSlug.get(r.t.pillarId) ?? null,
    }));
}

/** Is this track part of the knowledge this person's companies, brands and projects share? */
export function inScope(t: CatalogTrack, audience: Audience, scopes: Scope[]): boolean {
  if (!openTo(audience, t.audience)) return false;
  const has = (kind: ScopeKind, id: number | null) => id != null && scopes.some((s) => s.kind === kind && s.id === id);
  if (t.scope === "project") return has("project", t.projectId);
  const companyMember = audience === "staff" && has("company", t.brand.companyId);
  if (t.scope === "brand") return (audience === "staff" && (t.brand.kind === "shared")) || companyMember || has("brand", t.brand.id);
  return (audience === "staff" && (t.brand.kind === "shared")) || has("company", t.brand.companyId) || has("brand", t.brand.id);
}

const rolesOf = (t: { roles: string }) => t.roles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);

export type Requirement = {
  track: CatalogTrack;
  why: "mandatory" | "role";
  passed: number;
  done: boolean;
  assignedAt: number | null; // null until the person has been enrolled
  dueAt: number;
  overdue: boolean;
};

/**
 * Does this person work for a company? A staff member whose only scope is a personal brand (an individual learning on their
 * own) is not covered by company policy, so the academy's company-wide courses are optional for them.
 */
export function worksForCompany(scopes: Scope[]): boolean {
  if (scopes.some((s) => s.kind === "company")) return true;
  const brandIds = scopes.filter((s) => s.kind === "brand").map((s) => s.id), projectIds = scopes.filter((s) => s.kind === "project").map((s) => s.id);
  if (brandIds.length && db.select({ id: brands.id }).from(brands).where(and(inArray(brands.id, brandIds), eq(brands.kind, "company"))).get()) return true;
  return projectIds.length > 0 && !!db.select({ id: projects.id }).from(projects).where(and(inArray(projects.id, projectIds), sql`(${projects.companyId} is not null or ${projects.brandId} is not null)`)).get();
}

/** Tracks this person must pass. Tracks without enough questions to reach the required level are left out: nobody can be required to pass what cannot be taken. */
export function requirementsFor(person: Person, scopes: Scope[], cat = catalog(), at = now()): Requirement[] {
  // accounts with no scope at all predate scoping; they keep the company-wide courses they always had
  const company = person.audience === "customer" || scopes.length === 0 || worksForCompany(scopes);
  const mine = cat.filter((t) => t.reach >= t.requiredLevel && inScope(t, person.audience, scopes))
    .filter((t) => company || t.brand.kind !== "shared").filter((t) => {
    if (t.tier === "mandatory") return true;
    if (person.audience !== "staff") return false;
    const roles = rolesOf(t);
    if (t.tier === "role" && (!roles.length || roles.includes(person.jobRole.toLowerCase()))) return true;
    // the role x pillar matrix (content/blueprints/pillars.json) adds requirements, unless an admin has set this track's policy by hand
    return t.policySource !== "admin" && !isLibraryBrand(t.brand.slug) && pillarStance(person.jobRole, t.pillar) === "required";
  });
  if (!mine.length) return [];
  const started = new Map(
    db.select({ t: enrollments.trackId, at: enrollments.startedAt }).from(enrollments)
      .where(and(eq(enrollments.userId, person.id), inArray(enrollments.trackId, mine.map((t) => t.id)))).all().map((r) => [r.t, r.at]),
  );
  return mine.map((t) => {
    const passed = levelsEarned(person.id, t.id); // real exams only: a placement guess never counts as compliance
    const assignedAt = started.get(t.id) ?? null;
    const dueAt = (assignedAt ?? at) + t.dueDays * DAY;
    const done = passed >= t.requiredLevel;
    return { track: t, why: t.tier === "mandatory" ? "mandatory" : "role", passed, done, assignedAt, dueAt, overdue: !done && at > dueAt } as Requirement;
  }).sort((a, b) => Number(a.done) - Number(b.done) || Number(b.why === "mandatory") - Number(a.why === "mandatory") || a.dueAt - b.dueAt);
}

/** Enrols a person in everything they are required to pass. Safe to repeat; the deadline starts from the first enrolment. */
export function syncRequired(person: Person, tx: Tx = db): number {
  const reqs = requirementsFor(person, scopesOf(person.id, tx));
  const fresh = reqs.filter((r) => r.assignedAt == null);
  if (fresh.length) {
    tx.insert(enrollments).values(fresh.map((r) => ({ userId: person.id, trackId: r.track.id, goal: r.why === "mandatory" ? "Mandatory" : "Required for your role" }))).onConflictDoNothing().run();
  }
  return fresh.length;
}

export function syncEveryone() {
  for (const u of db.select().from(users).where(eq(users.status, "active")).all()) syncRequired(u);
}

export type Compliance = {
  person: typeof users.$inferSelect;
  scopes: Scope[];
  required: number;
  done: number;
  overdue: number;
  nextDue: number | null;
  state: "no-scope" | "none" | "ok" | "due" | "overdue";
};

/** One row per active person: how far through their required path they are. */
export function complianceReport(): Compliance[] {
  const cat = catalog();
  const people = db.select().from(users).where(eq(users.status, "active")).orderBy(users.name).all();
  const allScopes = db.select().from(userScopes).all();
  return people.map((person) => {
    const scopes = allScopes.filter((s) => s.userId === person.id).map((s) => ({ kind: s.kind, id: s.refId }));
    const reqs = requirementsFor(person, scopes, cat);
    const open = reqs.filter((r) => !r.done);
    const overdue = open.filter((r) => r.overdue).length;
    const state = !scopes.length ? "no-scope" : !reqs.length ? "none" : overdue ? "overdue" : open.length ? "due" : "ok";
    return { person, scopes, required: reqs.length, done: reqs.length - open.length, overdue, nextDue: open[0]?.dueAt ?? null, state };
  });
}

export type ScopeOptions = {
  companies: { id: number; name: string }[];
  brands: { id: number; name: string; company: string | null }[];
  projects: { id: number; name: string; brand: string | null }[];
};

/** What a person can be assigned to. Shared academy brands are left out: every staff member gets those anyway. */
export function scopeOptions(): ScopeOptions {
  const cos = db.select().from(companies).orderBy(companies.name).all();
  const name = new Map(cos.map((c) => [c.id, c.name]));
  const bs = db.select().from(brands).orderBy(brands.name).all().filter((b) => b.kind !== "shared");
  const bname = new Map(bs.map((b) => [b.id, b.name]));
  return {
    companies: cos.map((c) => ({ id: c.id, name: c.name })),
    brands: bs.map((b) => ({ id: b.id, name: b.name, company: b.companyId ? name.get(b.companyId) ?? null : null })),
    projects: db.select().from(projects).orderBy(projects.name).all().map((p) => ({ id: p.id, name: p.name, brand: p.brandId ? bname.get(p.brandId) ?? null : null })),
  };
}

/** Readable names for a person's scopes, for lists. */
export function scopeLabels(scopes: Scope[], o: ScopeOptions): string[] {
  return scopes.map((s) =>
    (s.kind === "company" ? o.companies : s.kind === "brand" ? o.brands : o.projects).find((x) => x.id === s.id)?.name ?? `${s.kind} ${s.id}`);
}

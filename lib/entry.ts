import { and, eq, inArray, or, sql } from "drizzle-orm";
import { brands, companies, db, projects, questions, tracks } from "@/lib/db";
import { hiddenTrackIds } from "@/lib/tracks";
import { type Look, lookOfCompany } from "@/lib/brand";

/**
 * A company's public entry page (/c/<slug>). It exists only when an admin switches it on, and it only ever lists the company's customer-facing
 * topics: the same line a race invite link draws, so a stranger never sees staff material. Whoever signs up here becomes a customer of
 * this company (audience "customer", scoped to the company), never staff.
 */
type Company = typeof companies.$inferSelect;

export function entryCompany(slug: string): Company | null {
  const c = db.select().from(companies).where(eq(companies.slug, slug)).get();
  return c && c.entryMode !== "off" ? c : null;
}

export const entryCompanies = () => db.select().from(companies).where(eq(companies.entryMode, "customers")).all();

export type EntryTopic = { id: number; slug: string; name: string; kind: string; brand: string; n: number };

/** The company's customer-facing topics with live questions, grouped later by brand. Staff-only topics are never returned. */
export function entryTopics(companyId: number): EntryTopic[] {
  const bs = db.select({ id: brands.id }).from(brands).where(eq(brands.companyId, companyId)).all().map((b) => b.id);
  const ps = db.select({ id: projects.id }).from(projects).where(or(eq(projects.companyId, companyId), bs.length ? inArray(projects.brandId, bs) : undefined)).all().map((p) => p.id);
  const mine = or(bs.length ? inArray(tracks.brandId, bs) : undefined, ps.length ? inArray(tracks.projectId, ps) : undefined);
  if (!mine) return [];
  const hidden = hiddenTrackIds();
  const rows = db.select({ t: tracks, b: brands.name }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId))
    .where(and(mine, inArray(tracks.audience, ["customer", "both"]))).all()
    .filter((r) => !hidden.has(r.t.id));
  if (!rows.length) return [];
  // live questions per topic, counted in the database and only for these topics
  const live = new Map(db.select({ t: questions.trackId, n: sql<number>`count(*)` }).from(questions)
    .where(and(eq(questions.status, "active"), inArray(questions.trackId, rows.map((r) => r.t.id)))).groupBy(questions.trackId).all().map((r) => [r.t, Number(r.n)]));
  return rows.filter((r) => (live.get(r.t.id) ?? 0) > 0).map((r) => ({ id: r.t.id, slug: r.t.slug, name: r.t.name, kind: r.t.kind, brand: r.b, n: live.get(r.t.id) ?? 0 }));
}

export type Entry = { company: Company; look: Look; topics: EntryTopic[] };
export function entryOf(slug: string): Entry | null {
  const company = entryCompany(slug);
  return company ? { company, look: lookOfCompany(company.id), topics: entryTopics(company.id) } : null;
}

/** Checks companies' public entry pages: npm run check:entry (uses DATABASE_FILE or data/gglearn.db; sets and restores one company's switch). */
import { eq } from "drizzle-orm";
import { brands, companies, db, projects, tracks } from "../lib/db";
import { entryCompanies, entryCompany, entryOf, entryTopics } from "../lib/entry";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const all = db.select().from(companies).all();
const before = new Map(all.map((c) => [c.id, c.entryMode]));
try {
  for (const c of all) db.update(companies).set({ entryMode: "off" }).where(eq(companies.id, c.id)).run();
  check("with every switch off there is no page and nothing in the sitemap list", all.every((c) => entryCompany(c.slug) === null && entryOf(c.slug) === null) && entryCompanies().length === 0);

  const first = all[0];
  db.update(companies).set({ entryMode: "customers" }).where(eq(companies.id, first.id)).run();
  check("switching one on makes exactly that page exist", entryCompany(first.slug)?.id === first.id && entryCompanies().length === 1);
  check("...and not the others", all.slice(1).every((c) => entryCompany(c.slug) === null));
  check("an unknown name gives no page", entryCompany("no-such-company") === null);

  for (const c of all) {
    const topics = entryTopics(c.id);
    const rows = topics.map((t) => db.select({ t: tracks, b: brands }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(eq(tracks.id, t.id)).get()!);
    check(`${c.name}: every listed topic is customer-facing`, rows.every((r) => r.t.audience === "customer" || r.t.audience === "both"));
    check(`${c.name}: no staff-only topic is ever listed`, !rows.some((r) => r.t.audience === "staff"));
    const bs = new Set(db.select({ id: brands.id }).from(brands).where(eq(brands.companyId, c.id)).all().map((b) => b.id));
    const ps = new Set(db.select({ id: projects.id, b: projects.brandId, c: projects.companyId }).from(projects).all().filter((p) => p.c === c.id || (p.b != null && bs.has(p.b))).map((p) => p.id));
    check(`${c.name}: every listed topic belongs to this company`, rows.every((r) => bs.has(r.t.brandId) || (r.t.projectId != null && ps.has(r.t.projectId))));
    check(`${c.name}: every listed topic has live questions`, topics.every((t) => t.n > 0));
  }
  const listed = new Set(all.flatMap((c) => entryTopics(c.id).map((t) => t.id)));
  check("no shared academy topic is passed off as a company's own", ![...listed].some((id) => db.select({ k: brands.kind }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(eq(tracks.id, id)).get()?.k === "shared"));
} finally {
  for (const [id, mode] of before) db.update(companies).set({ entryMode: mode }).where(eq(companies.id, id)).run();
}
check("the switches are back as they were", all.every((c) => db.select().from(companies).where(eq(companies.id, c.id)).get()?.entryMode === before.get(c.id)));
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

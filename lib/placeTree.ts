import { brands, companies, db, projects } from "@/lib/db";
import type { PlaceTree } from "@/lib/placeSummary";
import { type Reach, scopeInReach } from "@/lib/tenancy";

/** Everything a person may be placed in that this manager runs: the same set limitOptions gives the old checklists, with the parents the pickers need. Shared academy brands are left out, as in scopeOptions. */
export function placeTree(reach: Reach): PlaceTree {
  const cos = db.select().from(companies).orderBy(companies.name).all();
  const bs = db.select().from(brands).orderBy(brands.name).all().filter((b) => b.kind !== "shared");
  return {
    companies: cos.filter((c) => scopeInReach(reach, { kind: "company", id: c.id })).map((c) => ({ id: c.id, name: c.name })),
    brands: bs.filter((b) => scopeInReach(reach, { kind: "brand", id: b.id })).map((b) => ({ id: b.id, name: b.name, companyId: b.companyId })),
    projects: db.select().from(projects).orderBy(projects.name).all().filter((p) => scopeInReach(reach, { kind: "project", id: p.id })).map((p) => ({ id: p.id, name: p.name, brandId: p.brandId, companyId: p.companyId })),
  };
}

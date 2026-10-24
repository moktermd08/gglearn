/** Checks what a company or brand makes required of its own people on a shared track: npm run check:scoperequirements (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, companies, db, scopeRequirements, userScopes, users } from "../lib/db";
import { catalog, requirementsFor, resetCatalogCache } from "../lib/paths";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

/** Removes every row this script makes, found by its name pattern, so a run that stopped half way never poisons the next one. */
function sweep() {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@scopereq.check")).all().map((r) => r.id);
  const cs = db.select({ id: companies.id }).from(companies).where(like(companies.slug, "t-scopereq-%")).all().map((r) => r.id);
  const bs = db.select({ id: brands.id }).from(brands).where(like(brands.slug, "t-scopereq-%")).all().map((r) => r.id);
  if (cs.length) db.delete(scopeRequirements).where(and(eq(scopeRequirements.scopeKind, "company"), inArray(scopeRequirements.scopeId, cs))).run();
  if (bs.length) db.delete(scopeRequirements).where(and(eq(scopeRequirements.scopeKind, "brand"), inArray(scopeRequirements.scopeId, bs))).run();
  if (us.length) { db.delete(userScopes).where(inArray(userScopes.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
  db.delete(brands).where(like(brands.slug, "t-scopereq-%")).run();
  db.delete(companies).where(like(companies.slug, "t-scopereq-%")).run();
  resetCatalogCache();
}
sweep();

try {
  // a shared track that has enough questions to be required, and a second one
  const shared = catalog().filter((t) => t.brand.kind === "shared" && t.audience !== "customer" && t.reach >= 5 && t.tier === "growth");
  if (shared.length < 2) { console.log("needs two shared growth tracks with questions"); process.exit(1); }
  const [topic, other] = shared;

  const a = db.insert(companies).values({ slug: "t-scopereq-a", name: "t-Company A" }).returning().get();
  const b = db.insert(companies).values({ slug: "t-scopereq-b", name: "t-Company B" }).returning().get();
  const brandA = db.insert(brands).values({ slug: "t-scopereq-a-brand", name: "t-Brand A", companyId: a.id }).returning().get();
  const person = (tag: string, role: string, scopes: { kind: "company" | "brand"; id: number }[], audience: "staff" | "customer" = "staff") => {
    const u = db.insert(users).values({ email: `t-${tag}@scopereq.check`, name: `t-${tag}`, jobRole: role, audience }).returning().get();
    for (const s of scopes) db.insert(userScopes).values({ userId: u.id, kind: s.kind, refId: s.id }).run();
    return { u, scopes };
  };
  const dev = person("dev", "developer", [{ kind: "company", id: a.id }]);
  const tester = person("tester", "tester", [{ kind: "company", id: a.id }]);
  const brandOnly = person("brandonly", "developer", [{ kind: "brand", id: brandA.id }]);
  const outsider = person("outsider", "developer", [{ kind: "company", id: b.id }]);
  const customer = person("customer", "developer", [{ kind: "company", id: a.id }], "customer");
  const needs = (p: ReturnType<typeof person>, trackId: number) => requirementsFor(p.u, p.scopes, catalog()).find((r) => r.track.id === trackId);
  const require = (kind: "company" | "brand", id: number, trackId: number, over: Partial<typeof scopeRequirements.$inferInsert> = {}) => {
    db.insert(scopeRequirements).values({ scopeKind: kind, scopeId: id, trackId, requiredLevel: 3, dueDays: 14, ...over }).run();
    resetCatalogCache();
  };

  check("nothing is required before a company asks", !needs(dev, topic.id));
  require("company", a.id, topic.id);
  check("a company's person must now pass it", !!needs(dev, topic.id));
  check("at the level and deadline the company set", needs(dev, topic.id)?.track.requiredLevel === 3 && needs(dev, topic.id)?.track.dueDays === 14);
  check("it counts as mandatory for them", needs(dev, topic.id)?.why === "mandatory");
  check("a person of another company is not asked", !needs(outsider, topic.id));
  check("a person of one of the company's brands is asked", !!needs(brandOnly, topic.id));
  check("a customer is not asked", !needs(customer, topic.id));
  check("the track's own policy is untouched", catalog().find((t) => t.id === topic.id)?.tier === "growth");
  check("another track is not asked", !needs(dev, other.id));

  // limited to roles
  db.update(scopeRequirements).set({ roles: "developer" }).where(eq(scopeRequirements.scopeId, a.id)).run(); resetCatalogCache();
  check("limited to a role, that role is asked", !!needs(dev, topic.id));
  check("and other roles in the company are not", !needs(tester, topic.id));
  check("a role requirement shows as a role requirement", needs(dev, topic.id)?.why === "role");

  // a brand's own requirement does not reach its company's other people
  db.delete(scopeRequirements).where(eq(scopeRequirements.scopeId, a.id)).run(); resetCatalogCache();
  require("brand", brandA.id, other.id);
  check("a brand's requirement reaches that brand's people", !!needs(brandOnly, other.id));
  check("and its company's people who work across it", !!needs(dev, other.id));
  check("but not another company's", !needs(outsider, other.id));

  // stopping a requirement
  db.delete(scopeRequirements).where(eq(scopeRequirements.scopeId, brandA.id)).run(); resetCatalogCache();
  check("removing it stops it being required", !needs(brandOnly, other.id));

  // two scopes asking for the same track: the stricter wins
  require("company", a.id, topic.id, { requiredLevel: 3, dueDays: 30 });
  require("brand", brandA.id, topic.id, { requiredLevel: 5, dueDays: 14 });
  const both = needs(brandOnly, topic.id);
  check("two scopes asking for one track: the higher level and shorter deadline win", both?.track.requiredLevel === 5 && both?.track.dueDays === 14);
  check("and it is listed once", requirementsFor(brandOnly.u, brandOnly.scopes, catalog()).filter((r) => r.track.id === topic.id).length === 1);
} finally {
  sweep();
}
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

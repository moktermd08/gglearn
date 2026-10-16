/** Checks company-scoped admin reach against the real structure: npm run check:tenancy (uses DATABASE_FILE or data/gglearn.db; adds and removes its own test users). */
import { eq, like } from "drizzle-orm";
import { brands, companies, db, tracks, userScopes, users } from "../lib/db";
import { isGlobal, personInReach, reachOf, scopeInReach, trackInReach, usersInReach } from "../lib/tenancy";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const co = (slug: string) => db.select().from(companies).where(eq(companies.slug, slug)).get()!;
const moksy = co("moksy-limited"), guru = co("guru-graphics-limited");
const mk = (email: string, role: "admin" | "manager" | "learner", scopes: { kind: "company" | "brand" | "project"; refId: number }[]) => {
  const u = db.insert(users).values({ email, name: email, role }).returning().get();
  for (const s of scopes) db.insert(userScopes).values({ userId: u.id, ...s }).run();
  return u;
};
try {
  const owner = mk("t-owner@check.local", "admin", []);
  const mMgr = mk("t-moksy-mgr@check.local", "manager", [{ kind: "company", refId: moksy.id }]);
  const mLearner = mk("t-moksy-l@check.local", "learner", [{ kind: "company", refId: moksy.id }]);
  const gLearner = mk("t-guru-l@check.local", "learner", [{ kind: "company", refId: guru.id }]);
  const loose = mk("t-loose@check.local", "learner", []);

  check("manager with no scopes runs everything", isGlobal(reachOf(owner.id)));
  check("manager with a company scope is not global", !isGlobal(reachOf(mMgr.id)));
  const ids = usersInReach(reachOf(mMgr.id))!;
  check("sees their own company's learner", ids.has(mLearner.id));
  check("does not see another company's learner", !ids.has(gLearner.id));
  check("does not see a person with no scopes", !ids.has(loose.id));
  check("platform owner sees everyone (null = all)", usersInReach(reachOf(owner.id)) === null);

  const r = reachOf(mMgr.id);
  check("may grant their own company", scopeInReach(r, { kind: "company", id: moksy.id }));
  check("may not grant another company", !scopeInReach(r, { kind: "company", id: guru.id }));
  const moksyBrand = db.select().from(brands).where(eq(brands.companyId, moksy.id)).get()!;
  const guruBrand = db.select().from(brands).where(eq(brands.companyId, guru.id)).get()!;
  check("may grant a brand beneath their company", scopeInReach(r, { kind: "brand", id: moksyBrand.id }));
  check("may not grant another company's brand", !scopeInReach(r, { kind: "brand", id: guruBrand.id }));
  check("a brand-only person in the company is reachable", personInReach(r, [{ kind: "brand", id: moksyBrand.id }]));

  const all = db.select().from(tracks).all();
  const mine = all.filter((t) => trackInReach(r, t)), theirs = all.filter((t) => !trackInReach(r, t));
  check("own company's tracks are in reach", mine.some((t) => t.brandId === moksyBrand.id));
  check("shared academy and other companies' tracks are not", theirs.length > 0 && !mine.some((t) => t.brandId === guruBrand.id));
  const shared = db.select().from(brands).where(eq(brands.kind, "shared")).all().map((b) => b.id);
  check("no shared-brand track is in reach", !mine.some((t) => shared.includes(t.brandId)));
} finally {
  const t = db.select().from(users).where(like(users.email, "t-%@check.local")).all();
  for (const u of t) { db.delete(userScopes).where(eq(userScopes.userId, u.id)).run(); db.delete(users).where(eq(users.id, u.id)).run(); }
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);

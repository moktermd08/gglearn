/**
 * Checks the People page's building blocks: npm run check:peoplepage (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows. Run db:push first).
 * What a person may be placed in (placeTree), how places read in plain words (placeSummary), and the place-change rules the edit panel runs
 * (changePlaces): the same rules the page always had, so a manager still cannot reach, move or promote beyond what they run.
 */
import { eq, inArray } from "drizzle-orm";
import { brands, companies, db, notifications, projects, userScopes, users } from "../lib/db";
import { changePlaces } from "../lib/placeChange";
import { placeTree } from "../lib/placeTree";
import { summarisePlaces, tidyScopes, coveredBrand, type PlaceTree } from "../lib/placeSummary";
import { mayChangeRole } from "../lib/roleChange";
import { grantableLevels, refuseAccess } from "../lib/accessLevel";
import { reachOf, scopeInReach } from "../lib/tenancy";
import { scopesOf, type Scope } from "../lib/paths";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- pure: plain-words summary and tidy (no database)
const T: PlaceTree = {
  companies: [{ id: 1, name: "Acme Ltd" }, { id: 2, name: "Beta Ltd" }],
  brands: [{ id: 10, name: "Acme One", companyId: 1 }, { id: 11, name: "Acme Two", companyId: 1 }, { id: 20, name: "Solo", companyId: null }],
  projects: [{ id: 100, name: "Site", brandId: 10, companyId: 1 }, { id: 101, name: "App", brandId: null, companyId: 2 }],
};
const co = (id: number): Scope => ({ kind: "company", id }), br = (id: number): Scope => ({ kind: "brand", id }), pr = (id: number): Scope => ({ kind: "project", id });
check("a company reads as itself and its brands", summarisePlaces(T, [co(1)]).text === "Acme Ltd and its 2 brands");
check("a company with no brand reads as just its name", summarisePlaces(T, [co(2)]).text === "Beta Ltd");
check("a brand under a ticked company adds nothing", summarisePlaces(T, [co(1), br(10)]).text === "Acme Ltd and its 2 brands" && coveredBrand(T, [co(1)], 10));
check("a brand on its own is named as a brand", summarisePlaces(T, [br(20)]).text === "Solo (brand)");
check("a project is never covered by its company (its learning is separate)", summarisePlaces(T, [co(1), pr(100)]).text === "Acme Ltd and its 2 brands; 1 project: Site");
check("nothing picked reads as empty", summarisePlaces(T, []).parts.length === 0);
check("tidyScopes drops only the covered brand", JSON.stringify(tidyScopes(T, [co(1), br(10), br(20), pr(100)])) === JSON.stringify([co(1), br(20), pr(100)]));

// ---- database: what each kind of person may be offered and may do
const cos = db.select().from(companies).orderBy(companies.id).limit(2).all();
if (cos.length < 2) { console.log("needs two companies in the database"); process.exit(1); }
const [A, B] = cos.map((c) => c.id);
const brandA = db.select().from(brands).where(eq(brands.companyId, A)).get();
const brandB = db.select().from(brands).where(eq(brands.companyId, B)).get();
if (!brandA || !brandB) { console.log("needs a brand in each of two companies"); process.exit(1); }
const made: number[] = [];
const person = (tag: string, role: "learner" | "manager" | "admin", scopes: Scope[], extra: Partial<typeof users.$inferInsert> = {}) => {
  const u = db.insert(users).values({ email: `t-${tag}@peoplepage.check`, name: `t-${tag}`, jobRole: "developer", role, ...extra }).returning().get();
  made.push(u.id);
  for (const s of scopes) db.insert(userScopes).values({ userId: u.id, kind: s.kind, refId: s.id }).run();
  return u;
};
const idsOf = (rows: { id: number }[]) => rows.map((r) => r.id).sort((a, b) => a - b).join();
const placesOf = (id: number) => scopesOf(id).map((s) => `${s.kind}:${s.id}`).sort().join();

try {
  const owner = person("owner", "admin", []);
  const adminA = person("adminA", "admin", [co(A)]);
  const mgrA = person("mgrA", "manager", [co(A)]);
  const mgrBrand = person("mgrBrand", "manager", [br(brandA.id)]);
  const learnerA = person("learnerA", "learner", [co(A)]);
  const learnerB = person("learnerB", "learner", [co(B)]);
  const mgrB2 = person("mgrB2", "manager", [co(B)]);
  const gone = person("gone", "learner", [co(A)], { status: "offboarded" });

  // what the pickers offer
  const all = placeTree(reachOf(owner.id)), tA = placeTree(reachOf(mgrA.id)), tBrand = placeTree(reachOf(mgrBrand.id));
  const everyCompany = db.select().from(companies).all(), everyProject = db.select().from(projects).all();
  check("the platform owner is offered every company", idsOf(all.companies) === idsOf(everyCompany));
  check("the platform owner is offered every project", idsOf(all.projects) === idsOf(everyProject));
  check("shared academy brands are never offered", all.brands.every((b) => db.select().from(brands).where(eq(brands.id, b.id)).get()!.kind !== "shared"));
  check("a manager of one company is offered only that company", idsOf(tA.companies) === String(A));
  check("...and only brands that are under it", tA.brands.length > 0 && tA.brands.every((b) => b.companyId === A));
  check("...and none of the other company's brands or projects", !tA.brands.some((b) => b.id === brandB.id) && tA.projects.every((p) => p.companyId === A || tA.brands.some((b) => b.id === p.brandId)));
  check("a manager of one brand is offered no company", tBrand.companies.length === 0);
  check("...only that brand, and projects under it", idsOf(tBrand.brands) === String(brandA.id) && tBrand.projects.every((p) => p.brandId === brandA.id));
  check("every place offered is one the person's reach covers", [...tA.companies.map((c) => co(c.id)), ...tA.brands.map((b) => br(b.id)), ...tA.projects.map((p) => pr(p.id))].every((s) => scopeInReach(reachOf(mgrA.id), s)));

  // who may be offered what
  check("a manager is offered no access levels above learner", grantableLevels(mgrA).length === 0);
  check("a company admin is offered manager only", grantableLevels(adminA).join() === "manager");
  check("only the owner is offered admin", grantableLevels(owner).join() === "manager,admin");
  check("a manager cannot make a manager", !!refuseAccess(mgrA, "manager", [co(A)], "staff"));
  check("a customer cannot be made a manager even by the owner", !!refuseAccess(owner, "manager", [co(A)], "customer"));
  check("a manager may change a learner's role in reach", mayChangeRole(mgrA, learnerA) === null);
  check("a manager may not change a manager's role", !!mayChangeRole(mgrA, mgrB2) && !!mayChangeRole(mgrA, { ...learnerA, role: "manager" }));
  check("nobody changes their own role", !!mayChangeRole(adminA, adminA));
  check("a manager may not change a learner of another company", !!mayChangeRole(mgrA, learnerB));

  // moving a person (the edit panel's "where they belong")
  check("a manager places a learner in a brand of their company", changePlaces(mgrA.id, learnerA.id, [br(brandA.id)]) === null && placesOf(learnerA.id) === `brand:${brandA.id}`);
  check("a manager places a learner back in the company", changePlaces(mgrA.id, learnerA.id, [co(A)]) === null && placesOf(learnerA.id) === `company:${A}`);
  check("a manager cannot place anyone in another company", !!changePlaces(mgrA.id, learnerA.id, [co(B)]) && placesOf(learnerA.id) === `company:${A}`);
  check("...nor add another company beside their own", !!changePlaces(mgrA.id, learnerA.id, [co(A), co(B)]) && placesOf(learnerA.id) === `company:${A}`);
  check("a manager cannot move someone they do not run", !!changePlaces(mgrA.id, learnerB.id, [co(A)]) && placesOf(learnerB.id) === `company:${B}`);
  check("a brand manager cannot place a learner in the whole company", !!changePlaces(mgrBrand.id, learnerA.id, [co(A)]));
  check("a manager cannot leave a manager with no place (that would run everything)", !!changePlaces(mgrA.id, mgrB2.id, []) && placesOf(mgrB2.id) === `company:${B}`);
  check("a company admin may clear a learner's places", changePlaces(adminA.id, learnerA.id, []) === null && placesOf(learnerA.id) === "");
  check("...but then a company admin no longer reaches that learner", !!changePlaces(adminA.id, learnerA.id, [co(A)]) && placesOf(learnerA.id) === "");
  check("only the owner reaches someone with no place", changePlaces(owner.id, learnerA.id, [co(A)]) === null && placesOf(learnerA.id) === `company:${A}`);
  check("the owner may put a person anywhere", changePlaces(owner.id, learnerB.id, [co(A), co(B)]) === null && placesOf(learnerB.id) === [`company:${A}`, `company:${B}`].sort().join());
  check("the owner may leave a manager with no place", changePlaces(owner.id, mgrB2.id, []) === null && placesOf(mgrB2.id) === "");
  check("an offboarded person cannot be moved", !!changePlaces(owner.id, gone.id, [co(B)]) && placesOf(gone.id) === `company:${A}`);
  check("an unknown person is refused", !!changePlaces(owner.id, 999999999, [co(A)]));
} finally {
  if (made.length) {
    db.delete(notifications).where(inArray(notifications.userId, made)).run();
    db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
    db.delete(users).where(inArray(users.id, made)).run();
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

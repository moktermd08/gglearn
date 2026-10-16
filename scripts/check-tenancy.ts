/** Checks company-scoped admin reach against the real structure: npm run check:tenancy (uses DATABASE_FILE or data/gglearn.db; adds and removes its own test users). */
import { eq, like } from "drizzle-orm";
import { brands, companies, db, tracks, userScopes, users } from "../lib/db";
import { addBrand, addCompany, addTrack, saveBranding, uniqueSlug } from "../lib/setup";
import { DEFAULT_LOOK, lookFor, lookOfCompany, readableWithWhite } from "../lib/brand";
import { isGlobal, personInReach, reachOf, scopeInReach, trackInReach, usersInReach } from "../lib/tenancy";

let fails = 0;
const shared0 = () => db.select().from(brands).where(eq(brands.kind, "shared")).get()!.id;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const co = (slug: string) => db.select().from(companies).where(eq(companies.slug, slug)).get()!;
const moksy = co("moksy-limited"), guru = co("guru-graphics-limited");
const mk = (email: string, role: "admin" | "manager" | "learner", scopes: { kind: "company" | "brand" | "project"; refId: number }[]) => {
  const u = db.insert(users).values({ email, name: email, role }).returning().get();
  for (const s of scopes) db.insert(userScopes).values({ userId: u.id, ...s }).run();
  return u;
};
(async () => {
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

  // ---- setup: who may add a company, brand and track ----
  const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };
  const mAdmin = mk("t-moksy-admin@check.local", "admin", [{ kind: "company", refId: moksy.id }]);
  const trackForm = (brandId: number, name: string) => form({ brandId: String(brandId), name, description: "", kind: "process", scope: "brand", tier: "growth", audience: "staff", requiredLevel: "5", dueDays: "30", roles: "Sales, sales , support" });

  check("a manager cannot add a company", !!addCompany(mMgr, form({ name: "Zz Check Co" }))?.error);
  check("a company admin cannot add a company", !!addCompany(mAdmin, form({ name: "Zz Check Co" }))?.error);
  check("the platform owner adds a company", !!addCompany(owner, form({ name: "Zz Check Co", tagline: "x" }))?.done);
  check("a duplicate company name is refused", !!addCompany(owner, form({ name: "zz check co" }))?.error);
  const zz = db.select().from(companies).where(eq(companies.slug, "zz-check-co")).get()!;
  check("the company slug comes from the name", !!zz);
  check("a company admin cannot add a brand to another company", !!addBrand(mAdmin, form({ companyId: String(zz.id), name: "Zz Brand" }))?.error);
  check("a manager cannot add a brand", !!addBrand(mMgr, form({ companyId: String(moksy.id), name: "Zz Brand" }))?.error);
  check("a company admin adds a brand to their own company", !!addBrand(mAdmin, form({ companyId: String(moksy.id), name: "Zz Brand" }))?.done);
  check("the platform owner adds a brand anywhere", !!addBrand(owner, form({ companyId: String(zz.id), name: "Zz Other Brand" }))?.done);
  const zb = db.select().from(brands).where(eq(brands.slug, "zz-brand")).get()!;
  const zo = db.select().from(brands).where(eq(brands.slug, "zz-other-brand")).get()!;
  check("a new brand belongs to its company", zb?.companyId === moksy.id && zb.kind === "company");
  check("a company admin cannot add a track to another company's brand", !!addTrack(mAdmin, trackForm(zo.id, "Zz Track"))?.error);
  check("a company admin adds a track to their own brand", !!addTrack(mAdmin, trackForm(zb.id, "Zz Track"))?.done);
  const zt = db.select().from(tracks).where(eq(tracks.slug, "zz-track")).get()!;
  check("the track is saved with cleaned roles and an admin policy", zt?.roles === "sales,support" && zt.policySource === "admin" && zt.tier === "growth");
  check("a second track with the same name gets a new slug", !!addTrack(owner, trackForm(zb.id, "Zz Track"))?.done && uniqueSlug("tracks", "Zz Track") === "zz-track-3");
  check("a shared academy brand takes no tracks", !!addTrack(owner, trackForm(shared0(), "Zz Shared"))?.error);
  check("bad numbers are refused", !!addTrack(owner, form({ brandId: String(zb.id), name: "Zz Bad", kind: "process", scope: "brand", tier: "growth", audience: "staff", requiredLevel: "99", dueDays: "30" }))?.error);

  // ---- branding ----
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  const brandForm = (o: Record<string, string>, file?: File) => { const fd = form({ companyId: String(moksy.id), academyName: "", certIssuer: "", accent: "", ...o }); if (file) fd.set("logo", file); return fd; };
  check("white text is readable on indigo but not on yellow", readableWithWhite("#4f46e5") && !readableWithWhite("#ffe066"));
  check("a manager cannot change branding", !!(await saveBranding(mMgr, brandForm({ academyName: "X" })))?.error);
  check("a company admin cannot brand another company", !!(await saveBranding(mAdmin, brandForm({ companyId: String(guru.id), academyName: "X" })))?.error);
  check("a too-light colour is refused", !!(await saveBranding(mAdmin, brandForm({ accent: "#ffe066" })))?.error);
  check("a malformed colour is refused", !!(await saveBranding(mAdmin, brandForm({ accent: "blue" })))?.error);
  check("a non-image logo is refused", !!(await saveBranding(mAdmin, brandForm({}, new File([new Uint8Array(64)], "a.png", { type: "image/png" }))))?.error);
  check("an oversized logo is refused", !!(await saveBranding(mAdmin, brandForm({}, new File([new Uint8Array(200 * 1024)], "a.png"))))?.error);
  const before = db.select().from(companies).where(eq(companies.id, moksy.id)).get()!;
  const ok = await saveBranding(mAdmin, brandForm({ academyName: "Moksy Academy", certIssuer: "Moksy Limited", accent: "#0f766e" }, new File([png], "logo.png", { type: "image/png" })));
  check("a company admin brands their own company", !!ok?.done);
  const look = lookFor(mLearner.id);
  check("their people see the company look", look.name === "Moksy Academy" && look.accent === "#0f766e" && !!look.logo && look.issuer === "Moksy Limited" && look.company === moksy.name);
  check("another company's people still see the default", lookFor(gLearner.id).name === DEFAULT_LOOK.name && lookFor(gLearner.id).logo === null);
  check("a person with no company sees the default", lookFor(loose.id) === DEFAULT_LOOK || lookFor(loose.id).company === null);
  const twoCo = mk("t-two@check.local", "learner", [{ kind: "company", refId: moksy.id }, { kind: "company", refId: guru.id }]);
  check("a person in two companies sees the default", lookFor(twoCo.id).company === null);
  const viaBrand = mk("t-brand@check.local", "learner", [{ kind: "brand", refId: moksyBrand.id }]);
  check("a brand-only person gets their brand's company look", lookFor(viaBrand.id).name === "Moksy Academy");
  await saveBranding(mAdmin, brandForm({ accent: "#4f46e5", removeLogo: "on" }));
  const cleared = lookOfCompany(moksy.id);
  check("the standard shade clears the colour, an empty name resets to the default, and the logo can be removed", cleared.accent === null && cleared.logo === null && cleared.name === DEFAULT_LOOK.name);
  db.update(companies).set({ academyName: before.academyName, certIssuer: before.certIssuer, accent: before.accent, logo: before.logo }).where(eq(companies.id, moksy.id)).run();
} finally {
  const t = db.select().from(users).where(like(users.email, "t-%@check.local")).all();
  for (const tr of db.select().from(tracks).where(like(tracks.slug, "zz-%")).all()) db.delete(tracks).where(eq(tracks.id, tr.id)).run();
  for (const b of db.select().from(brands).where(like(brands.slug, "zz-%")).all()) db.delete(brands).where(eq(brands.id, b.id)).run();
  for (const c of db.select().from(companies).where(like(companies.slug, "zz-%")).all()) db.delete(companies).where(eq(companies.id, c.id)).run();
  for (const u of t) { db.delete(userScopes).where(eq(userScopes.userId, u.id)).run(); db.delete(users).where(eq(users.id, u.id)).run(); }
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
})();

/** Checks company-scoped admin reach against the real structure: npm run check:tenancy (uses DATABASE_FILE or data/gglearn.db; adds and removes its own test users). */
import { eq, like } from "drizzle-orm";
import { brands, certificateEvents, invites, certificates, companies, competitions, db, notifications, rewardAwards, rewardRules, runs, seasonClosed, seasonResults, tracks, userBadges, userScopes, users } from "../lib/db";
import { addBrand, addCompany, addTrack, saveBranding, uniqueSlug } from "../lib/setup";
import { awardForPass, bonusXp, rulesFor } from "../lib/rewards";
import { removeRule, saveRule, settleAward } from "../lib/rewardsAdmin";
import { arenaOf, isPlatformOwner } from "../lib/arena";
import { listFor, listedFor } from "../lib/competitions";
import { groupsOf } from "../lib/groups";
import { periodAt, settle, standings } from "../lib/seasons";
import { DEFAULT_LOOK, lookFor, lookOfCompany, readableWithWhite } from "../lib/brand";
import { expiryWatch, expiryWatchFor, reinstateCertificate, revokeCertificate } from "../lib/certsAdmin";
import { progressionFor } from "../lib/progression";
import { glanceCounts } from "../lib/glance";
import { resolveScope, scopeChoices } from "../lib/adminScope";
import { catalog, complianceReport, loadProgress, requirementsFor, resetCatalogCache, scopesOf } from "../lib/paths";
import { EXPIRED_NOTICE_DAYS, REMINDER_DAYS, noteExpiringCertificates, RENEW_WINDOW_DAYS, certState, signatureOf, signatureStatus } from "../lib/certs";
import { canSeeAvatar } from "../lib/competitions";
import { awaitingSignoff, canSignOff, onboardingFor } from "../lib/onboarding";
import { isGlobal, personInReach, reachOf, scopeInReach, trackInReach, usersInReach } from "../lib/tenancy";

process.env.CATALOG_TTL_MS = "0"; process.env.GLANCE_TTL_MS = "0"; // the script changes tracks and questions directly, so it must never read a cached catalogue
process.env.SESSION_SECRET ??= "check-tenancy-only-secret-0123456789"; // the certificate signature is keyed with it
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

  check("onboarding sign-off: manager signs their own company's learner", canSignOff(mMgr, mLearner.id));
  check("onboarding sign-off: not another company's learner", !canSignOff(mMgr, gLearner.id));
  check("onboarding sign-off: not someone with no scopes", !canSignOff(mMgr, loose.id));
  check("onboarding sign-off: nobody signs themselves, even the platform owner", !canSignOff(mMgr, mMgr.id) && !canSignOff(owner, owner.id));
  check("onboarding sign-off: the platform owner signs anyone else", canSignOff(owner, gLearner.id));
  check("onboarding sign-off: a learner cannot sign", !canSignOff(mLearner, gLearner.id));

  const mColleague = mk("t-moksy-col@check.local", "learner", [{ kind: "company", refId: moksy.id }]);
  check("avatar: a colleague in the same company sees a photo", canSeeAvatar(mLearner.id, { id: mColleague.id }));
  check("avatar: a person sees their own", canSeeAvatar(mLearner.id, { id: mLearner.id }));
  check("avatar: another company's person does not", !canSeeAvatar(mLearner.id, { id: gLearner.id }));
  check("avatar: a signed-out stranger does not", !canSeeAvatar(mLearner.id, null));
  check("avatar: the platform owner sees it", canSeeAvatar(mLearner.id, { id: owner.id }));

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
  // ---- boards: who competes with whom ----
  const now = Math.floor(Date.now() / 1000), anyTrack = db.select().from(tracks).get()!;
  const mLearner2 = mk("t-moksy-l2@check.local", "learner", [{ kind: "company", refId: moksy.id }]);
  const arenaM = `c${moksy.id}`, arenaG = `c${guru.id}`;
  check("a one-company person's arena is that company", arenaOf(mLearner.id) === arenaM && arenaOf(gLearner.id) === arenaG);
  check("people in several companies, or none, share the open arena", arenaOf(twoCo.id) === "open" && arenaOf(loose.id) === "open");
  check("only an admin with no scopes is a platform owner", isPlatformOwner(owner.id) && !isPlatformOwner(mAdmin.id) && !isPlatformOwner(mMgr.id));
  const finished = (userId: number, level: number, at: number) => db.insert(runs).values({ userId, trackId: anyTrack.id, level, score: 1, passed: true, startedAt: at, finishedAt: at }).run();
  for (const u of [mLearner, mLearner2, gLearner, loose]) finished(u.id, 1, now);
  finished(mLearner.id, 2, now);
  const week = periodAt("week");
  const idsIn = (arena?: string) => new Set(standings(week, "staff", undefined, arena).map((r) => r.userId));
  const [im, ig, io, ia] = [idsIn(arenaM), idsIn(arenaG), idsIn("open"), idsIn()];
  check("a company's board holds only its own people", im.has(mLearner.id) && im.has(mLearner2.id) && !im.has(gLearner.id) && !im.has(loose.id));
  check("another company's board does not hold them", ig.has(gLearner.id) && !ig.has(mLearner.id));
  check("the open board holds no company people", io.has(loose.id) && !io.has(mLearner.id) && !io.has(gLearner.id));
  check("with no arena everyone is still ranked together", [mLearner, mLearner2, gLearner, loose].every((u) => ia.has(u.id)));
  check("the leader of a company board is ranked first", standings(week, "staff", undefined, arenaM)[0].userId === mLearner.id);
  const roleGroups = groupsOf("role", arenaM);
  const arenaMembers = new Set([mLearner.id, mLearner2.id]);
  check("group boards list only the viewer's arena", roleGroups.every((g) => g.memberIds.every((id) => arenaMembers.has(id) || arenaOf(id) === arenaM)) && groupsOf("company", arenaG).every((g) => !g.memberIds.includes(mLearner.id)));
  // a settled season ranks each arena on its own
  const old = periodAt("week", now - 140 * 86400);
  for (const u of [mLearner, mLearner2, gLearner, loose]) finished(u.id, 1, old.start + 3600);
  finished(mLearner.id, 2, old.start + 7200);
  settle(old);
  const res = (id: number) => db.select().from(seasonResults).where(eq(seasonResults.userId, id)).all().find((r) => r.key === old.key)!;
  check("settled seasons rank each arena separately", res(mLearner.id).rank === 1 && res(mLearner.id).players === 2 && res(mLearner2.id).rank === 2 && res(gLearner.id).rank === 1 && res(gLearner.id).players === 1);

  // contests: open races stay inside the organiser's arena; the platform owner's are for everyone
  const contest = (slug: string, by: number) => db.insert(competitions).values({ slug, title: slug, trackId: anyTrack.id, createdBy: by, visibility: "public", joinPolicy: "open", goalLevels: 1, startsAt: now - 60, endsAt: now + 86400 }).returning().get();
  const cM = contest("zz-c-moksy", mLearner.id), cO = contest("zz-c-owner", owner.id);
  check("a company's open contest is listed to its own people", listedFor(mLearner2.id, mLearner.id));
  check("but not to another company or the open arena", !listedFor(gLearner.id, mLearner.id) && !listedFor(loose.id, mLearner.id) && !listedFor(null, mLearner.id));
  check("the platform owner's contest is listed to everyone", [mLearner2, gLearner, loose].every((u) => listedFor(u.id, owner.id)) && listedFor(null, owner.id));
  const seen = (id: number) => new Set(listFor({ id } as never).map((x) => x.c.id));
  check("the contest list follows the same rule", seen(mLearner2.id).has(cM.id) && !seen(gLearner.id).has(cM.id) && seen(gLearner.id).has(cO.id));
  check("an organiser always sees their own contest", seen(mLearner.id).has(cM.id));

  // ---- rewards: who gives what for passing a level ----
  const rf = (o: Record<string, string>) => form({ enabled: "on", amount: "", currency: "", label: "", maxAwards: "", ...o });
  const slot = (scope: string, refId: number, level: number, kind: string, o: Record<string, string> = {}) => rf({ scope, refId: String(refId), level: String(level), kind, ...o });
  const certsOf = (u: number, lvl: number) => db.select().from(certificates).where(eq(certificates.userId, u)).all().filter((c) => c.trackId === zt.id && c.level === lvl).length;
  check("a manager cannot set rewards", !!saveRule(mMgr, slot("track", zt.id, 3, "xp", { amount: "50" }))?.error);
  check("a company admin cannot set rewards on another company's track", !!saveRule(mAdmin, slot("company", guru.id, 3, "xp", { amount: "50" }))?.error);
  check("bonus XP must be a sensible whole number", !!saveRule(mAdmin, slot("track", zt.id, 3, "xp", { amount: "0" }))?.error && !!saveRule(mAdmin, slot("track", zt.id, 3, "xp", { amount: "999999" }))?.error);
  check("money needs a currency, an amount and a cap", !!saveRule(mAdmin, slot("track", zt.id, 3, "money", { amount: "20", currency: "GBP" }))?.error && !!saveRule(mAdmin, slot("track", zt.id, 3, "money", { amount: "20", currency: "XXX", maxAwards: "5" }))?.error && !!saveRule(mAdmin, slot("track", zt.id, 3, "money", { amount: "0", currency: "GBP", maxAwards: "5" }))?.error);
  check("a voucher needs a label and a cap", !!saveRule(mAdmin, slot("track", zt.id, 3, "voucher", { maxAwards: "5" }))?.error && !!saveRule(mAdmin, slot("track", zt.id, 3, "voucher", { label: "Coffee" }))?.error);

  check("with no rules a pass at level 3 earns nothing", rulesFor(zt.id, 3).length === 0 && awardForPass(mLearner.id, zt.id, 3, 0.9).length === 0);
  awardForPass(mLearner.id, zt.id, 5, 0.9);
  check("the academy default still gives a certificate at level 5", certsOf(mLearner.id, 5) === 1);
  check("and not at level 3", certsOf(mLearner.id, 3) === 0);

  check("a company admin sets a company-wide bonus XP rule", !!saveRule(mAdmin, slot("company", moksy.id, 3, "xp", { amount: "100" }))?.done);
  check("a track rule overrides the company's", !!saveRule(mAdmin, slot("track", zt.id, 3, "xp", { amount: "40" }))?.done && rulesFor(zt.id, 3).find((r) => r.kind === "xp")?.amount === 40);
  const first = awardForPass(mLearner.id, zt.id, 3, 0.9);
  check("passing gives the bonus XP once", first.length === 1 && first[0].status === "granted" && bonusXp(mLearner.id) === 40);
  check("passing again does not pay twice", awardForPass(mLearner.id, zt.id, 3, 0.95).length === 0 && bonusXp(mLearner.id) === 40);
  check("another person earns their own", awardForPass(mLearner2.id, zt.id, 3, 0.8).length === 1 && bonusXp(mLearner2.id) === 40);
  check("a track switched off ends the search", (saveRule(mAdmin, slot("track", zt.id, 3, "xp", { enabled: "off" })), rulesFor(zt.id, 3).length === 0));

  check("a certificate rule at another level issues one", !!saveRule(mAdmin, slot("brand", zb.id, 3, "certificate"))?.done && (awardForPass(mLearner2.id, zt.id, 3, 0.9), certsOf(mLearner2.id, 3) === 1));
  check("switching the certificate off removes the default", !!saveRule(mAdmin, slot("brand", zb.id, 5, "certificate", { enabled: "off" }))?.done && (awardForPass(mLearner2.id, zt.id, 5, 0.9), certsOf(mLearner2.id, 5) === 0));

  check("a money rule is capped at its limit", !!saveRule(mAdmin, slot("track", zt.id, 4, "money", { amount: "25.50", currency: "GBP", maxAwards: "1" }))?.done);
  const pay1 = awardForPass(mLearner.id, zt.id, 4, 0.9), pay2 = awardForPass(mLearner2.id, zt.id, 4, 0.9);
  check("the first winner gets a pending award in minor units", pay1.length === 1 && pay1[0].status === "pending" && pay1[0].amount === 2550 && pay1[0].currency === "GBP");
  check("the second gets nothing once the cap is reached", pay2.length === 0);
  check("a manager cannot settle it", !!settleAward(mMgr, form({ awardId: String(pay1[0].id), to: "fulfilled", reference: "x" }))?.error);
  check("another company's admin cannot settle it", (() => { const g = mk("t-guru-admin@check.local", "admin", [{ kind: "company", refId: guru.id }]); return !!settleAward(g, form({ awardId: String(pay1[0].id), to: "fulfilled", reference: "x" }))?.error; })());
  check("fulfilling needs a reference", !!settleAward(mAdmin, form({ awardId: String(pay1[0].id), to: "fulfilled", reference: "" }))?.error);
  check("the company admin marks it sent", !!settleAward(mAdmin, form({ awardId: String(pay1[0].id), to: "fulfilled", reference: "BACS-1" }))?.done);
  check("it cannot be settled twice", !!settleAward(mAdmin, form({ awardId: String(pay1[0].id), to: "void", reference: "" }))?.error);
  check("the learner was told", db.select().from(notifications).where(eq(notifications.userId, mLearner.id)).all().some((n) => n.key === `reward-paid-${pay1[0].id}`));
  const voided = (saveRule(mAdmin, slot("track", zt.id, 6, "voucher", { label: "Team lunch", maxAwards: "1" })), awardForPass(mLearner.id, zt.id, 6, 0.9)[0]);
  check("a voided award frees its place under the cap", settleAward(mAdmin, form({ awardId: String(voided.id), to: "void", reference: "" }))?.done !== undefined && awardForPass(mLearner2.id, zt.id, 6, 0.9).length === 1);
  const ruleToRemove = db.select().from(rewardRules).where(eq(rewardRules.kind, "voucher")).get()!;
  check("removing a rule keeps the awards already given", !!removeRule(mAdmin, ruleToRemove.id)?.done && db.select().from(rewardAwards).where(eq(rewardAwards.ruleId, ruleToRemove.id)).all().length === 2);
  check("a manager cannot remove rules", !!removeRule(mMgr, ruleToRemove.id)?.error);

  // ---- certificates: expiry, signatory and signature ----
  const certAt = (u: number, lvl: number) => db.select().from(certificates).where(eq(certificates.userId, u)).all().find((c) => c.trackId === zt.id && c.level === lvl)!;
  const DAYS = 86400, nowS = Math.floor(Date.now() / 1000);
  awardForPass(loose.id, zt.id, 10, 0.9);
  check("a person in no company gets a certificate that never expires, with no signatory", certAt(loose.id, 10).expiresAt === null && certAt(loose.id, 10).signer === "" && certState(certAt(loose.id, 10)).state === "permanent");
  db.update(companies).set({ certValidMonths: 12, certSigner: "Test Signer", certSignerTitle: "Head of Learning" }).where(eq(companies.id, moksy.id)).run();
  awardForPass(mLearner.id, zt.id, 10, 0.9);
  const mc = certAt(mLearner.id, 10);
  check("a company's validity sets the expiry on a new certificate", mc.expiresAt !== null && Math.abs(mc.expiresAt - (nowS + 365 * DAYS)) < 3 * DAYS && certState(mc).state === "valid");
  check("the signatory is copied onto it", mc.signer === "Test Signer" && mc.signerTitle === "Head of Learning");
  check("it carries a signature that verifies", mc.signature.length === 20 && signatureStatus(mc) === "valid");
  check("another company's setting does not apply", (awardForPass(gLearner.id, zt.id, 10, 0.9), certAt(gLearner.id, 10).expiresAt === null));
  db.update(companies).set({ certValidMonths: 24, certSigner: "Someone Else" }).where(eq(companies.id, moksy.id)).run();
  check("changing the company's policy does not rewrite a certificate already given", certAt(mLearner.id, 10).expiresAt === mc.expiresAt && certAt(mLearner.id, 10).signer === "Test Signer" && signatureStatus(certAt(mLearner.id, 10)) === "valid");
  awardForPass(mLearner.id, zt.id, 10, 0.95);
  check("passing again while the certificate is current leaves it alone", certAt(mLearner.id, 10).expiresAt === mc.expiresAt && certAt(mLearner.id, 10).renewedAt === null);
  const tamper = (patch: Partial<typeof mc>) => { db.update(certificates).set(patch).where(eq(certificates.id, mc.id)).run(); return signatureStatus(certAt(mLearner.id, 10)); };
  check("a changed expiry no longer matches the signature", tamper({ expiresAt: mc.expiresAt! + 400 * DAYS }) === "altered");
  check("nor does a changed score", tamper({ expiresAt: mc.expiresAt, score: 0.5 }) === "altered");
  check("restoring the record makes it verify again", tamper({ score: mc.score }) === "valid");
  check("an unsigned legacy certificate is reported as unsigned, not altered", tamper({ signature: "" }) === "unsigned" && (tamper({ signature: signatureOf(mc) }) === "valid"));
  db.update(certificates).set({ expiresAt: nowS + 10 * DAYS, signature: signatureOf({ ...mc, expiresAt: nowS + 10 * DAYS }) }).where(eq(certificates.id, mc.id)).run();
  check("a certificate inside the renewal window reads as expiring", certState(certAt(mLearner.id, 10)).state === "expiring" && RENEW_WINDOW_DAYS >= 10);
  awardForPass(mLearner.id, zt.id, 10, 0.9);
  const renewed = certAt(mLearner.id, 10);
  check("passing again inside the window renews it from now, with the company's current policy", renewed.renewedAt !== null && Math.abs(renewed.expiresAt! - (nowS + 730 * DAYS)) < 3 * DAYS && renewed.signer === "Someone Else" && signatureStatus(renewed) === "valid");
  check("a renewal keeps the original code and issue date", renewed.code === mc.code && renewed.issuedAt === mc.issuedAt);
  db.update(certificates).set({ expiresAt: nowS - 5 * DAYS, signature: signatureOf({ ...renewed, expiresAt: nowS - 5 * DAYS }) }).where(eq(certificates.id, mc.id)).run();
  check("a certificate past its date reads as expired", certState(certAt(mLearner.id, 10)).state === "expired");
  awardForPass(mLearner.id, zt.id, 10, 0.9);
  check("passing again after expiry renews it", certState(certAt(mLearner.id, 10)).state === "valid" && signatureStatus(certAt(mLearner.id, 10)) === "valid");
  db.update(companies).set({ certValidMonths: 0 }).where(eq(companies.id, moksy.id)).run();
  db.update(certificates).set({ expiresAt: nowS - 5 * DAYS }).where(eq(certificates.id, mc.id)).run();
  awardForPass(mLearner.id, zt.id, 10, 0.9);
  check("a company that no longer expires certificates does not renew an old one", certAt(mLearner.id, 10).expiresAt === nowS - 5 * DAYS);
  db.update(companies).set({ certValidMonths: 12 }).where(eq(companies.id, moksy.id)).run();
  check("the setup form rejects a negative or absurd validity", await (async () => { const bad = async (v: string) => (await saveBranding(mAdmin, form({ companyId: String(moksy.id), academyName: "", certIssuer: "", accent: "", certSigner: "", certSignerTitle: "", certValidMonths: v }))); return !!(await bad("-1"))?.error && !!(await bad("121"))?.error && !!(await bad("ab"))?.error; })());
  check("a title with no signatory is rejected", !!(await saveBranding(mAdmin, form({ companyId: String(moksy.id), academyName: "", certIssuer: "", accent: "", certSigner: "", certSignerTitle: "CEO", certValidMonths: "12" })))?.error);
  check("another company's admin cannot set this company's policy", await (async () => { const g = mk("t-guru-admin2@check.local", "admin", [{ kind: "company", refId: guru.id }]); return !!(await saveBranding(g, form({ companyId: String(moksy.id), academyName: "", certIssuer: "", accent: "", certSigner: "X", certSignerTitle: "", certValidMonths: "12" })))?.error; })());

  // ---- certificate revocation ----
  db.update(companies).set({ certValidMonths: 12 }).where(eq(companies.id, moksy.id)).run();
  const rc = certAt(mLearner.id, 10), gc = certAt(gLearner.id, 10);
  const gAdm = mk("t-guru-admin3@check.local", "admin", [{ kind: "company", refId: guru.id }]);
  awardForPass(mAdmin.id, zt.id, 10, 0.9);
  const ownCert = certAt(mAdmin.id, 10);
  const rv = (id: number, reason = "Issued in error") => form({ id: String(id), reason });
  check("a manager cannot revoke a certificate", !!revokeCertificate(mMgr, rv(rc.id))?.error);
  check("another company's admin cannot revoke it", !!revokeCertificate(gAdm, rv(rc.id))?.error && !certAt(mLearner.id, 10).revokedAt);
  check("an admin cannot revoke their own", !!revokeCertificate(mAdmin, rv(ownCert.id))?.error);
  check("a reason is required", !!revokeCertificate(mAdmin, rv(rc.id, ""))?.error && !!revokeCertificate(mAdmin, rv(rc.id, "ab"))?.error && !certAt(mLearner.id, 10).revokedAt);
  check("a certificate that does not exist is refused", !!revokeCertificate(mAdmin, rv(999999))?.error);
  check("the company's admin revokes it", !!revokeCertificate(mAdmin, rv(rc.id, "Passed by mistake"))?.done);
  const rcv = certAt(mLearner.id, 10);
  check("it is marked revoked, with who, when and why", rcv.revokedAt !== null && rcv.revokedBy === mAdmin.id && rcv.revokedReason === "Passed by mistake");
  check("it still verifies as an authentic record", signatureStatus(rcv) === "valid");
  check("the holder was told, with the reason", db.select().from(notifications).where(eq(notifications.userId, mLearner.id)).all().some((n) => n.key.startsWith(`cert-revoked-${rc.id}`) && n.body.includes("Passed by mistake")));
  check("revoking twice is refused", !!revokeCertificate(mAdmin, rv(rc.id))?.error);
  db.update(certificates).set({ revokedAt: null, revokedReason: "" }).where(eq(certificates.id, rc.id)).run();
  check("clearing the revocation directly in the database is caught", signatureStatus(certAt(mLearner.id, 10)) === "altered");
  db.update(certificates).set({ revokedAt: rcv.revokedAt, revokedReason: "Something else" }).where(eq(certificates.id, rc.id)).run();
  check("so is changing the reason", signatureStatus(certAt(mLearner.id, 10)) === "altered");
  db.update(certificates).set({ revokedReason: rcv.revokedReason, expiresAt: nowS + 5 * DAYS, signature: signatureOf({ ...rcv, expiresAt: nowS + 5 * DAYS }) }).where(eq(certificates.id, rc.id)).run();
  awardForPass(mLearner.id, zt.id, 10, 0.99);
  const kept = certAt(mLearner.id, 10);
  check("passing the level again does not renew a revoked certificate", kept.revokedAt === rcv.revokedAt && kept.renewedAt === rcv.renewedAt && kept.expiresAt === nowS + 5 * DAYS);
  check("a revoked certificate no longer counts toward the Collector badge total", progressionFor(mLearner.id).facts.certs === db.select().from(certificates).where(eq(certificates.userId, mLearner.id)).all().filter((c) => !c.revokedAt).length);
  check("another company's admin cannot reinstate it", !!reinstateCertificate(gAdm, rv(rc.id))?.error && !!certAt(mLearner.id, 10).revokedAt);
  check("a manager cannot reinstate it", !!reinstateCertificate(mMgr, rv(rc.id))?.error);
  check("the company's admin reinstates it", !!reinstateCertificate(mAdmin, rv(rc.id, "Checked: it was correct"))?.done);
  const back = certAt(mLearner.id, 10);
  check("it is valid again and its signature matches", back.revokedAt === null && back.revokedReason === "" && signatureStatus(back) === "valid");
  check("reinstating one that is not revoked is refused", !!reinstateCertificate(mAdmin, rv(rc.id))?.error);
  const evs = db.select().from(certificateEvents).where(eq(certificateEvents.certificateId, rc.id)).all();
  check("both changes stay in the history", evs.length === 2 && evs.some((e) => e.kind === "revoked" && e.byUser === mAdmin.id) && evs.some((e) => e.kind === "reinstated" && e.reason === "Checked: it was correct"));
  check("the platform owner can revoke anyone's", !!revokeCertificate(owner, rv(gc.id, "Policy breach"))?.done && !!certAt(gLearner.id, 10).revokedAt);
  check("a legacy unsigned certificate is signed when revoked", (() => { const l = certAt(loose.id, 10); db.update(certificates).set({ signature: "" }).where(eq(certificates.id, l.id)).run(); return !!revokeCertificate(owner, rv(l.id, "Test"))?.done && signatureStatus(certAt(loose.id, 10)) === "valid"; })());

  // ---- certificate expiry notifications ----
  db.update(companies).set({ certValidMonths: 12 }).where(eq(companies.id, moksy.id)).run();
  awardForPass(mLearner2.id, zt.id, 15, 0.9); awardForPass(mLearner2.id, zt.id, 20, 0.9);
  const en = certAt(mLearner2.id, 15), en2 = certAt(mLearner2.id, 20);
  const setExp = (id: number, secs: number | null) => db.update(certificates).set({ expiresAt: secs, revokedAt: null }).where(eq(certificates.id, id)).run();
  const notes = (u: number) => db.select().from(notifications).where(eq(notifications.userId, u)).all().filter((n) => n.key.startsWith("cert-expiry-"));
  const sweep = (u: number, at = Math.floor(Date.now() / 1000)) => { noteExpiringCertificates(u, at); return notes(u); };
  check("a certificate far from expiring is not mentioned", (setExp(en.id, nowS + 200 * DAYS), setExp(en2.id, null), sweep(mLearner2.id).length === 0));
  check("one that never expires is never mentioned", sweep(mLearner2.id, nowS + 5000 * DAYS).length === 0);
  setExp(en.id, nowS + 45 * DAYS);
  const w = sweep(mLearner2.id);
  check("entering the renewal window sends one heads-up", w.length === 1 && w[0].title === "A certificate expires soon" && w[0].body.includes("45 days") && w[0].body.includes("Pass the level again to renew"));
  check("it points at the profile", w[0].href === "/profile" && w[0].kind === "system" && w[0].readAt === null);
  check("sweeping again sends nothing more", sweep(mLearner2.id).length === 1 && sweep(mLearner2.id).length === 1);
  setExp(en.id, nowS + (REMINDER_DAYS - 4) * DAYS);
  const rem = sweep(mLearner2.id);
  check("closer to the date, a reminder follows", rem.length === 2 && rem.some((n) => /expires in \d+ days?/.test(n.title)));
  check("and only once", sweep(mLearner2.id).length === 2);
  setExp(en.id, nowS - 5 * DAYS);
  const x = sweep(mLearner2.id);
  check("when it expires, the person is told", x.length === 3 && x.some((n) => n.title === "A certificate has expired" && n.body.includes("expired on")));
  setExp(en.id, nowS - (EXPIRED_NOTICE_DAYS + 60) * DAYS);
  check("a certificate long expired is not announced", (db.delete(notifications).where(eq(notifications.userId, mLearner2.id)).run(), sweep(mLearner2.id).length === 0));
  setExp(en.id, nowS + 10 * DAYS);
  db.update(certificates).set({ revokedAt: nowS }).where(eq(certificates.id, en.id)).run();
  check("a revoked certificate is not mentioned", sweep(mLearner2.id).length === 0);
  setExp(en.id, nowS + 10 * DAYS);
  const before1 = sweep(mLearner2.id).length;
  setExp(en.id, nowS + 400 * DAYS);
  setExp(en.id, nowS + 20 * DAYS);
  check("a renewed certificate starts again with its new date", sweep(mLearner2.id).length === before1 + 1);
  db.update(companies).set({ certValidMonths: 0 }).where(eq(companies.id, moksy.id)).run();
  setExp(en2.id, nowS + 30 * DAYS);
  check("a company that no longer expires certificates gets no renew instruction", sweep(mLearner2.id).some((n) => n.key.includes(String(en2.id)) && !n.body.includes("renew")));
  check("nothing is sent to someone else", sweep(mLearner.id).every((n) => !n.key.includes(`-${en.id}-`) && !n.key.includes(`-${en2.id}-`)));
  db.update(companies).set({ certValidMonths: 12 }).where(eq(companies.id, moksy.id)).run();

  // ---- the manager panel counts only what the viewer runs ----
  setExp(en.id, null); setExp(en2.id, null);
  awardForPass(gLearner.id, zt.id, 15, 0.9);
  const gen = certAt(gLearner.id, 15), gch = certAt(gLearner.id, 10);
  setExp(gen.id, null);
  const mc0 = glanceCounts(mMgr), gc0 = glanceCounts(gAdm), oc0 = glanceCounts(owner);
  setExp(en.id, nowS + 20 * DAYS); setExp(gen.id, nowS + 20 * DAYS);
  const mc1 = glanceCounts(mMgr), gc1 = glanceCounts(gAdm), oc1 = glanceCounts(owner);
  check("an expiring certificate is counted for the manager of its company", mc1.certs.expiring === mc0.certs.expiring + 1);
  check("another company's expiring certificate is not", gc1.certs.expiring === gc0.certs.expiring + 1 && oc1.certs.expiring === oc0.certs.expiring + 2);
  setExp(en2.id, nowS - 3 * DAYS);
  check("a recently expired one is counted separately", glanceCounts(mMgr).certs.expired === mc0.certs.expired + 1 && glanceCounts(mMgr).certs.expiring === mc1.certs.expiring);
  setExp(en2.id, nowS - (EXPIRED_NOTICE_DAYS + 20) * DAYS);
  check("one that expired long ago is not", glanceCounts(mMgr).certs.expired === mc0.certs.expired);
  db.update(certificates).set({ revokedAt: nowS }).where(eq(certificates.id, en.id)).run();
  check("a revoked one is not", glanceCounts(mMgr).certs.expiring === mc0.certs.expiring);
  setExp(en.id, null); setExp(en2.id, null); setExp(gen.id, null);
  const inv = (email: string, scopes: string) => db.insert(invites).values({ tokenHash: `t-${email}-${Math.random()}`, email, jobRole: "developer", scopes, createdBy: mMgr.id, expiresAt: nowS + DAYS }).run();
  const iv0 = glanceCounts(mMgr).invitesWaiting, io0 = glanceCounts(owner).invitesWaiting;
  inv("t-i1@check.local", `company:${moksy.id}`); inv("t-i2@check.local", `company:${guru.id}`); inv("t-i3@check.local", "");
  check("only an open invite into the manager's own company is counted for them", glanceCounts(mMgr).invitesWaiting === iv0 + 1);
  check("the platform owner counts all of them", glanceCounts(owner).invitesWaiting === io0 + 3);
  check("a company manager is not shown people who belong to no company", glanceCounts(mMgr).unassigned === 0 && glanceCounts(owner).unassigned >= 1);
  check("overdue people and unread updates come from their own company only", glanceCounts(mMgr).overdue <= glanceCounts(owner).overdue && glanceCounts(mMgr).unread <= glanceCounts(owner).unread);
  check("held questions are shown to admins only", glanceCounts(mMgr).held === 0 && glanceCounts(gAdm).held <= glanceCounts(owner).held);

  // ---- the admin's scope switcher: what a person may look at ----
  const mBrand = db.select().from(brands).where(eq(brands.companyId, moksy.id)).get()!;
  const asOwner = (raw?: string | null) => resolveScope(owner, raw), asMgr = (raw?: string | null) => resolveScope(mMgr, raw);
  check("the platform owner can enter master", asOwner("master")?.isMaster === true && isGlobal(asOwner("master")!.reach));
  check("a company manager and a company admin cannot", asMgr("master") === null && resolveScope(mAdmin, "master") === null);
  check("no cookie or 'all' means everything they run", asMgr("all")?.kind === "all" && asMgr(undefined)?.kind === "all" && asMgr(null)?.kind === "all" && isGlobal(asOwner("all")!.reach));
  const oCo = asOwner(`company:${moksy.id}`)!;
  check("the owner can look at one company, which narrows what pages read", oCo.kind === "company" && !isGlobal(oCo.reach) && personInReach(oCo.reach, [{ kind: "company", id: moksy.id }]) && !personInReach(oCo.reach, [{ kind: "company", id: guru.id }]));
  check("a manager can look at their own company", asMgr(`company:${moksy.id}`)?.kind === "company");
  check("but not at another company, even with the right number in the cookie", asMgr(`company:${guru.id}`) === null && resolveScope(mAdmin, `company:${guru.id}`) === null);
  const oBr = asOwner(`brand:${mBrand.id}`)!;
  check("a brand narrows to that brand's people", oBr.kind === "brand" && personInReach(oBr.reach, [{ kind: "brand", id: mBrand.id }]) && !personInReach(oBr.reach, [{ kind: "company", id: guru.id }]));
  check("a manager can look at a brand of their company", asMgr(`brand:${mBrand.id}`)?.kind === "brand");
  check("values that are not scopes are refused", ["company:abc", "brand:-1", "evil", "company:", ":1", "master:1", "company:1.5"].every((v) => asOwner(v) === null && asMgr(v) === null));
  check("narrowing never reaches wider than the person's own reach", usersInReach(asMgr(`company:${moksy.id}`)!.reach)!.has(mLearner.id) && !usersInReach(asMgr(`company:${moksy.id}`)!.reach)!.has(gLearner.id));
  check("the switcher offers a manager only their own companies, and no master", (() => { const c = scopeChoices(mMgr); return !c.owner && c.companies.length === 1 && c.companies[0].id === moksy.id && c.shared.length === 0; })());
  check("and the owner every company, with the shared academy brands", (() => { const c = scopeChoices(owner); return c.owner && c.companies.length >= 2 && c.shared.length >= 1; })());
  check("the nav's expiring-certificates badge agrees with counting over the whole reach", [mMgr, gAdm, owner].every((u) => { const a = expiryWatch(usersInReach(reachOf(u.id))), b = expiryWatchFor(reachOf(u.id)); return a.expiring === b.expiring && a.expired === b.expired; }) && (() => { const a = expiryWatch(usersInReach(oCo.reach)), b = expiryWatchFor(oCo.reach); return a.expiring === b.expiring && a.expired === b.expired; })());
  check("the panel counts follow the chosen company", glanceCounts(owner, oCo.reach).unassigned === 0 && glanceCounts(owner, oCo.reach).certs.expiring <= glanceCounts(owner).certs.expiring);
  // ---- the scale work must not change any answer ----
  const sameReqs = [mLearner, mLearner2, gLearner, loose].every((u) => {
    const at = Math.floor(Date.now() / 1000); // one fixed time for both: a due date for a track the person is not enrolled in counts from now, so two calls a second apart would differ
    const a = requirementsFor(u, scopesOf(u.id), catalog(), at), b = requirementsFor(u, scopesOf(u.id), catalog(), at, loadProgress(new Set([u.id])));
    return a.length === b.length && a.every((x, i) => x.track.id === b[i].track.id && x.passed === b[i].passed && x.assignedAt === b[i].assignedAt && x.dueAt === b[i].dueAt && x.done === b[i].done);
  });
  check("required learning is the same whether worked out for one person or for a batch", sameReqs);
  const batch = new Set([mLearner.id, mLearner2.id, gLearner.id]);
  const full = complianceReport(), part = complianceReport(batch);
  check("a compliance report for some people equals the full report narrowed to them", part.length === full.filter((r) => batch.has(r.person.id)).length && part.every((r) => { const o = full.find((x) => x.person.id === r.person.id)!; return o.state === r.state && o.required === r.required && o.done === r.done && o.overdue === r.overdue; }));
  check("people past the onboarding window are not gated and nothing is worked out for them", (() => { const old = { ...mLearner, createdAt: nowS - 200 * DAYS }; const o = onboardingFor(old, scopesOf(mLearner.id)); return !o.gated && o.phases.length === 0 && o.locked.size === 0; })());
  check("the batched sign-off list agrees with one-by-one", awaitingSignoff(mMgr).every((a) => onboardingFor(a.person, scopesOf(a.person.id)).phases.find((p) => p.state === "ready")?.key === a.phase.key));
  process.env.CATALOG_TTL_MS = "600000";
  resetCatalogCache();
  const c1 = catalog(), c2 = catalog();
  check("the catalogue is kept between calls", c1 === c2);
  check("and dropped when a track is added, so the change shows at once", !!addTrack(mAdmin, trackForm(zb.id, "Zz Cache Track"))?.done && catalog() !== c1 && catalog().some((t) => t.name === "Zz Cache Track"));
  process.env.CATALOG_TTL_MS = "0";

  db.update(companies).set({ academyName: before.academyName, certIssuer: before.certIssuer, accent: before.accent, logo: before.logo, certValidMonths: before.certValidMonths, certSigner: before.certSigner, certSignerTitle: before.certSignerTitle }).where(eq(companies.id, moksy.id)).run();
} finally {
  const t = db.select().from(users).where(like(users.email, "t-%@check.local")).all();
  for (const u of t) { // history rows point at certificates and at the admin who acted, so they go before either
    db.delete(certificateEvents).where(eq(certificateEvents.byUser, u.id)).run();
    for (const c of db.select().from(certificates).where(eq(certificates.userId, u.id)).all()) db.delete(certificateEvents).where(eq(certificateEvents.certificateId, c.id)).run();
  }
  for (const u of db.select().from(users).where(like(users.email, "t-%@check.local")).all()) {
    db.delete(rewardAwards).where(eq(rewardAwards.userId, u.id)).run();
    db.delete(certificates).where(eq(certificates.userId, u.id)).run();
    db.delete(notifications).where(eq(notifications.userId, u.id)).run();
    db.delete(invites).where(eq(invites.createdBy, u.id)).run();
    db.delete(userBadges).where(eq(userBadges.userId, u.id)).run(); // progressionFor records the badges a person has earned
    db.delete(rewardRules).where(eq(rewardRules.createdBy, u.id)).run();
  }
  for (const c of db.select().from(competitions).where(like(competitions.slug, "zz-%")).all()) db.delete(competitions).where(eq(competitions.id, c.id)).run();
  for (const u of db.select().from(users).where(like(users.email, "t-%@check.local")).all()) db.delete(runs).where(eq(runs.userId, u.id)).run();
  { const o = periodAt("week", Math.floor(Date.now() / 1000) - 140 * 86400); db.delete(seasonResults).where(eq(seasonResults.key, o.key)).run(); db.delete(seasonClosed).where(eq(seasonClosed.key, o.key)).run(); }
  for (const tr of db.select().from(tracks).where(like(tracks.slug, "zz-%")).all()) db.delete(tracks).where(eq(tracks.id, tr.id)).run();
  for (const b of db.select().from(brands).where(like(brands.slug, "zz-%")).all()) db.delete(brands).where(eq(brands.id, b.id)).run();
  for (const c of db.select().from(companies).where(like(companies.slug, "zz-%")).all()) db.delete(companies).where(eq(companies.id, c.id)).run();
  for (const u of t) { db.delete(userScopes).where(eq(userScopes.userId, u.id)).run(); db.delete(users).where(eq(users.id, u.id)).run(); }
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
})();

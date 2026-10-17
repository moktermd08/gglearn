/** Checks the company/brand profile and the tool access register: npm run check:access (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, like } from "drizzle-orm";
import { and } from "drizzle-orm";
import { brands, companies, db, enrollments, knowledgeChanges, knowledgeItems, profileEntries, profileFields, roleChanges, profileSections, tracks, toolAccess, toolRoleAccess, tools, userScopes, users } from "../lib/db";
import { SECTIONS, completenessOf, fieldsFor, profileOf, rowsOf, saveAnswer, saveSectionMeta } from "../lib/profile";
import { addCustomField, retireCustomField } from "../lib/profileAdmin";
import { TEMPLATES, applyTemplate, previewTemplate } from "../lib/profileTemplates";
import { MAX_CUSTOM } from "../lib/profileAdmin";
import { profileSlug, publishProfile, publishStates } from "../lib/profilePublish";
import { activeAccess, applyPlan, grantAccess, holdersOf, leaversWithAccess, offboardingLines, planFor, revokeAccess } from "../lib/access";
import { canManageTool, grantForm, revokeForm, setRoleAccess } from "../lib/accessAdmin";
import { applyRoleChange, mayChangeRole, previewRoleChange, roleHistory } from "../lib/roleChange";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const co = db.select().from(companies).limit(1).get()!;
const REF = co.id;

try {
  // sections are well formed
  check("section keys unique", new Set(SECTIONS.map((s) => s.key)).size === SECTIONS.length);
  check("field keys unique within a section", SECTIONS.every((s) => new Set(s.fields.map((x) => x.key)).size === s.fields.length));
  check("every core section has a required field", SECTIONS.filter((s) => s.tier === "core").every((s) => s.fields.some((x) => x.required)));

  // profile
  const u = db.insert(users).values({ email: "t-access@check.local", name: "t-access", jobRole: "developer" }).returning().get();
  const before = completenessOf(profileOf("company", REF));
  check("empty profile is not ready", !before.ready && before.percent <= 100);
  check("rejects unknown field", !saveAnswer("company", REF, "identity", "nope", "x", u.id));
  check("rejects section not for this scope", !saveAnswer("brand", REF, "finance", "budget_process", "x", u.id));
  for (const s of SECTIONS.filter((s) => s.tier === "core" && s.scopes.includes("company"))) for (const fl of s.fields.filter((x) => x.required)) saveAnswer("company", REF, s.key, fl.key, "answer", u.id);
  const after = completenessOf(profileOf("company", REF));
  check("all required answered = ready, 100%", after.ready && after.percent === 100);
  saveAnswer("company", REF, "identity", "mission", "   ", u.id);
  check("clearing a required answer makes it incomplete", !completenessOf(profileOf("company", REF)).ready);
  saveAnswer("company", REF, "identity", "mission", "m", u.id);
  saveSectionMeta("company", REF, "finance", u.id, { status: "na" });
  saveAnswer("company", REF, "finance", "budget_process", "", u.id);
  check("section marked n/a stops counting", completenessOf(profileOf("company", REF)).ready);
  check("unreviewed sections are stale", completenessOf(profileOf("company", REF)).stale.length > 0);
  saveSectionMeta("company", REF, "identity", u.id, { reviewed: true });
  check("reviewing clears staleness", !completenessOf(profileOf("company", REF)).stale.some((s) => s.section.key === "identity"));
  check("empty meta update is harmless", saveSectionMeta("company", REF, "identity", u.id, {}));

  // publish to learning
  const adminMe = { id: u.id, role: "admin" as const };
  check("only an admin publishes", !!publishProfile({ id: u.id, role: "manager" }, "company", REF, { material: false, note: "" })?.error);
  const pub1 = publishProfile(adminMe, "company", REF, { material: false, note: "" });
  const trk = db.select().from(tracks).where(eq(tracks.slug, profileSlug("company", REF))).get();
  check("publish creates a growth track with one item per answered section", !!pub1?.done && trk?.tier === "growth" && db.select().from(knowledgeItems).where(eq(knowledgeItems.trackId, trk!.id)).all().length > 5);
  check("everything published is current", [...publishStates("company", REF).states.values()].every((v) => v === "current" || v === "empty"));
  publishProfile(adminMe, "company", REF, { material: false, note: "" });
  check("publishing twice makes no second track", db.select().from(tracks).where(eq(tracks.slug, profileSlug("company", REF))).all().length === 1);
  saveAnswer("company", REF, "identity", "mission", "A new mission", u.id);
  check("an edit shows as changed", publishStates("company", REF).states.get("identity") === "changed");
  publishProfile(adminMe, "company", REF, { material: true, note: "new mission" });
  const ch = db.select().from(knowledgeChanges).where(eq(knowledgeChanges.trackId, trk!.id)).all();
  check("a changed section is recorded as a material change with the note", ch.length === 1 && ch[0].material === 1 && ch[0].note === "new mission" && ch[0].after.includes("A new mission"));
  check("a section marked not applicable is not published", publishStates("company", REF).states.get("finance") === "empty");

  // structured fields and own questions
  const kpis = fieldsFor("company", REF, "goals")!.find((x) => x.key === "kpis")!;
  check("built-in KPIs are a table", kpis.type === "table" && (kpis.columns?.length ?? 0) >= 3);
  saveAnswer("company", REF, "goals", "kpis", JSON.stringify([{ kpi: " Churn ", target: "< 2%", bogus: "x" }, { kpi: "", target: "" }]), u.id);
  const kr = rowsOf(kpis, profileOf("company", REF).find((x) => x.section.key === "goals")!.answers.kpis);
  check("a table keeps its own columns, trims, and drops empty rows", kr.length === 1 && kr[0].kpi === "Churn" && kr[0].target === "< 2%" && !("bogus" in kr[0]));
  check("legacy plain text shows as one row", rowsOf(kpis, "Weekly signups")[0].kpi === "Weekly signups");
  saveAnswer("company", REF, "goals", "kpis", "not json at all", u.id);
  check("text saved to a table field becomes a row, not an error", rowsOf(kpis, profileOf("company", REF).find((x) => x.section.key === "goals")!.answers.kpis)[0].kpi === "not json at all");
  saveAnswer("company", REF, "goals", "kpis", JSON.stringify([{ kpi: "", target: "" }]), u.id);
  check("a table of empty rows counts as unanswered", profileOf("company", REF).find((x) => x.section.key === "goals")!.missing.some((m) => m.key === "kpis"));
  saveAnswer("company", REF, "goals", "kpis", JSON.stringify([{ kpi: "Churn", target: "2%" }]), u.id);

  const mgr0 = { id: u.id, role: "manager" as const };
  const f1 = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries({ scope: "company", refId: String(REF), section: "offerings", ...o })) f.set(k, v); return f; };
  check("own question needs a real label", !!addCustomField(mgr0, f1({ label: "x" }))?.error);
  check("own table needs 2 to 6 distinct columns", !!addCustomField(mgr0, f1({ label: "Suppliers", kind: "table", columns: "Only" }))?.error && !!addCustomField(mgr0, f1({ label: "Suppliers", kind: "table", columns: "A, a" }))?.error);
  check("own question refused for a section that does not exist", !!addCustomField(mgr0, f1({ label: "Whatever", section: "nope" }))?.error);
  check("add an own table question", !!addCustomField(mgr0, f1({ label: "Approved suppliers", kind: "table", columns: "Supplier, Contact, Renewal date", required: "on" }))?.done);
  const sup = fieldsFor("company", REF, "offerings")!.find((x) => x.custom);
  check("it appears after the built-in ones, as a required table", !!sup && sup.key === "approved_suppliers" && sup.required === true && sup.columns!.length === 3 && fieldsFor("company", REF, "offerings")!.findIndex((x) => x.key === sup.key) === SECTIONS.find((x) => x.key === "offerings")!.fields.length);
  check("a required own question makes the section incomplete until answered", profileOf("company", REF).find((x) => x.section.key === "offerings")!.missing.some((m) => m.key === "approved_suppliers"));
  check("own questions are per company: the other company does not get it", !fieldsFor("company", REF + 1000, "offerings")!.some((x) => x.custom));
  saveAnswer("company", REF, "offerings", "approved_suppliers", JSON.stringify([{ supplier: "Acme", contact: "a@acme.test", renewal_date: "2027-01-01" }]), u.id);
  check("own question answered", !profileOf("company", REF).find((x) => x.section.key === "offerings")!.missing.some((m) => m.key === "approved_suppliers"));
  check("same label again gets its own key", !!addCustomField(mgr0, f1({ label: "Approved suppliers", kind: "text" }))?.done && fieldsFor("company", REF, "offerings")!.some((x) => x.key === "approved_suppliers_2"));
  check("a table answer is taught as one line per row", publishProfile(adminMe, "company", REF, { material: false, note: "" })?.done !== undefined && db.select().from(knowledgeItems).all().some((i) => i.body.includes("Supplier: Acme; Contact: a@acme.test; Renewal date: 2027-01-01")));
  check("remove an own question", !!retireCustomField(mgr0, sup!.id!)?.done && !fieldsFor("company", REF, "offerings")!.some((x) => x.key === "approved_suppliers"));
  check("a removed question keeps its answers", db.select().from(profileEntries).all().some((e) => e.field === "approved_suppliers"));

  // templates
  check("template keys unique", new Set(TEMPLATES.map((t) => t.key)).size === TEMPLATES.length);
  check("every template question is valid and fits the limit", TEMPLATES.every((t) => t.questions.length <= MAX_CUSTOM && t.questions.every((x) => SECTIONS.some((sc) => sc.key === x.section) && x.label.length >= 2 && (x.kind !== "table" || ((x.columns?.length ?? 0) >= 2 && (x.columns?.length ?? 0) <= 6 && new Set(x.columns!.map((c) => c.trim().toLowerCase())).size === x.columns!.length))) && new Set(t.questions.map((x) => x.section + "|" + x.label)).size === t.questions.length));
  check("template n/a sections exist", TEMPLATES.every((t) => t.notApplicable.every((k) => SECTIONS.some((sc) => sc.key === k))));
  const mgr1 = { id: u.id, role: "manager" as const };
  const agencyN = TEMPLATES.find((t) => t.key === "agency")!.questions.length;
  const pvA = previewTemplate("company", REF, "agency")!;
  const activeOwn = () => db.select().from(profileFields).all().filter((r) => r.scope === "company" && r.refId === REF && r.retired === "no").length;
  const ownBefore = activeOwn();
  check("preview lists the template's questions and changes nothing", pvA.add.length > 0 && pvA.add.length <= agencyN && pvA.have === 0 && activeOwn() === ownBefore);
  check("unknown template is refused", !!applyTemplate(mgr1, "company", REF, "nope")?.error);
  check("apply adds every question", !!applyTemplate(mgr1, "company", REF, "agency")?.done && activeOwn() === ownBefore + agencyN);
  check("applying again adds nothing", previewTemplate("company", REF, "agency")!.add.length === 0 && !!applyTemplate(mgr1, "company", REF, "agency")?.done);
  const rate = fieldsFor("company", REF, "finance")!.find((x) => x.label === "Rate card")!;
  retireCustomField(mgr1, rate.id!);
  check("a removed template question is offered again", previewTemplate("company", REF, "agency")!.add.length === 1);
  applyTemplate(mgr1, "company", REF, "agency");
  check("re-adding a removed question revives it rather than duplicating", fieldsFor("company", REF, "finance")!.filter((x) => x.label === "Rate card").length === 1 && fieldsFor("company", REF, "finance")!.find((x) => x.label === "Rate card")!.key === rate.key);
  saveSectionMeta("company", REF, "investors", u.id, { status: "open" });
  saveAnswer("company", REF, "investors", "funding", "Seed round", u.id);
  applyTemplate(mgr1, "company", REF, "solo");
  const st = new Map(profileOf("company", REF).map((x) => [x.section.key, x.status]));
  check("solo template marks an empty section n/a but not one with answers", st.get("expansion") === "na" && st.get("investors") === "open");
  const bId = db.select().from(brands).where(eq(brands.kind, "company")).get()!.id;
  const pvB = previewTemplate("brand", bId, "agency")!;
  check("for a brand, company-only sections are left out", pvB.skipped > 0 && pvB.add.every((x) => x.section !== "legal" && x.section !== "finance"));

  // access register
  db.insert(userScopes).values({ userId: u.id, kind: "company", refId: REF }).run();
  const mk = (slug: string, sensitivity: "standard" | "sensitive" = "standard") => db.insert(tools).values({ slug: `t-${slug}`, name: `T ${slug}`, scope: "company", refId: REF, sensitivity, revokeSteps: "remove user" }).returning().get();
  const gh = mk("github", "sensitive"), slack = mk("slack"), bank = mk("bank", "sensitive");
  const role = (t: typeof gh, jobRole: string, level: "user" | "admin" | "owner") => db.insert(toolRoleAccess).values({ toolId: t.id, jobRole, level }).run();
  role(slack, "*", "user"); role(gh, "developer", "user"); role(bank, "cfo", "admin");

  const onboard = planFor(u.id, "developer");
  check("onboarding grants everyone-tool and role-tool, not other roles' tools", onboard.grant.length === 2 && !onboard.grant.some((c) => c.tool.id === bank.id));
  applyPlan(u.id, onboard, "onboarding", null);
  check("grants recorded", activeAccess(u.id).length === 2);
  check("granting twice is a no-op", !grantAccess(u.id, gh.id, "user", "request", null));

  role(gh, "lead", "admin");
  const promo = planFor(u.id, "lead");
  check("promotion raises github, keeps slack", promo.raise.length === 1 && promo.raise[0].to === "admin" && promo.revoke.length === 0);
  applyPlan(u.id, promo, "promotion", null);
  check("raise closes the old grant (history kept)", db.select().from(toolAccess).where(eq(toolAccess.userId, u.id)).all().length === 3 && activeAccess(u.id).find((a) => a.tool.id === gh.id)!.grant.level === "admin");

  const demo = planFor(u.id, "support");
  check("demotion to a role with only everyone-tools revokes github", demo.revoke.length === 1 && demo.revoke[0].tool.id === gh.id);
  grantAccess(u.id, bank.id, "user", "request", null);
  check("hand-requested access survives a role change", !planFor(u.id, "support").revoke.some((c) => c.tool.id === bank.id));
  applyPlan(u.id, demo, "role_change", null, "demotion");
  check("demotion applied", !activeAccess(u.id).some((a) => a.tool.id === gh.id) && db.select().from(toolAccess).where(eq(toolAccess.revokeReason, "demotion")).all().some((a) => a.userId === u.id));

  // admin forms and who may use them
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const adm = { id: u.id, role: "admin" as const }, mgr = { id: u.id, role: "manager" as const };
  const other = db.insert(users).values({ email: "t-other@check.local", name: "t-other", role: "admin" }).returning().get();
  db.insert(userScopes).values({ userId: other.id, kind: "company", refId: db.select().from(companies).all().find((c) => c.id !== REF)!.id }).run();
  check("nobody removes a question of a company they do not run", !!retireCustomField({ id: other.id, role: "admin" as const }, db.select().from(profileFields).all().find((r) => r.scope === "company" && r.refId === REF)!.id)?.error);
  check("a manager cannot manage tools", !canManageTool(mgr, bank));
  check("an admin of another company cannot manage this company's tool", !canManageTool({ id: other.id, role: "admin" }, bank));
  check("only the platform owner manages a global tool", !canManageTool({ id: other.id, role: "admin" }, { scope: "global", refId: 0 }));
  const g1 = grantForm({ id: other.id, role: "admin" }, fd({ toolId: String(bank.id), email: "t-access@check.local", level: "user" }));
  check("other company's admin cannot grant", !!g1?.error);
  const viaEmail = grantForm(adm, fd({ toolId: String(gh.id), email: "T-Access@check.local", level: "user" }));
  check("grant by email (any case) records access", !!viaEmail?.done && activeAccess(u.id).some((a) => a.tool.id === gh.id));
  revokeAccess(activeAccess(u.id).find((a) => a.tool.id === gh.id)!.grant.id, "other", null);
  check("unknown email is refused", !!grantForm(adm, fd({ toolId: String(slack.id), email: "nobody@check.local", level: "user" }))?.error);
  check("role default can be set and removed", !!setRoleAccess(adm, fd({ toolId: String(slack.id), jobRole: "Designer", level: "admin" }))?.done && !!setRoleAccess(adm, fd({ toolId: String(slack.id), jobRole: "designer", level: "none" }))?.done);
  const held = activeAccess(u.id)[0];
  check("revoke form rejects a bad reason", !!revokeForm(adm, fd({ accessId: String(held.grant.id), reason: "because" }))?.error);

  // role change
  const boss = db.insert(users).values({ email: "t-boss@check.local", name: "t-boss", role: "admin" }).returning().get();
  const v = db.insert(users).values({ email: "t-v@check.local", name: "t-v", jobRole: "developer" }).returning().get();
  db.insert(userScopes).values({ userId: v.id, kind: "company", refId: REF }).run();
  const bossMe = { id: boss.id, role: "admin" as const };
  applyPlan(v.id, planFor(v.id, "developer"), "onboarding", null);
  check("nobody changes their own role", !!mayChangeRole(bossMe, boss));
  check("a manager cannot change an admin's role", !!mayChangeRole({ id: v.id, role: "manager" }, boss));
  const pv = previewRoleChange(v.id, "Support");
  check("preview lower-cases the role and finds the github removal", pv!.to === "support" && pv!.access.revoke.some((c) => c.tool.id === gh.id));
  check("preview changes nothing", db.select().from(users).where(eq(users.id, v.id)).get()!.jobRole === "developer" && activeAccess(v.id).some((a) => a.tool.id === gh.id));
  check("a demotion needs a reason", !!applyRoleChange(bossMe, fd({ userId: String(v.id), jobRole: "support", kind: "demotion", note: "" })).error);
  check("same role is refused", !!applyRoleChange(bossMe, fd({ userId: String(v.id), jobRole: "developer", kind: "role_change" })).error);
  const ok = applyRoleChange(bossMe, fd({ userId: String(v.id), jobRole: "Support", kind: "demotion", note: "moved to support after review" }));
  check("demotion applies", !!ok.done && db.select().from(users).where(eq(users.id, v.id)).get()!.jobRole === "support");
  check("demotion revokes github with reason demotion", !activeAccess(v.id).some((a) => a.tool.id === gh.id) && db.select().from(toolAccess).where(eq(toolAccess.userId, v.id)).all().some((a) => a.revokeReason === "demotion"));
  const hist = roleHistory(v.id);
  check("history records kind, reason and tool actions", hist.length === 1 && hist[0].c.kind === "demotion" && hist[0].c.note.includes("review") && hist[0].c.actions.includes("Remove T github"));

  const lines = offboardingLines(u.id);
  check("offboarding lists each held tool, sensitive first", lines.length === 2 && lines[0].includes("T bank") && lines[0].includes("sensitive"));
  check("holder list", holdersOf(bank.id).length === 1);
  db.update(users).set({ status: "offboarded" }).where(eq(users.id, u.id)).run();
  check("leaver with access is flagged", leaversWithAccess().filter((l) => l.grant.userId === u.id).length === 2);
  for (const a of activeAccess(u.id)) revokeAccess(a.grant.id, "offboarding", null);
  check("all revoked = audit clean", leaversWithAccess().filter((l) => l.grant.userId === u.id).length === 0 && !revokeAccess(1e9, "other", null));
} finally {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, "%@check.local")).all().map((r) => r.id);
  for (const t of db.select().from(tracks).where(like(tracks.slug, "profile-%")).all()) { db.delete(knowledgeChanges).where(eq(knowledgeChanges.trackId, t.id)).run(); db.delete(knowledgeItems).where(eq(knowledgeItems.trackId, t.id)).run(); db.delete(tracks).where(eq(tracks.id, t.id)).run(); }
  for (const id of ids) db.delete(roleChanges).where(eq(roleChanges.userId, id)).run();
  for (const id of ids) db.delete(enrollments).where(eq(enrollments.userId, id)).run(); // a role change enrols the person in what the new role requires
  for (const id of ids) { db.delete(toolAccess).where(eq(toolAccess.userId, id)).run(); db.delete(userScopes).where(eq(userScopes.userId, id)).run(); }
  for (const t of db.select().from(tools).where(like(tools.slug, "t-%")).all()) { db.delete(toolRoleAccess).where(eq(toolRoleAccess.toolId, t.id)).run(); db.delete(tools).where(eq(tools.id, t.id)).run(); }
  for (const [sc, id] of [["company", REF], ["brand", db.select().from(brands).where(eq(brands.kind, "company")).get()?.id ?? -1]] as const) {
    db.delete(profileEntries).where(and(eq(profileEntries.scope, sc), eq(profileEntries.refId, id))).run(); db.delete(profileFields).where(and(eq(profileFields.scope, sc), eq(profileFields.refId, id))).run(); db.delete(profileSections).where(and(eq(profileSections.scope, sc), eq(profileSections.refId, id))).run();
  }
  for (const id of ids) db.delete(users).where(eq(users.id, id)).run();
}
console.log(fails ? `\n${fails} check(s) FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

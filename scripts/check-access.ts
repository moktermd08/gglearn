/** Checks the company/brand profile and the tool access register: npm run check:access (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, like } from "drizzle-orm";
import { companies, db, enrollments, knowledgeChanges, knowledgeItems, profileEntries, roleChanges, profileSections, tracks, toolAccess, toolRoleAccess, tools, userScopes, users } from "../lib/db";
import { SECTIONS, completenessOf, profileOf, saveAnswer, saveSectionMeta } from "../lib/profile";
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
  db.delete(profileEntries).where(eq(profileEntries.refId, REF)).run(); db.delete(profileSections).where(eq(profileSections.refId, REF)).run();
  for (const id of ids) db.delete(users).where(eq(users.id, id)).run();
}
console.log(fails ? `\n${fails} check(s) FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

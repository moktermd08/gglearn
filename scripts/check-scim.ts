/** Checks directory sync: npm run check:scim (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { checklistItems, companies, db, enrollments, notifications, directoryTokens, directoryUsers, userScopes, users } from "../lib/db";
import { MAX_TOKENS, attrsOf, companyForToken, createUser, listUsers, makeToken, managed, patchAttrs, removeUser, revokeToken, tokensOf, updateUser } from "../lib/scim";
import { verifyPassword } from "../lib/password";
import { arenaOfUser } from "../lib/arena";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@scim.check")).all().map((r) => r.id);
  const cs = db.select({ id: companies.id }).from(companies).where(like(companies.slug, "scim-check-%")).all().map((r) => r.id);
  if (cs.length) { db.delete(directoryTokens).where(inArray(directoryTokens.companyId, cs)).run(); db.delete(directoryUsers).where(inArray(directoryUsers.companyId, cs)).run(); }
  if (us.length) { db.delete(directoryUsers).where(inArray(directoryUsers.userId, us)).run(); db.delete(checklistItems).where(inArray(checklistItems.userId, us)).run(); db.delete(enrollments).where(inArray(enrollments.userId, us)).run(); db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(userScopes).where(inArray(userScopes.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
  if (cs.length) db.delete(companies).where(inArray(companies.id, cs)).run();
};
sweep();
async function main() {
try {
  const A = db.insert(companies).values({ slug: "scim-check-a", name: "Scim A" }).returning().get(), B = db.insert(companies).values({ slug: "scim-check-b", name: "Scim B" }).returning().get();
  const row = (id: number) => db.select().from(users).where(eq(users.id, id)).get()!;
  const mkUser = (n: string, over: Partial<typeof users.$inferInsert> = {}, scopes: { c: number }[] = []) => {
    const u = db.insert(users).values({ name: `${n} Scim`, email: `${n}@scim.check`, jobRole: "general", audience: "staff", passwordHash: "x", ...over }).returning().get();
    for (const s of scopes) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: s.c }).run();
    return u;
  };

  // ---- tokens ----
  const t1 = makeToken(A.id, "okta") as { token: string };
  check("a token is made once and only its hash is kept", /^scim_/.test(t1.token) && !db.select().from(directoryTokens).all().some((r) => r.tokenHash === t1.token || r.tokenHash.includes(t1.token)));
  check("a live token finds its company", companyForToken(`Bearer ${t1.token}`) === A.id);
  check("anything else finds nothing", [null, "", "Bearer", `Bearer ${t1.token}x`, `bearer ${t1.token}`, "Bearer scim_" + "a".repeat(30), t1.token].every((h) => companyForToken(h) === null));
  const t2 = makeToken(A.id, "entra") as { token: string }; makeToken(A.id, "third");
  check("a company has at most three live tokens", "error" in makeToken(A.id, "fourth") && tokensOf(A.id).length === MAX_TOKENS);
  revokeToken(A.id, tokensOf(A.id)[1].id);
  check("a revoked token stops working at once; the others are unaffected", companyForToken(`Bearer ${t2.token}`) === null && companyForToken(`Bearer ${t1.token}`) === A.id);
  check("another company cannot revoke it", (revokeToken(B.id, tokensOf(A.id)[0].id), companyForToken(`Bearer ${t1.token}`) === A.id));

  // ---- reading what directories send ----
  check("a name comes from formatted, given+family, or displayName", attrsOf({ userName: "x@y.com", name: { formatted: "Ann Lee" } }).name === "Ann Lee" && attrsOf({ userName: "x@y.com", name: { givenName: "Ann", familyName: "Lee" } }).name === "Ann Lee" && attrsOf({ userName: "x@y.com", displayName: "Ann L" }).name === "Ann L");
  check("the email is the userName, or the primary email when userName is not one", attrsOf({ userName: "A@Y.com" }).userName === "a@y.com" && attrsOf({ userName: "ann", emails: [{ value: "x@y.com" }, { value: "p@y.com", primary: true }] }).userName === "p@y.com");
  check("active reads real booleans and Entra’s strings", attrsOf({ active: false }).active === false && patchAttrs({ Operations: [{ op: "Replace", path: "active", value: "False" }] }).active === false && patchAttrs({ Operations: [{ op: "replace", value: { active: true } }] }).active === true);
  check("patch can rename, change the email and the external id", (() => { const p = patchAttrs({ Operations: [{ op: "replace", path: "name.givenName", value: "Zed" }, { op: "replace", path: "userName", value: "Z@y.com" }, { op: "add", path: "externalId", value: "e1" }] }); return p.userName === "z@y.com" && p.externalId === "e1" && p.name === "Zed"; })());
  check("junk is read as nothing", JSON.stringify(patchAttrs("junk")) === "{}" && JSON.stringify(patchAttrs({ Operations: [{ op: "remove", path: "active" }] })) === "{}" && JSON.stringify(attrsOf(null)) === "{}");

  // ---- creating ----
  const made = createUser(A.id, { userName: "new1@scim.check", name: "New One", externalId: "ext-1" });
  if ("error" in made) check("create works", false);
  else {
    const u = row(made.value.user.id);
    check("a new person is a learner in that company alone, with no password", made.created === true && u.role === "learner" && u.audience === "staff" && u.passwordHash === "" && arenaOfUser(u.id) === `c${A.id}` && db.select().from(userScopes).where(eq(userScopes.userId, u.id)).all().length === 1);
    check("they cannot sign in with a password, whatever is tried", !(await verifyPassword("", u.passwordHash)) && !(await verifyPassword("anything", u.passwordHash)));
    check("they are set up like any joiner: an onboarding checklist, and linked to the directory", db.select().from(checklistItems).where(and(eq(checklistItems.userId, u.id), eq(checklistItems.kind, "onboarding"))).all().length > 0 && managed(A.id, String(u.id))?.externalId === "ext-1");
    check("asking again for the same person changes nothing", (() => { const again = createUser(A.id, { userName: "new1@scim.check", name: "Other" }); return "ok" in again && again.created === false && again.value.user.id === u.id && row(u.id).name === "New One"; })());
    check("a bad email or none is refused", "error" in createUser(A.id, { userName: "nope" }) && "error" in createUser(A.id, {}) && createUser(A.id, {}).hasOwnProperty("error"));
    check("created disabled means created and switched off", (() => { const d = createUser(A.id, { userName: "off1@scim.check", active: false }); return "ok" in d && row(d.value.user.id).status === "offboarded"; })());

    // ---- adopting and refusing ----
    const plain = mkUser("plain", {}, [{ c: A.id }]);
    check("an existing learner of this company alone is adopted, not duplicated", (() => { const r = createUser(A.id, { userName: "plain@scim.check", externalId: "p1" }); return "ok" in r && r.created === false && managed(A.id, String(plain.id))?.externalId === "p1" && row(plain.id).name === "plain Scim"; })());
    const other = mkUser("other", {}, [{ c: B.id }]), both = mkUser("both", {}, [{ c: A.id }, { c: B.id }]), boss = mkUser("boss", { role: "manager" }, [{ c: A.id }]), drifter = mkUser("drifter"), root = mkUser("root", { role: "admin" });
    for (const [n, who] of [["someone in another company", other], ["someone in two companies", both], ["a manager", boss], ["someone with no company", drifter], ["an admin", root]] as const) {
      const r = createUser(A.id, { userName: who.email });
      check(`${n} is refused, and not linked`, "error" in r && r.error.status === 409 && !managed(A.id, String(who.id)) && !db.select().from(directoryUsers).where(eq(directoryUsers.userId, who.id)).get());
    }
    check("the refusal says nothing about who the person is", (() => { const r = createUser(A.id, { userName: other.email }); return "error" in r && !/Scim B|company/i.test(r.error.detail); })());

    // ---- walls between companies ----
    check("another company's directory cannot see, read, change or remove them", !managed(B.id, String(u.id)) && "error" in updateUser(B.id, String(u.id), { name: "Hacked" }) && "error" in removeUser(B.id, String(u.id)) && row(u.id).name === "New One" && row(u.id).status === "active");
    check("and sees only its own people in a list", (() => { const la = listUsers(A.id, null, 1, 100), lb = listUsers(B.id, null, 1, 100); return "ok" in la && "ok" in lb && la.value.total >= 3 && lb.value.total === 0; })());
    check("a ten-digit or odd id finds nothing", !managed(A.id, "abc") && !managed(A.id, "9999999999") && !managed(A.id, "1; drop") && !managed(A.id, ""));
    db.update(users).set({ role: "manager" }).where(eq(users.id, plain.id)).run();
    check("if a managed person is later made a manager, the directory can no longer touch them", !managed(A.id, String(plain.id)) && "error" in updateUser(A.id, String(plain.id), { active: false }) && row(plain.id).status === "active");
    db.update(users).set({ role: "learner" }).where(eq(users.id, plain.id)).run();

    // ---- changing ----
    const before = row(u.id).sessionVersion;
    updateUser(A.id, String(u.id), { active: false });
    const off = row(u.id);
    check("switching someone off ends their access now and starts the offboarding checklist", off.status === "offboarded" && off.sessionVersion === before + 1 && db.select().from(checklistItems).where(and(eq(checklistItems.userId, u.id), eq(checklistItems.kind, "offboarding"))).all().length > 0);
    const listBefore = db.select().from(checklistItems).where(and(eq(checklistItems.userId, u.id), eq(checklistItems.kind, "offboarding"))).all().length;
    updateUser(A.id, String(u.id), { active: false });
    check("doing it again does not pile up checklists or sign-outs", row(u.id).sessionVersion === before + 1 && db.select().from(checklistItems).where(and(eq(checklistItems.userId, u.id), eq(checklistItems.kind, "offboarding"))).all().length === listBefore);
    const r2 = updateUser(A.id, String(u.id), { active: true, name: "Renamed", externalId: "ext-2" });
    check("switching them back on, a rename and a new external id all apply", "ok" in r2 && row(u.id).status === "active" && row(u.id).name === "Renamed" && managed(A.id, String(u.id))?.externalId === "ext-2");
    check("a new email is refused if anyone has it, and applied if free", "error" in updateUser(A.id, String(u.id), { userName: other.email }) && "ok" in updateUser(A.id, String(u.id), { userName: "moved@scim.check" }) && row(u.id).email === "moved@scim.check");
    check("an update with nothing in it changes nothing", "ok" in updateUser(A.id, String(u.id), {}) && row(u.id).name === "Renamed");
    check("removing switches off and keeps the record", "ok" in removeUser(A.id, String(u.id)) && row(u.id).status === "offboarded" && !!db.select().from(users).where(eq(users.id, u.id)).get());

    // ---- finding ----
    const f = listUsers(A.id, 'userName eq "MOVED@scim.check"', 1, 100);
    check("a directory can find a person by userName or external id", "ok" in f && f.value.total === 1 && f.value.rows[0].user.id === u.id && (() => { const g = listUsers(A.id, 'externalId eq "p1"', 1, 100); return "ok" in g && g.value.total === 1; })());
    check("only those filters are understood", "error" in listUsers(A.id, "userName co \"x\"", 1, 100) && "error" in listUsers(A.id, "active eq true", 1, 100));
    check("paging works and is capped", (() => { const p1 = listUsers(A.id, null, 1, 1), p2 = listUsers(A.id, null, 2, 1), big = listUsers(A.id, null, 1, 100000); return "ok" in p1 && "ok" in p2 && "ok" in big && p1.value.rows.length === 1 && p2.value.rows.length === 1 && p1.value.rows[0].user.id !== p2.value.rows[0].user.id && big.value.rows.length <= 100; })());
  }
} finally {
  sweep();
}
}
main().then(() => {
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@scim.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
});

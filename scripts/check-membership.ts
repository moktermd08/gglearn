/** Checks "where you belong": npm run check:membership (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, companies, db, notifications, projects, userScopes, users } from "../lib/db";
import { changeNote, companyNames, explain, membershipOf, noteMembershipChange } from "../lib/membership";
import { arenaOfUser } from "../lib/arena";
import { lookFor } from "../lib/brand";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- the words ----
const none = explain([]), one = explain(["Moksy Limited"]), many = explain(["Moksy Limited", "Guru Graphics Limited"]);
check("no company: open arena and gglearn's look", none.kind === "none" && /open arena/.test(none.body) && /gglearn's own look/.test(none.body));
check("one company: names it, its people, its look", one.kind === "one" && one.headline === "You belong to Moksy Limited" && /Moksy Limited's people/.test(one.body) && /name, colours and certificates/.test(one.body));
check("several companies: names them in order, and says why the arena and look are the open ones", many.kind === "many" && many.headline === "You belong to Guru Graphics Limited and Moksy Limited" && /more than one company/.test(many.body) && /open arena/.test(many.body) && /gglearn's own look/.test(many.body));
check("three companies read as a list", explain(["C Co", "A Co", "B Co"]).headline === "You belong to A Co, B Co and C Co");
check("the explanation says managers can still see them and who to ask", /managers can still see you/.test(many.body) && /ask a manager/.test(many.body));

check("no change, no note", changeNote(["A"], ["A"]) === null && changeNote([], []) === null && changeNote(["A", "B"], ["B", "A"]) === null);
check("joining a second company says so and explains what that changes", (() => { const n = changeNote(["A"], ["A", "B"])!; return n.title === "You now belong to B." && /more than one company/.test(n.body); })());
check("going back to one company says so and explains that", (() => { const n = changeNote(["A", "B"], ["A"])!; return n.title === "You no longer belong to B." && /with A's people/.test(n.body); })());
check("being moved from one company to another says both", changeNote(["A"], ["B"])!.title === "You were moved: you now belong to B and no longer to A.");
check("joining a first company, and leaving the last", changeNote([], ["A"])!.title === "You now belong to A." && /open arena/.test(changeNote(["A"], [])!.body));

// ---- the real structure ----
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@member.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(userScopes).where(inArray(userScopes.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
try {
  const [coA, coB] = db.select().from(companies).orderBy(companies.id).all();
  const brandB = db.select().from(brands).where(and(eq(brands.companyId, coB.id), eq(brands.kind, "company"))).get();
  const projB = db.select().from(projects).where(eq(projects.companyId, coB.id)).get() ?? (brandB ? db.select().from(projects).where(eq(projects.brandId, brandB.id)).get() : undefined);
  const mk = (n: string) => db.insert(users).values({ name: `${n} Tester`, email: `${n}@member.check`, jobRole: "general", audience: "staff", passwordHash: "x" }).returning().get();
  const set = (id: number, scopes: { kind: "company" | "brand" | "project"; id: number }[]) => { db.delete(userScopes).where(eq(userScopes.userId, id)).run(); for (const s of scopes) db.insert(userScopes).values({ userId: id, kind: s.kind, refId: s.id }).run(); };
  const u = mk("u");

  check("nobody with no scopes is in a company", companyNames([]).length === 0 && membershipOf(u.id).kind === "none");
  set(u.id, [{ kind: "company", id: coA.id }]);
  check("a company scope puts someone in that company", membershipOf(u.id).companies.join() === coA.name && membershipOf(u.id).kind === "one");
  if (brandB) { set(u.id, [{ kind: "brand", id: brandB.id }]); check("a brand scope puts someone in the brand's company", membershipOf(u.id).companies.join() === coB.name); }
  if (projB) { set(u.id, [{ kind: "project", id: projB.id }]); check("a project scope puts someone in its company", membershipOf(u.id).companies.join() === coB.name); }
  set(u.id, [{ kind: "company", id: coA.id }, ...(brandB ? [{ kind: "brand" as const, id: brandB.id }] : [{ kind: "company" as const, id: coB.id }])]);
  check("scopes in two companies make two, once each", membershipOf(u.id).kind === "many" && membershipOf(u.id).companies.length === 2);
  set(u.id, [{ kind: "company", id: coA.id }, ...(brandB ? [{ kind: "brand" as const, id: brandB.id }, { kind: "company" as const, id: coB.id }] : [{ kind: "company" as const, id: coB.id }])]);
  check("a company reached two ways still counts once", membershipOf(u.id).companies.length === 2);

  // what the app really does for someone in two companies agrees with the words
  check("the words match the app: two companies means the open arena and the default look", arenaOfUser(u.id) === "open" && lookFor(u.id).company === null);
  set(u.id, [{ kind: "company", id: coA.id }]);
  check("...and one company means that company's arena and look", arenaOfUser(u.id) === `c${coA.id}` && lookFor(u.id).company === coA.name);

  // telling them
  const notes = () => db.select().from(notifications).where(and(eq(notifications.userId, u.id), like(notifications.key, "membership-%"))).all();
  noteMembershipChange(u.id, [{ kind: "company", id: coA.id }], [{ kind: "company", id: coA.id }, { kind: "company", id: coB.id }]);
  check("adding a second company tells them, with the explanation", notes().length === 1 && /You now belong to/.test(notes()[0].title) && /open arena/.test(notes()[0].body) && notes()[0].href === "/profile#belong");
  noteMembershipChange(u.id, [{ kind: "company", id: coA.id }], [{ kind: "company", id: coA.id }]);
  noteMembershipChange(u.id, [{ kind: "company", id: coA.id }], []);
  check("no change says nothing, and leaving a company is told too", notes().length === 2 && notes().some((n) => /no longer belong/.test(n.title)));
  if (brandB) { const before = notes().length; noteMembershipChange(u.id, [{ kind: "company", id: coB.id }], [{ kind: "brand", id: brandB.id }]); check("moving between a company and its own brand changes nothing for them", notes().length === before); }
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@member.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

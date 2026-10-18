/** Checks who may give manager or admin access: npm run check:accesslevel (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray } from "drizzle-orm";
import { companies, db, invites, notifications, roleChanges, userScopes, users } from "../lib/db";
import { grantableLevels, levelForInvite, refuseAccess, setAccessLevel, type Level } from "../lib/accessLevel";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const cos = db.select().from(companies).limit(2).all();
if (cos.length < 2) { console.log("needs two companies in the database"); process.exit(1); }
const [A, B] = cos.map((c) => c.id);
const made: number[] = [];

const person = (tag: string, role: Level, scopes: { kind: "company"; id: number }[], extra: Partial<typeof users.$inferInsert> = {}) => {
  const u = db.insert(users).values({ email: `t-${tag}@acclevel.check`, name: `t-${tag}`, jobRole: "developer", role, ...extra }).returning().get();
  made.push(u.id);
  for (const s of scopes) db.insert(userScopes).values({ userId: u.id, kind: s.kind, refId: s.id }).run();
  return u;
};
const co = (id: number) => ({ kind: "company" as const, id });
const form = (userId: number, access: string) => { const fd = new FormData(); fd.set("userId", String(userId)); fd.set("access", access); return fd; };
const roleOf = (id: number) => db.select({ r: users.role }).from(users).where(eq(users.id, id)).get()!.r;
const invite = (by: number, role: Level, scopes: string) =>
  db.insert(invites).values({ tokenHash: `h-${Math.random()}`, email: "x@acclevel.check", jobRole: "developer", scopes, role, createdBy: by, expiresAt: 9999999999 }).returning().get();

try {
  const owner = person("owner", "admin", []);
  const adminA = person("adminA", "admin", [co(A)]);
  const mgrA = person("mgrA", "manager", [co(A)]);
  const learnerA = person("learnerA", "learner", [co(A)]);
  const learnerB = person("learnerB", "learner", [co(B)]);
  const both = person("both", "learner", [co(A), co(B)]);
  const nobody = person("nobody", "learner", []);
  const customer = person("customer", "learner", [co(A)], { audience: "customer" });
  const gone = person("gone", "learner", [co(A)], { status: "offboarded" });

  check("platform owner may hand out manager and admin", grantableLevels(owner).join() === "manager,admin");
  check("a company admin may hand out manager only", grantableLevels(adminA).join() === "manager");
  check("a manager may hand out nothing", grantableLevels(mgrA).length === 0);
  check("a learner may hand out nothing", grantableLevels(learnerA).length === 0);

  // platform owner
  check("owner makes a scoped learner a manager", setAccessLevel(owner, form(learnerA.id, "manager"))?.done !== undefined && roleOf(learnerA.id) === "manager");
  check("...it is recorded in the role history", db.select().from(roleChanges).where(eq(roleChanges.userId, learnerA.id)).all().some((r) => r.toRole === "access: manager" && r.kind === "promotion" && r.decidedBy === owner.id));
  check("...and the person is told", db.select().from(notifications).where(eq(notifications.userId, learnerA.id)).all().some((n) => n.title.includes("manager")));
  check("owner makes a scoped manager an admin", !!setAccessLevel(owner, form(learnerA.id, "admin"))?.done && roleOf(learnerA.id) === "admin");
  check("owner demotes an admin to learner", !!setAccessLevel(owner, form(learnerA.id, "learner"))?.done && roleOf(learnerA.id) === "learner");
  check("a demotion is recorded as a demotion", db.select().from(roleChanges).where(eq(roleChanges.userId, learnerA.id)).all().some((r) => r.toRole === "access: learner" && r.kind === "demotion"));
  check("nobody changes their own access", !!setAccessLevel(owner, form(owner.id, "learner"))?.error);
  check("someone with no company cannot become a manager (it would mean the whole academy)", !!setAccessLevel(owner, form(nobody.id, "manager"))?.error && roleOf(nobody.id) === "learner");
  check("a customer cannot become a manager", !!setAccessLevel(owner, form(customer.id, "manager"))?.error && roleOf(customer.id) === "learner");
  check("an offboarded person cannot be changed", !!setAccessLevel(owner, form(gone.id, "manager"))?.error && roleOf(gone.id) === "learner");
  check("an unknown level is refused", !!setAccessLevel(owner, form(learnerB.id, "superuser"))?.error && roleOf(learnerB.id) === "learner");
  check("changing to the level they already have is refused", !!setAccessLevel(owner, form(learnerB.id, "learner"))?.error);

  // a company admin
  check("a company admin makes a learner in their company a manager", !!setAccessLevel(adminA, form(learnerA.id, "manager"))?.done && roleOf(learnerA.id) === "manager");
  check("a company admin cannot make an admin", !!setAccessLevel(adminA, form(learnerA.id, "admin"))?.error && roleOf(learnerA.id) === "manager");
  check("a company admin cannot reach another company's person", !!setAccessLevel(adminA, form(learnerB.id, "manager"))?.error && roleOf(learnerB.id) === "learner");
  check("a company admin cannot promote someone who also belongs to another company", !!setAccessLevel(adminA, form(both.id, "manager"))?.error && roleOf(both.id) === "learner");
  check("a company admin cannot change an admin", !!setAccessLevel(adminA, form(owner.id, "learner"))?.error && roleOf(owner.id) === "admin");
  check("a company admin demotes a manager", !!setAccessLevel(adminA, form(learnerA.id, "learner"))?.done && roleOf(learnerA.id) === "learner");

  // a manager or learner
  check("a manager cannot give manager access", !!setAccessLevel(mgrA, form(learnerA.id, "manager"))?.error && roleOf(learnerA.id) === "learner");
  check("a learner cannot give access", !!setAccessLevel({ id: learnerB.id, role: "learner" }, form(learnerA.id, "manager"))?.error);
  check("a manager cannot even demote", !!setAccessLevel(mgrA, form(adminA.id, "learner"))?.error && roleOf(adminA.id) === "admin");

  // creating a person or an invite (same rule)
  check("creating a learner is always allowed", refuseAccess(mgrA, "learner", [co(A)], "staff") === null);
  check("a manager cannot create a manager", !!refuseAccess(mgrA, "manager", [co(A)], "staff"));
  check("an admin cannot create a manager with no company", !!refuseAccess(adminA, "manager", [], "staff"));
  check("an admin cannot create a manager outside their company", !!refuseAccess(adminA, "manager", [co(B)], "staff"));
  check("an admin creates a manager in their company", refuseAccess(adminA, "manager", [co(A)], "staff") === null);
  check("only the owner creates an admin", !!refuseAccess(adminA, "admin", [co(A)], "staff") && refuseAccess(owner, "admin", [co(A)], "staff") === null);
  check("a customer is never created as a manager", !!refuseAccess(owner, "manager", [co(A)], "customer"));

  // an invite is checked again when it is used
  const inv = (by: number, role: Level, scopes = `company:${A}`) => levelForInvite({ role, createdBy: by, scopes: scopes.split(",").map((p) => ({ kind: "company" as const, id: Number(p.split(":")[1]) })), audience: "staff" });
  check("a manager invite from an admin who still may gives manager", inv(adminA.id, "manager") === "manager");
  check("a learner invite stays learner", inv(adminA.id, "learner") === "learner");
  check("an invite from someone since demoted gives learner", inv(mgrA.id, "manager") === "learner");
  db.update(users).set({ status: "offboarded" }).where(eq(users.id, adminA.id)).run();
  check("an invite from someone since offboarded gives learner", inv(adminA.id, "manager") === "learner");
  db.update(users).set({ status: "active" }).where(eq(users.id, adminA.id)).run();
  check("an admin invite from a company admin gives learner", inv(adminA.id, "admin") === "learner");
  check("an invite outside the inviter's reach gives learner", inv(adminA.id, "manager", `company:${B}`) === "learner");
  const stored = invite(owner.id, "manager", `company:${A}`);
  check("the invite row remembers the access level", db.select().from(invites).where(eq(invites.id, stored.id)).get()!.role === "manager");
  db.delete(invites).where(eq(invites.email, "x@acclevel.check")).run();
} finally {
  if (made.length) {
    db.delete(notifications).where(inArray(notifications.userId, made)).run();
    db.delete(roleChanges).where(inArray(roleChanges.userId, made)).run();
    db.delete(userScopes).where(inArray(userScopes.userId, made)).run();
    db.delete(invites).where(inArray(invites.createdBy, made)).run();
    db.delete(users).where(inArray(users.id, made)).run();
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

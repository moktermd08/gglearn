/** Checks which topics a person may pick, the organiser's company label, and answering an invitation: npm run check:topics (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { companies, db, notifications, userScopes, users } from "../lib/db";
import { arenaLabel } from "../lib/arena";
import { markKeyRead, notify } from "../lib/notifications";
import { catalog } from "../lib/paths";
import { pickableTopics } from "../lib/pickTopics";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

function sweep() {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, "%@topics.check")).all().map((r) => r.id);
  if (ids.length) {
    db.delete(notifications).where(inArray(notifications.userId, ids)).run();
    db.delete(userScopes).where(inArray(userScopes.userId, ids)).run();
    db.delete(users).where(inArray(users.id, ids)).run();
  }
}
sweep();
type Sc = { kind: "company" | "project"; id: number };
const person = (tag: string, role: "admin" | "manager" | "learner", audience: "staff" | "customer", scopes: Sc[]) => {
  const u = db.insert(users).values({ email: `t-${tag}@topics.check`, name: `t-${tag}`, jobRole: "developer", role, audience }).returning().get();
  for (const sc of scopes) db.insert(userScopes).values({ userId: u.id, kind: sc.kind, refId: sc.id }).run();
  return u;
};
const co = (id: number): Sc => ({ kind: "company", id });

try {
  const cos = db.select().from(companies).all();
  const cat = catalog();
  // a company's own staff-only topic with questions, and the company it belongs to
  const own = cat.find((t) => t.audience === "staff" && t.brand.kind === "company" && t.brand.companyId != null && t.questions > 0);
  if (!own || cos.length < 2) { console.log("needs a company staff topic with questions and two companies"); process.exit(1); }
  const mine = own.brand.companyId!, other = cos.find((c) => c.id !== mine)!.id;
  const shared = cat.find((t) => t.audience === "staff" && t.brand.kind === "shared" && t.questions > 0)!;
  const customerTopic = cat.find((t) => t.audience !== "staff" && t.questions > 0);
  const empty = cat.find((t) => t.questions === 0);

  // who a topic belongs to: a project's people for a project topic, otherwise the company's
  const insider = person("insider", "learner", "staff", own.scope === "project" && own.projectId ? [{ kind: "project", id: own.projectId }] : [co(mine)]);
  const outsider = person("outsider", "learner", "staff", [co(other)]);
  const loner = person("loner", "learner", "staff", []);
  const owner = person("owner", "admin", "staff", []);
  const cust = person("cust", "learner", "customer", []);
  const ids = (u: typeof insider) => new Set(pickableTopics(u).map((t) => t.id));

  check("someone in the company sees the company's own topic", ids(insider).has(own.id));
  check("someone in another company does not", !ids(outsider).has(own.id));
  if (own.scope === "project") check("a project's topic is for that project's people, not everyone in the company", !ids(person("coonly", "learner", "staff", [co(mine)])).has(own.id));
  check("someone with no company does not", !ids(loner).has(own.id));
  check("the platform owner sees everything", ids(owner).has(own.id));
  check("a shared academy topic is open to every staff member", [insider, outsider, loner].every((u) => ids(u).has(shared.id)));
  if (empty) check("a topic with no questions is never offered", ![insider, outsider, loner, owner, cust].some((u) => ids(u).has(empty.id)));
  check("a customer sees no staff-only topic", ![...ids(cust)].some((id) => cat.find((t) => t.id === id)!.audience === "staff"));
  if (customerTopic) check("a customer sees customer-facing topics", ids(cust).has(customerTopic.id) || customerTopic.audience === "both");
  check("nothing offered is closed to the person's account type", [...ids(loner)].every((id) => cat.find((t) => t.id === id)!.audience !== "customer"));

  // whose race: the organiser's company, only when they have exactly one
  check("a person in one company is labelled with it", arenaLabel(insider.id) === cos.find((c) => c.id === mine)!.name);
  check("a person with no company has no label", arenaLabel(loner.id) === null);
  const both = person("both", "learner", "staff", [co(mine), co(other)]);
  check("a person in two companies has no label", arenaLabel(both.id) === null);

  // answering an invitation clears the bell for that invitation only
  notify(insider.id, { key: "invite-1", kind: "contest", title: "invited" });
  notify(insider.id, { key: "invite-2", kind: "contest", title: "invited" });
  markKeyRead(insider.id, "invite-1");
  const rows = db.select().from(notifications).where(eq(notifications.userId, insider.id)).all();
  check("the answered invitation is read", rows.find((r) => r.key === "invite-1")?.readAt != null);
  check("another invitation stays unread", rows.find((r) => r.key === "invite-2")?.readAt == null);
  markKeyRead(outsider.id, "invite-2");
  check("it cannot clear someone else's", db.select().from(notifications).where(eq(notifications.userId, insider.id)).all().find((r) => r.key === "invite-2")?.readAt == null);
} finally {
  sweep();
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

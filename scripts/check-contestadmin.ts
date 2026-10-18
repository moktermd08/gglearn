/** Checks company-scoped contest moderation and campaign ownership: npm run check:contestadmin (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { companies, competitionMembers, competitions, db, tracks, userScopes, users } from "../lib/db";
import { canModerate, cancelContest, contestsInReach, isOwner, pickOwner, switchOffInviteLink } from "../lib/contestAdmin";
import { syncCampaigns } from "../lib/campaigns";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- who owns the campaigns (pure) ----
check("the first admin who runs everything owns the campaigns", pickOwner([{ id: 5, scoped: false }, { id: 3, scoped: false }]) === 3);
check("an admin tied to one company never does, even with the lowest id", pickOwner([{ id: 1, scoped: true }, { id: 7, scoped: false }]) === 7);
check("with only company admins nobody owns them", pickOwner([{ id: 1, scoped: true }, { id: 2, scoped: true }]) === null && pickOwner([]) === null);

const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@cadmin.check")).all().map((r) => r.id);
  const cs = db.select({ id: competitions.id }).from(competitions).where(like(competitions.title, "zz-%")).all().map((r) => r.id);
  if (cs.length) db.delete(competitionMembers).where(inArray(competitionMembers.competitionId, cs)).run();
  if (cs.length) db.delete(competitions).where(inArray(competitions.id, cs)).run();
  if (us.length) { db.delete(userScopes).where(inArray(userScopes.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400;
try {
  const [coA, coB] = db.select().from(companies).orderBy(companies.id).all();
  const track = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;
  const mk = (n: string, role: "learner" | "manager" | "admin", co: number | null) => {
    const u = db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Tester`, email: `${n}@cadmin.check`, jobRole: "general", audience: "staff", role, passwordHash: "x" }).returning().get();
    if (co) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: co }).run();
    return u;
  };
  const adminA = mk("admina", "admin", coA.id), adminB = mk("adminb", "admin", coB.id), owner = mk("owner", "admin", null);
  const mgrA = mk("mgra", "manager", coA.id), orgA = mk("orga", "learner", coA.id), orgB = mk("orgb", "learner", coB.id), indie = mk("indie", "learner", null);
  const race = (slug: string, by: number, over: Partial<typeof competitions.$inferInsert> = {}) => {
    const c = db.insert(competitions).values({ slug, title: `zz-${slug}`, description: "", trackId: track.id, createdBy: by, visibility: "public", joinPolicy: "invite", goalLevels: 2, startsAt: t - D, endsAt: t + 5 * D, maxHumans: 10, prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "", twist: "off", ...over }).returning().get();
    db.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: by, status: "joined", joinedAt: t - D }).run();
    return c;
  };
  const rA = race("zz-a", orgA.id, { guestLinkVersion: 1 }), rB = race("zz-b", orgB.id), rI = race("zz-i", indie.id), rP = race("camp-zz-platform", owner.id), rOwnA = race("zz-owna", adminA.id);
  const M = (u: typeof owner) => ({ id: u.id, role: u.role });

  check("an organiser moderates their own contest", canModerate(M(orgA), rA) && canModerate(M(indie), rI) && canModerate(M(adminA), rOwnA));
  check("a company's admin moderates a contest run by that company's people", canModerate(M(adminA), rA) && canModerate(M(adminB), rB));
  check("...but not another company's", !canModerate(M(adminA), rB) && !canModerate(M(adminB), rA));
  check("...nor one run by an individual with no company, nor the platform's own", !canModerate(M(adminA), rI) && !canModerate(M(adminB), rI) && !canModerate(M(adminA), rP) && !canModerate(M(adminB), rP));
  check("the platform owner moderates all of them", [rA, rB, rI, rP, rOwnA].every((r) => canModerate(M(owner), r)));
  check("a manager does not moderate other people's contests, even in their own company", !canModerate(M(mgrA), rA) && !canModerate(M(mgrA), rB));
  check("a learner does not moderate someone else's contest", !canModerate(M(orgA), rB) && !canModerate(M(orgA), rI));
  check("only the platform owner counts as the owner", isOwner(M(owner)) && !isOwner(M(adminA)) && !isOwner(M(mgrA)));

  // acting
  check("a company's admin cannot cancel another company's contest, and nothing changes", !cancelContest(M(adminA), rB.id) && db.select().from(competitions).where(eq(competitions.id, rB.id)).get()!.canceledAt === null);
  check("...nor a public campaign", !cancelContest(M(adminB), rP.id) && db.select().from(competitions).where(eq(competitions.id, rP.id)).get()!.canceledAt === null);
  check("a manager cannot cancel their company's contest", !cancelContest(M(mgrA), rA.id) && db.select().from(competitions).where(eq(competitions.id, rA.id)).get()!.canceledAt === null);
  check("the invite link can be switched off by the admin who runs it, not by another company's", !switchOffInviteLink(M(adminB), rA.id) && db.select().from(competitions).where(eq(competitions.id, rA.id)).get()!.guestLinkVersion === 1 && switchOffInviteLink(M(adminA), rA.id) && db.select().from(competitions).where(eq(competitions.id, rA.id)).get()!.guestLinkVersion === null);
  check("switching it off again does nothing", !switchOffInviteLink(M(adminA), rA.id));
  check("a company's admin cancels their company's contest", cancelContest(M(adminA), rA.id, t) && db.select().from(competitions).where(eq(competitions.id, rA.id)).get()!.canceledAt === t);
  check("cancelling twice changes nothing", !cancelContest(M(adminA), rA.id, t + 99) && db.select().from(competitions).where(eq(competitions.id, rA.id)).get()!.canceledAt === t);
  check("the platform owner cancels anything", cancelContest(M(owner), rB.id) && cancelContest(M(owner), rI.id));
  check("an organiser cancels their own", cancelContest(M(orgA), race("zz-own2", orgA.id).id));
  check("a contest that does not exist cannot be cancelled", !cancelContest(M(owner), 999999999));

  // the list
  const aList = contestsInReach(M(adminA)).rows.map((r) => r.slug), bList = contestsInReach(M(adminB)).rows.map((r) => r.slug);
  check("a company's admin lists their company's contests and their own, and no others", aList.includes("zz-a") && aList.includes("zz-owna") && !aList.includes("zz-b") && !aList.includes("zz-i") && !aList.includes("camp-zz-platform"));
  check("the other company's admin lists only theirs", bList.includes("zz-b") && !bList.includes("zz-a") && !bList.includes("zz-i"));
  const oList = contestsInReach(M(owner), { limit: 500 }).rows.map((r) => r.slug);
  check("the platform owner lists everything except campaign rounds, which are asked for", ["zz-a", "zz-b", "zz-i", "zz-owna"].every((s) => oList.includes(s)) && !oList.includes("camp-zz-platform"));
  check("...and gets the campaign rounds when asked", contestsInReach(M(owner), { campaigns: true, limit: 800 }).rows.some((r) => r.slug === "camp-zz-platform"));
  check("a manager or learner lists nothing", contestsInReach(M(mgrA)).total === 0 && contestsInReach(M(orgA)).total === 0);
  check("the list can be narrowed by state, and shows who runs each", contestsInReach(M(adminA), { state: "canceled" }).rows.every((r) => r.state === "canceled") && contestsInReach(M(adminA)).rows.find((r) => r.slug === "zz-a")?.organiser === "Orga Tester");
  check("paging works", contestsInReach(M(owner), { limit: 2 }).rows.length === 2 && contestsInReach(M(owner), { limit: 2, offset: 2 }).rows[0]?.id !== contestsInReach(M(owner), { limit: 2 }).rows[0]?.id);

  // campaigns come home
  db.update(competitions).set({ createdBy: adminA.id }).where(eq(competitions.id, rP.id)).run();
  syncCampaigns();
  const home = db.select().from(competitions).where(eq(competitions.id, rP.id)).get()!;
  const ownerId = pickOwner(db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active"))).all().map((a) => ({ id: a.id, scoped: !!db.select().from(userScopes).where(eq(userScopes.userId, a.id)).get() })));
  check("a campaign round started by a company admin is handed to the platform owner", home.createdBy === ownerId && home.createdBy !== adminA.id);
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@cadmin.check")).all().length === 0 && db.select().from(competitions).where(like(competitions.title, "zz-%")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

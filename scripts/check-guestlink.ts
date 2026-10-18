/** Checks the contest invite link: npm run check:guestlink (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, checklistItems, competitionEmailInvites, competitionMembers, competitions, db, enrollments, tracks, userScopes, users } from "../lib/db";
import { admitMember, admitNewGuest, entryFor, guestAudience, guestKey, guestPath, placesLeft } from "../lib/guestLink";
import { safeNext } from "../lib/nextPath";
import { requirementsFor } from "../lib/paths";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const t0 = Math.floor(Date.now() / 1000);
const madeUsers: number[] = [], madeContests: number[] = [];

/** Removes every row this script makes, found by its name pattern, so a run that stopped half way never poisons the next one. */
function sweep() {
  const cs = db.select({ id: competitions.id }).from(competitions).where(like(competitions.title, "t-%")).all().map((r) => r.id);
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@guest.check")).all().map((r) => r.id);
  if (cs.length) {
    db.delete(competitionMembers).where(inArray(competitionMembers.competitionId, cs)).run();
    db.delete(competitionEmailInvites).where(inArray(competitionEmailInvites.competitionId, cs)).run();
  }
  if (us.length) {
    db.delete(competitionMembers).where(inArray(competitionMembers.userId, us)).run();
    db.delete(enrollments).where(inArray(enrollments.userId, us)).run();
    db.delete(checklistItems).where(inArray(checklistItems.userId, us)).run();
  }
  if (cs.length) db.delete(competitions).where(inArray(competitions.id, cs)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
}
sweep();

const pick = (audience: "staff" | "customer" | "both", kind?: "shared" | "company") => {
  const rows = db.select({ id: tracks.id, a: tracks.audience, k: brands.kind }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).all();
  return rows.find((r) => r.a === audience && (!kind || r.k === kind));
};
const shared = pick("staff", "shared"), company = pick("staff", "company"), customer = pick("customer"), both = pick("both");
if (!shared || !company || !customer) { console.log("needs a shared staff track, a company staff track and a customer track"); process.exit(1); }

const user = (tag: string, audience: "staff" | "customer" = "staff") => {
  const u = db.insert(users).values({ email: `t-${tag}@guest.check`, name: `t-${tag}`, jobRole: "developer", audience }).returning().get();
  madeUsers.push(u.id);
  return u;
};
const contest = (tag: string, trackId: number, by: number, over: Partial<typeof competitions.$inferInsert> = {}) => {
  const c = db.insert(competitions).values({ slug: `t-${tag}-${Math.random().toString(36).slice(2, 8)}`, title: `t-${tag}`, trackId, createdBy: by, goalLevels: 3, startsAt: t0, endsAt: t0 + 86400 * 7, maxHumans: 3, guestLinkVersion: 1, ...over }).returning().get();
  madeContests.push(c.id);
  db.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: by, status: "joined", joinedAt: t0 }).run();
  return c;
};
const keyOf = (c: { slug: string; guestLinkVersion: number | null }) => guestKey(c.slug, c.guestLinkVersion!);
const guest = (n: string) => ({ name: `t-${n}`, email: `t-${n}@guest.check`, passwordHash: "x" });

try {
  // the key
  check("a key is the same each time", guestKey("abc", 1) === guestKey("abc", 1));
  check("a key differs by contest", guestKey("abc", 1) !== guestKey("abd", 1));
  check("a key differs by version, so a new link replaces the old", guestKey("abc", 1) !== guestKey("abc", 2));
  check("a key is 32 URL-safe characters", /^[A-Za-z0-9_-]{32}$/.test(guestKey("abc", 1)));
  check("no link, no path", guestPath({ slug: "abc", guestLinkVersion: null }) === null);

  // which topics may be offered to outsiders
  check("a shared academy topic gives a staff guest", guestAudience(shared.id) === "staff");
  check("a company's own topic is never offered", guestAudience(company.id) === null);
  check("a customer topic gives a customer guest", guestAudience(customer.id) === "customer");
  if (both) check("a topic for both gives the narrower customer guest", guestAudience(both.id) === "customer");
  check("an unknown topic is refused", guestAudience(999999999) === null);

  // what a link opens
  const org = user("org");
  const c = contest("open", shared.id, org.id);
  const ok = entryFor(c.slug, keyOf(c));
  check("the right key opens the contest", !("error" in ok) && ok.c.id === c.id && ok.audience === "staff" && ok.left === 2);
  check("a wrong key is invalid", (entryFor(c.slug, guestKey(c.slug, 2)) as { error: string }).error === "invalid");
  check("a key from another contest is invalid", (entryFor(c.slug, guestKey("other", 1)) as { error: string }).error === "invalid");
  check("a malformed key is invalid", (entryFor(c.slug, "short") as { error: string }).error === "invalid");
  check("an unknown contest is invalid", (entryFor("nope-nope", guestKey("nope-nope", 1)) as { error: string }).error === "invalid");
  const off = contest("off", shared.id, org.id, { guestLinkVersion: null });
  check("a contest with the link off is invalid", (entryFor(off.slug, guestKey(off.slug, 1)) as { error: string }).error === "invalid");
  const internal = contest("internal", company.id, org.id);
  check("a company topic's link is invalid even with a good key", (entryFor(internal.slug, keyOf(internal)) as { error: string }).error === "invalid");
  const done = contest("done", shared.id, org.id, { startsAt: t0 - 9 * 86400, endsAt: t0 - 86400 });
  check("a finished contest says it is over", (entryFor(done.slug, keyOf(done)) as { error: string }).error === "over");
  const gone = contest("gone", shared.id, org.id, { canceledAt: t0 });
  check("a canceled contest says it is over", (entryFor(gone.slug, keyOf(gone)) as { error: string }).error === "over");

  // a new guest
  const e1 = entryFor(c.slug, keyOf(c)) as Exclude<ReturnType<typeof entryFor>, { error: string }>;
  const r1 = admitNewGuest(e1, guest("g1"));
  check("a new guest gets an account", "userId" in r1);
  if ("userId" in r1) {
    madeUsers.push(r1.userId);
    const u = db.select().from(users).where(eq(users.id, r1.userId)).get()!;
    check("...as a learner, with no manager access", u.role === "learner");
    check("...with no company, brand or project", db.select().from(userScopes).where(eq(userScopes.userId, u.id)).all().length === 0);
    check("...a staff account for a shared topic, with the general role", u.audience === "staff" && u.jobRole === "general");
    check("...marked as a guest", u.guest === "yes");
    const control = requirementsFor({ id: u.id, jobRole: "general", audience: "staff" }, []);
    check("...with nothing required of them", requirementsFor(u, []).length === 0);
    check("...(the same account without the mark would be required to take company-wide courses, so the mark is what exempts them)", control.length > 0);
    check("...with no onboarding checklist", db.select().from(checklistItems).where(eq(checklistItems.userId, u.id)).all().length === 0);
    check("...joined to the race", db.select().from(competitionMembers).where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, u.id))).get()?.status === "joined");
    check("...and set up on its topic", !!db.select().from(enrollments).where(and(eq(enrollments.userId, u.id), eq(enrollments.trackId, shared.id))).get());
  }
  check("places left goes down", placesLeft(c) === 1);

  // an email that already has an account gets the generic answer and no second account
  const before = db.select().from(users).all().length;
  const dup = admitNewGuest(e1, guest("g1"));
  check("a taken email is refused with the generic message", "error" in dup && /could not create an account/.test(dup.error) && !/already (has|have)/i.test(dup.error.replace(/If you already have an account/, "")));
  check("...and creates nothing", db.select().from(users).all().length === before);
  const existing = admitNewGuest(e1, { ...guest("g1"), email: org.email });
  check("the organiser's email gets the same answer", "error" in existing && /could not create an account/.test(existing.error));

  // capacity: the third place fills it, the fourth is refused and leaves no account behind
  const e2 = entryFor(c.slug, keyOf(c)) as Exclude<ReturnType<typeof entryFor>, { error: string }>;
  const r2 = admitNewGuest(e2, guest("g2"));
  if ("userId" in r2) madeUsers.push(r2.userId);
  check("the last place can be taken", "userId" in r2 && placesLeft(c) === 0);
  check("a full contest says it is full", (entryFor(c.slug, keyOf(c)) as { error: string }).error === "full");
  const n = db.select().from(users).all().length;
  const late = admitNewGuest(e2, guest("g3"));
  check("a guest who loses the race for the last place gets 'full' and no account", "error" in late && late.error === "This race is full." && db.select().from(users).all().length === n);

  // someone who is signed in
  const roomy = contest("roomy", shared.id, org.id);
  const friend = user("friend");
  check("a signed-in person joins with the link", admitMember(db, roomy, { id: friend.id, audience: "staff" }) === null
    && db.select().from(competitionMembers).where(and(eq(competitionMembers.competitionId, roomy.id), eq(competitionMembers.userId, friend.id))).get()?.status === "joined");
  check("joining twice is harmless", admitMember(db, roomy, { id: friend.id, audience: "staff" }) === null);
  const cust = user("cust", "customer");
  check("a customer cannot join a staff-only topic", !!admitMember(db, roomy, { id: cust.id, audience: "customer" }));
  check("nobody joins a finished contest", !!admitMember(db, done, { id: friend.id, audience: "staff" }));
  const declined = user("declined");
  db.insert(competitionMembers).values({ competitionId: roomy.id, kind: "human", userId: declined.id, status: "declined" }).run();
  check("someone who declined can join by the link", admitMember(db, roomy, { id: declined.id, audience: "staff" }) === null);

  // an email invited earlier is picked up, not lost
  const other = contest("other", shared.id, org.id);
  db.insert(competitionEmailInvites).values({ competitionId: other.id, email: "t-g4@guest.check", invitedBy: org.id }).run();
  const roomy2 = contest("roomy2", shared.id, org.id);
  const e3 = entryFor(roomy2.slug, keyOf(roomy2)) as Exclude<ReturnType<typeof entryFor>, { error: string }>;
  const r4 = admitNewGuest(e3, guest("g4"));
  if ("userId" in r4) {
    madeUsers.push(r4.userId);
    check("a guest also gets the contests their email was invited to", db.select().from(competitionMembers).where(and(eq(competitionMembers.competitionId, other.id), eq(competitionMembers.userId, r4.userId))).get()?.status === "invited");
  } else check("a guest also gets the contests their email was invited to", false);

  // where login may send someone
  check("a path inside the site is allowed", safeNext("/competitions/abc/join/key") === "/competitions/abc/join/key");
  check("another site is refused", safeNext("https://evil.example/x") === null);
  check("a protocol-relative address is refused", safeNext("//evil.example") === null);
  check("a backslash trick is refused", safeNext("/\\evil.example") === null);
  check("a scheme inside the path is refused", safeNext("/redirect?to=http://evil.example") === null);
  check("whitespace and control characters are refused", safeNext("/a b") === null && safeNext("/a\nb") === null);
  check("empty or missing is null", safeNext("") === null && safeNext(undefined) === null);
} finally {
  sweep();
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

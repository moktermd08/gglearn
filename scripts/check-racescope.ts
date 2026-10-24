/** Checks races limited to a company or brand: npm run check:racescope (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, companies, competitionEmailInvites, competitionMembers, competitions, db, enrollments, notifications, tracks, userScopes, users } from "../lib/db";
import { claimPendingInvites, createContest, inviteEmails } from "../lib/contests";
import { admitMember, entryFor, guestKey } from "../lib/guestLink";
import { inRaceScope, raceScopeOptions } from "../lib/tenancy";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const t0 = Math.floor(Date.now() / 1000);

/** Removes every row this script makes, found by its name pattern, so a run that stopped half way never poisons the next one. */
function sweep() {
  const cs = db.select({ id: competitions.id }).from(competitions).where(like(competitions.title, "t-%")).all().map((r) => r.id);
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@racescope.check")).all().map((r) => r.id);
  if (cs.length) {
    db.delete(competitionMembers).where(inArray(competitionMembers.competitionId, cs)).run();
    db.delete(competitionEmailInvites).where(inArray(competitionEmailInvites.competitionId, cs)).run();
  }
  if (us.length) {
    db.delete(notifications).where(inArray(notifications.userId, us)).run();
    db.delete(competitionMembers).where(inArray(competitionMembers.userId, us)).run();
    db.delete(enrollments).where(inArray(enrollments.userId, us)).run();
    db.delete(userScopes).where(inArray(userScopes.userId, us)).run();
  }
  if (cs.length) db.delete(competitions).where(inArray(competitions.id, cs)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
  db.delete(brands).where(like(brands.slug, "t-racescope-%")).run();
  db.delete(companies).where(like(companies.slug, "t-racescope-%")).run();
}
sweep();

const track = db.select({ id: tracks.id }).from(tracks).where(eq(tracks.audience, "both")).get() ?? db.select({ id: tracks.id }).from(tracks).where(eq(tracks.audience, "staff")).get();
if (!track) { console.log("needs a staff track"); process.exit(1); }

try {
  const co = db.insert(companies).values({ slug: "t-racescope-co", name: "t-Moksy Limited" }).returning().get();
  const other = db.insert(companies).values({ slug: "t-racescope-other", name: "t-Other Ltd" }).returning().get();
  const ai = db.insert(brands).values({ slug: "t-racescope-ai", name: "t-Moksy AI", companyId: co.id }).returning().get();
  const user = (tag: string, scopes: { kind: "company" | "brand"; id: number }[]) => {
    const u = db.insert(users).values({ email: `t-${tag}@racescope.check`, name: `t-${tag}`, jobRole: "developer", audience: "staff" }).returning().get();
    for (const s of scopes) db.insert(userScopes).values({ userId: u.id, kind: s.kind, refId: s.id }).run();
    return u;
  };
  const org = user("organiser", [{ kind: "company", id: co.id }]);
  const colleague = user("colleague", [{ kind: "company", id: co.id }]);
  const aiOnly = user("ai", [{ kind: "brand", id: ai.id }]);
  const outsider = user("outsider", [{ kind: "company", id: other.id }]);
  const noScope = user("none", []);

  // who is in
  check("a company person is in their company", inRaceScope(colleague.id, `company:${co.id}`));
  check("a person of another company is not", !inRaceScope(outsider.id, `company:${co.id}`));
  check("a person with no company is not", !inRaceScope(noScope.id, `company:${co.id}`));
  check("a brand person is in their brand's race", inRaceScope(aiOnly.id, `brand:${ai.id}`));
  check("a company person is in a race of one of its brands", inRaceScope(colleague.id, `brand:${ai.id}`));
  check("a brand person is in a race of their whole company", inRaceScope(aiOnly.id, `company:${co.id}`));
  check("an unlimited race takes anyone", inRaceScope(outsider.id, null));

  // what the organiser may pick
  const opts = raceScopeOptions(org.id);
  check("an organiser is offered their own company and its brand", opts.companies.some((c) => c.id === co.id) && opts.brands.some((b) => b.id === ai.id));
  check("an organiser is not offered another company", !opts.companies.some((c) => c.id === other.id));

  const base = { description: "", trackId: track.id, goalLevels: 2, startInDays: 0, days: 7, maxHumans: 5, visibility: "private" as const, openJoin: false, consent: false, bots: [], emails: "", prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner" as const, prizeNote: "" };
  const made = createContest(org, { ...base, title: "t-scoped", scope: `company:${co.id}` });
  check("an organiser can limit a race to their own company", "slug" in made);
  const refused = createContest(org, { ...base, title: "t-refused", scope: `company:${other.id}` });
  check("an organiser cannot limit a race to someone else's company", "error" in refused);
  check("a project scope is refused", "error" in createContest(org, { ...base, title: "t-proj", scope: "project:1" }));
  if (!("slug" in made)) throw new Error("no race to test with");
  const c = db.select().from(competitions).where(eq(competitions.slug, made.slug)).get()!;
  check("the scope is stored", c.scope === `company:${co.id}`);

  // invitations
  const emails = [colleague, outsider, noScope].map((u) => u.email).join(", ") + ", nobody@racescope.check";
  const sent = db.transaction((tx) => inviteEmails(tx, c.id, org.id, emails));
  const invited = db.select({ u: competitionMembers.userId }).from(competitionMembers).where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.status, "invited"))).all().map((r) => r.u);
  check("a colleague is invited", invited.includes(colleague.id));
  check("an outsider is not invited", !invited.includes(outsider.id) && !invited.includes(noScope.id));
  check("the organiser is told the same count either way", sent.count === 4);
  check("no pending invite is kept for an address with no account", db.select().from(competitionEmailInvites).where(eq(competitionEmailInvites.competitionId, c.id)).all().length === 0);
  db.insert(competitionEmailInvites).values({ competitionId: c.id, email: "late@racescope.check", invitedBy: org.id }).run();
  const late = user("late", []);
  db.update(users).set({ email: "late@racescope.check" }).where(eq(users.id, late.id)).run();
  db.transaction((tx) => claimPendingInvites(tx, late.id, "late@racescope.check"));
  check("a new account does not pick up an invitation to a limited race", !db.select().from(competitionMembers).where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, late.id))).get());

  // joining
  const join = (u: { id: number }) => db.transaction((tx) => admitMember(tx, c, { id: u.id, audience: "staff" }));
  check("a colleague can join", join(colleague) === null);
  check("an outsider cannot join", join(outsider) !== null);
  check("a person with no company cannot join", join(noScope) !== null);

  // the link
  db.update(competitions).set({ guestLinkVersion: 1 }).where(eq(competitions.id, c.id)).run();
  const linked = db.select().from(competitions).where(eq(competitions.id, c.id)).get()!;
  check("a limited race has no working invite link", "error" in entryFor(linked.slug, guestKey(linked.slug, 1)));
} finally {
  sweep();
}
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

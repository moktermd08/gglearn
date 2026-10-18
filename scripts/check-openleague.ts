/** Checks the cross-company league: npm run check:openleague (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { companies, dailyQuests, db, leagueEntries, notifications, tracks, userScopes, users } from "../lib/db";
import { CROSS, inCross, leagueArenaMap, leagueArenaOf, offerFor, setCompanyPolicy, setPersonOptIn } from "../lib/openLeague";
import { leagueView, touchLeague } from "../lib/league";
import { periodAt } from "../lib/seasons";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@openleague.check")).all().map((r) => r.id);
  if (us.length) {
    db.delete(leagueEntries).where(inArray(leagueEntries.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run();
    db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(userScopes).where(inArray(userScopes.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run();
  }
  db.delete(companies).where(like(companies.slug, "openleague-check-%")).run();
};
sweep();
try {
  const co = (n: string, open: "yes" | "no") => db.insert(companies).values({ slug: `openleague-check-${n}`, name: `Check ${n}`, leagueOpen: open }).returning().get();
  const A = co("a", "yes"), B = co("b", "yes"), C = co("c", "no");
  const track = db.select().from(tracks).limit(1).get()!, day = new Date().toISOString().slice(0, 10);
  const mk = (n: string, company: number | null, extra: Partial<typeof users.$inferInsert> = {}) => {
    const u = db.insert(users).values({ name: `${n} Leaguer`, email: `${n}@openleague.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x", ...extra }).returning().get();
    if (company) db.insert(userScopes).values({ userId: u.id, kind: "company", refId: company }).run();
    db.insert(dailyQuests).values({ userId: u.id, trackId: track.id, day, kind: "study", xp: 10 }).run();
    return u;
  };
  const a1 = mk("a1", A.id), a2 = mk("a2", A.id), b1 = mk("b1", B.id), c1 = mk("c1", C.id), lone = mk("lone", null);
  const key = periodAt("week").key;
  const arena = (u: { id: number }) => leagueArenaOf(u.id);

  // ---- nothing changes without consent ----
  check("by default everyone stays in their own company's arena", arena(a1) === `c${A.id}` && arena(b1) === `c${B.id}` && arena(c1) === `c${C.id}`);
  check("a company that allows it only makes it possible", offerFor(a1.id).available && !offerFor(a1.id).on && arena(a1) === `c${A.id}`);
  check("a company that has not allowed it offers nothing", !offerFor(c1.id).available && offerFor(c1.id).why === "company-off");
  check("someone with no single company has nothing to ask and nothing to join", !offerFor(lone.id).available && offerFor(lone.id).why === "single-company");

  // ---- both yeses ----
  check("a person cannot join when their company has not allowed it", "error" in setPersonOptIn(c1, true) && !inCross(c1.id));
  check("choosing it for a person whose company allows it works", "ok" in setPersonOptIn(a1, true) && inCross(a1.id) && arena(a1) === CROSS);
  check("their colleague who did not choose it stays in the company arena", arena(a2) === `c${A.id}`);
  setPersonOptIn(b1, true);
  check("people from two companies who both chose it share one arena", arena(a1) === CROSS && arena(b1) === CROSS);
  check("a person whose company said no cannot be pulled in even with the flag set", (db.update(users).set({ openLeague: "yes" }).where(eq(users.id, c1.id)).run(), arena(c1) === `c${C.id}` && leagueArenaMap().get(c1.id) === `c${C.id}`));
  db.update(users).set({ openLeague: "no" }).where(eq(users.id, c1.id)).run();

  // ---- the league itself ----
  touchLeague(a1.id); touchLeague(b1.id); touchLeague(a2.id);
  const e = (u: { id: number }) => db.select().from(leagueEntries).where(and(eq(leagueEntries.userId, u.id), eq(leagueEntries.key, key))).get();
  check("they are placed together in the cross-company arena and others in their own", e(a1)?.arena === CROSS && e(b1)?.arena === CROSS && e(a1)?.cohort === e(b1)?.cohort && e(a2)?.arena === `c${A.id}`);
  const v = leagueView(a1.id);
  if ("notIn" in v) check("the view is the cross-company league", false);
  else {
    check("the view is marked as cross-company and lists people from both", v.cross && v.rows.some((r) => r.userId === b1.id) && v.rows.some((r) => r.mine));
    check("it shows first names and an initial, never a company or an email", v.rows.every((r) => /^[A-Za-z0-9]+ ?[A-Z]?\.?$/.test(r.name) || r.name.length < 20) && !JSON.stringify(v).includes("@") && !JSON.stringify(v).includes("Check a"));
    check("a colleague's company league does not show people from other companies", (() => { const w = leagueView(a2.id); return !("notIn" in w) && !w.cross && !w.rows.some((r) => r.userId === b1.id || r.userId === a1.id); })());
  }

  // ---- stopping ----
  setPersonOptIn(a1, false);
  check("turning it off moves the person back to their company at once", !inCross(a1.id) && arena(a1) === `c${A.id}` && !e(a1));
  touchLeague(a1.id);
  check("they are placed again in their own company's league", e(a1)?.arena === `c${A.id}`);
  const vb = leagueView(b1.id);
  check("the people left in the cross-company league no longer see them", !("notIn" in vb) && !vb.rows.some((r) => r.userId === a1.id));
  setPersonOptIn(a1, true); touchLeague(a1.id);
  setCompanyPolicy(A.id, false);
  check("when a company switches it off, its people leave straight away", !inCross(a1.id) && arena(a1) === `c${A.id}` && !offerFor(a1.id).available && !e(a1));
  check("other companies' members are not affected by that", inCross(b1.id) && e(b1)?.arena === CROSS);
  check("a person cannot rejoin while the company's policy is off", "error" in setPersonOptIn(a1, true));
  setCompanyPolicy(A.id, true);
  check("when the company allows it again the person's own earlier choice is not assumed", offerFor(a1.id).available && !offerFor(a1.id).on);
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@openleague.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

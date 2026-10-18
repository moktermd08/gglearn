/** Checks site-wide search: npm run check:search (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { brands, certificates, competitionMembers, competitions, db, teamMembers, teams, tracks, users } from "../lib/db";
import { best, matches, normalise, rank, words } from "../lib/searchRules";
import { searchFor } from "../lib/search";
import { publicTracks } from "../lib/publicCatalog";
import { topicLabel } from "../lib/topicName";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- the matching rules ----
check("case and accents are ignored", normalise("Café ÉCOLE") === "cafe ecole");
check("C#, Node.js and C++ keep their punctuation", normalise("C# and Node.js, C++!") === "c# and node.js c++");
check("a query is split into words", words("  git   hub ").join() === "git,hub");
check("every word must appear, in any order", matches("hub git", "Git and GitHub") && matches("git hub", "Git and GitHub") && !matches("git xyz", "Git and GitHub"));
check("part of a word matches", matches("pyth", "Python: Novice to Titan") && matches("novice", "Python: Novice to Titan"));
check("the other text counts too", matches("slack", "Team chat", "slack teams messages"));
check("an empty or blank query matches nothing", !matches("", "anything") && !matches("   ", "anything") && !matches("!!!", "anything"));
check("a very long query is cut, not trusted", words("a".repeat(500)).join("").length <= 60);
check("ranking: exact, then starts with, then a word starts with, then contains, then only elsewhere", [rank("git", "Git"), rank("git", "Git and GitHub"), rank("and", "Git and GitHub"), rank("ithub", "Git and GitHub"), rank("slack", "Team chat", "slack")].join() === "0,1,2,3,4");
check("best() orders by rank, then alphabetically, and limits", best("py", [{ item: { title: "Zed python" } }, { item: { title: "Python" } }, { item: { title: "Pypi" } }, { item: { title: "Apple pie, python" } }], 3).map((x) => x.title).join("|") === "Pypi|Python|Apple pie, python");

// ---- who can find what ----
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@search.check")).all().map((r) => r.id);
  const cs = db.select({ id: competitions.id }).from(competitions).where(like(competitions.title, "zz-%")).all().map((r) => r.id);
  const ts = db.select({ id: teams.id }).from(teams).where(like(teams.name, "zz-%")).all().map((r) => r.id);
  if (cs.length) db.delete(competitionMembers).where(inArray(competitionMembers.competitionId, cs)).run();
  if (ts.length) db.delete(teamMembers).where(inArray(teamMembers.teamId, ts)).run();
  if (us.length) { db.delete(certificates).where(inArray(certificates.userId, us)).run(); }
  if (cs.length) db.delete(competitions).where(inArray(competitions.id, cs)).run();
  if (ts.length) db.delete(teams).where(inArray(teams.id, ts)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400;
const titles = (g: ReturnType<typeof searchFor>, label?: string) => g.filter((x) => !label || x.label === label).flatMap((x) => x.hits.map((h) => h.title));
try {
  const mk = (n: string, role: "learner" | "manager" | "admin" = "learner") => db.insert(users).values({ name: `${n} Searchable`, email: `${n}@search.check`, jobRole: "general", audience: "staff", guest: "yes", role, passwordHash: "x" }).returning().get();
  const host = mk("host"), invited = mk("invited"), stranger = mk("stranger"), boss = mk("boss", "admin"), mgr = mk("mgr", "manager");
  const V = (u: typeof host) => ({ id: u.id, role: u.role, audience: u.audience });
  const track = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;

  check("one letter finds nothing", searchFor(null, "p").length === 0 && searchFor(V(host), " a ").length === 0 && searchFor(null, "").length === 0);
  check("a stranger finds a public topic", titles(searchFor(null, "python"), "Topics").some((x) => /Python/.test(x)));
  check("topics are at most six", titles(searchFor(V(host), "ai"), "Topics").length <= 6);
  check("each topic links to its page", searchFor(null, "python").flatMap((g) => g.hits).filter((h) => h.kind === "topic").every((h) => h.href.startsWith("/tracks/")));

  // a company-only topic whose name no public topic shares, so finding that exact title can only mean it leaked
  const publicNames = publicTracks().map((r) => topicLabel(r.track.name).toLowerCase());
  const staff = db.select({ slug: tracks.slug, name: tracks.name }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"))).all()
    .find((t) => !publicNames.some((n) => n.includes(topicLabel(t.name).toLowerCase())));
  check("there is a company-only topic to test with", !!staff);
  if (staff) {
    const label = topicLabel(staff.name);
    check("a company's staff-only topic is not found by a stranger", !titles(searchFor(null, staff.name), "Topics").includes(label));
    check("...nor by an ordinary account with no part in that company", !titles(searchFor(V(host), staff.name), "Topics").includes(label));
    check("...but the person who runs the whole academy finds it", titles(searchFor(V(boss), staff.name), "Topics").includes(label));
  }

  // races
  const race = (slug: string, title: string, visibility: "public" | "private") => {
    const c = db.insert(competitions).values({ slug, title, description: "", trackId: track.id, createdBy: host.id, visibility, joinPolicy: "invite", goalLevels: 2, startsAt: t - D, endsAt: t + 5 * D, maxHumans: 10, prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "", twist: "off" }).returning().get();
    db.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: host.id, status: "joined", joinedAt: t - D }).run();
    return c;
  };
  const pub = race("zz-pub", "zz-Public Marvel Race", "public"), priv = race("zz-priv", "zz-Private Marvel Race", "private");
  db.insert(competitionMembers).values({ competitionId: priv.id, kind: "human", userId: invited.id, status: "invited", joinedAt: t }).run();
  check("a public race is found by a stranger", titles(searchFor(null, "marvel"), "Races").includes("zz-Public Marvel Race"));
  check("a private race is not found by a stranger or an unrelated account", !titles(searchFor(null, "marvel")).includes("zz-Private Marvel Race") && !titles(searchFor(V(stranger), "marvel")).includes("zz-Private Marvel Race"));
  check("...but is found by whoever runs it and by someone invited to it", titles(searchFor(V(host), "marvel"), "Races").includes("zz-Private Marvel Race") && titles(searchFor(V(invited), "marvel"), "Races").includes("zz-Private Marvel Race"));
  check("a race links to its page", searchFor(V(host), "marvel").flatMap((g) => g.hits).find((h) => h.title === "zz-Private Marvel Race")?.href === "/competitions/zz-priv");
  // a public race on a company-only topic: found by its own title, but its topic is not searched or shown to someone who cannot see it
  if (staff) {
    const sc = db.select().from(tracks).where(eq(tracks.slug, staff.slug)).get()!;
    const open = db.insert(competitions).values({ slug: "zz-open", title: "zz-Open Doors Race", description: "", trackId: sc.id, createdBy: host.id, visibility: "public", joinPolicy: "invite", goalLevels: 2, startsAt: t - D, endsAt: t + 5 * D, maxHumans: 10, prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "", twist: "off" }).returning().get();
    db.insert(competitionMembers).values({ competitionId: open.id, kind: "human", userId: host.id, status: "joined", joinedAt: t - D }).run();
    const byTitle = searchFor(null, "open doors").flatMap((g) => g.hits).find((h) => h.title === "zz-Open Doors Race");
    check("a race is still found by its own title", !!byTitle);
    check("...and its line does not name a topic the stranger cannot see", !!byTitle && !byTitle.sub.includes(topicLabel(staff.name)) && /^Race · /.test(byTitle.sub));
    check("searching for that topic's name does not turn up the race for a stranger", !titles(searchFor(null, staff.name), "Races").includes("zz-Open Doors Race"));
    check("the person who can see the topic finds the race by it, with the topic shown", titles(searchFor(V(boss), staff.name), "Races").includes("zz-Open Doors Race") && (searchFor(V(boss), staff.name).flatMap((g) => g.hits).find((h) => h.title === "zz-Open Doors Race")?.sub ?? "").includes(topicLabel(staff.name)));
  }
  db.update(competitions).set({ canceledAt: t }).where(eq(competitions.id, pub.id)).run();
  check("a cancelled race is not found", !titles(searchFor(V(host), "marvel")).includes("zz-Public Marvel Race"));

  // teams and certificates are the asker's own
  const team = db.insert(teams).values({ name: "zz-Quokka Squad", ownerId: host.id }).returning().get();
  db.insert(teamMembers).values({ teamId: team.id, userId: host.id }).run();
  check("a member finds their team", titles(searchFor(V(host), "quokka"), "Your teams").includes("zz-Quokka Squad"));
  check("someone else does not", searchFor(V(stranger), "quokka").every((g) => g.label !== "Your teams") && searchFor(null, "quokka").length === 0);
  db.insert(certificates).values({ userId: host.id, trackId: track.id, level: 5, code: "ZZSEARCH1", score: 0.9, signature: "x" }).run();
  check("a person finds their own certificate", titles(searchFor(V(host), "python foundation"), "Your certificates").length === 1);
  check("nobody else does", searchFor(V(stranger), "python foundation").every((g) => g.label !== "Your certificates") && searchFor(null, "python foundation").every((g) => g.label !== "Your certificates"));
  db.update(certificates).set({ revokedAt: t }).where(eq(certificates.code, "ZZSEARCH1")).run();
  check("a revoked certificate is not offered", searchFor(V(host), "python foundation").every((g) => g.label !== "Your certificates"));

  // people are never searched
  check("people are never searched", ["host searchable", "searchable", "host@search.check", "stranger"].every((q) => searchFor(V(host), q).flatMap((g) => g.hits).every((h) => !/Searchable|search\.check/i.test(h.title + h.sub))));

  // pages depend on the kind of account
  check("a stranger is offered sign in, not the dashboard", titles(searchFor(null, "sign in"), "Pages").includes("Sign in") && !titles(searchFor(null, "path"), "Pages").includes("My path"));
  check("someone signed in is offered their dashboard, not sign in", titles(searchFor(V(host), "path"), "Pages").includes("My path") && !titles(searchFor(V(host), "sign in"), "Pages").includes("Sign in"));
  check("an ordinary learner is not offered manager pages, a manager is", !titles(searchFor(V(host), "invite"), "Pages").some((x) => /manager/.test(x)) && titles(searchFor(V(mgr), "invite"), "Pages").some((x) => /manager/.test(x)));
  check("a page is found by words that are not in its title", titles(searchFor(V(host), "streak"), "Pages").includes("Achievements") && titles(searchFor(V(host), "password"), "Pages").includes("Profile and settings"));
  check("every hit has a title, a line and a link inside the site", searchFor(V(host), "git").flatMap((g) => g.hits).every((h) => h.title && h.sub && h.href.startsWith("/")));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@search.check")).all().length === 0 && db.select().from(competitions).where(like(competitions.title, "zz-%")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

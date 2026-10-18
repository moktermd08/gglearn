/** Checks sponsors: npm run check:sponsors (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { db, notifications, runs, sponsorships, tracks, users } from "../lib/db";
import { MAX_OPEN_GOALS, MAX_SPONSORS_PER_GOAL, acceptSponsorship, askForSponsor, backedBy, backers, endSponsorship, parseSponsorCode, passedIn, settleSponsorships, sponsorCode } from "../lib/sponsors";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const ok = (r: object) => "ok" in r;
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@sponsor.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(sponsorships).where(inArray(sponsorships.learnerId, us)).run(); db.delete(sponsorships).where(inArray(sponsorships.sponsorId, us)).run();
  db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(runs).where(inArray(runs.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
try {
  const mk = (n: string, status: "active" | "offboarded" = "active") => db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Backer`, email: `${n}@sponsor.check`, jobRole: "general", audience: "staff", guest: "yes", status, passwordHash: "x" }).returning().get();
  const learner = mk("learner"), sponsor = mk("sponsor"), other = mk("other"), gone = mk("gone", "offboarded");
  const me = (u: { id: number }) => ({ id: u.id, role: "learner" as const, audience: "staff" as const });
  const py = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;
  const pass = (u: number, level: number) => db.insert(runs).values({ userId: u, trackId: py.id, level, score: 0.9, passed: true, finishedAt: Math.floor(Date.now() / 1000) }).run();

  // ---- the link ----
  const code = sponsorCode(learner.id, py.id, 10);
  check("a code carries the learner, the topic and the level", JSON.stringify(parseSponsorCode(code)) === JSON.stringify({ learner: learner.id, track: py.id, level: 10 }));
  check("changing the level, the topic or the person breaks it", [code.replace(/\.10\./, ".11."), code.replace(`.${py.id}.`, `.${py.id + 1}.`), sponsorCode(other.id, py.id, 10).replace(/^[^.]+/, learner.id.toString(36)), "junk", "", null].every((c) => parseSponsorCode(c as string) === null));
  check("a learner can ask for a goal in a topic they can pick, above where they are", "code" in askForSponsor(me(learner), py.id, 10) && "error" in askForSponsor(me(learner), 99999999, 10) && "error" in askForSponsor(me(learner), py.id, 0) && "error" in askForSponsor(me(learner), py.id, 21));
  pass(learner.id, 4);
  check("not a level already passed", "error" in askForSponsor(me(learner), py.id, 4) && "code" in askForSponsor(me(learner), py.id, 5));

  // ---- agreeing ----
  check("nothing is shared before anyone agrees", backedBy(sponsor.id).length === 0 && backers(learner.id).length === 0);
  check("nobody can back their own goal, or one from someone who has left", !ok(acceptSponsorship(learner.id, code)) && !ok(acceptSponsorship(sponsor.id, sponsorCode(gone.id, py.id, 10))) && !ok(acceptSponsorship(sponsor.id, "junk")));
  check("pressing the button makes them a sponsor and tells the learner", ok(acceptSponsorship(sponsor.id, code)) && backedBy(sponsor.id).length === 1 && db.select().from(notifications).where(and(eq(notifications.userId, learner.id), like(notifications.key, "sponsor-yes-%"))).all().length === 1);
  check("doing it twice changes nothing", ok(acceptSponsorship(sponsor.id, code)) && db.select().from(sponsorships).where(eq(sponsorships.learnerId, learner.id)).all().length === 1);
  const seen = backedBy(sponsor.id)[0];
  check("the sponsor sees the goal and progress, a first name, and nothing else", seen.level === 10 && seen.passed === 4 && /^Learner B\.?$/.test(seen.person) && !JSON.stringify(seen).includes("@") && Object.keys(seen).sort().join() === "certificate,id,level,passed,person,reachedAt,since,topic");
  check("the learner sees who backs them", backers(learner.id).length === 1 && backers(learner.id)[0].person.startsWith("Sponsor"));
  check("a goal is not reached just because time passes", (settleSponsorships(learner.id), backedBy(sponsor.id)[0].reachedAt === null));

  // ---- reaching it ----
  pass(learner.id, 10);
  check("progress shows, but it is not reached until the award is recognised", backedBy(sponsor.id)[0].passed === 10 && backedBy(sponsor.id)[0].reachedAt === null);
  settleSponsorships(learner.id);
  check("then both are told, once", backedBy(sponsor.id)[0].reachedAt !== null && db.select().from(notifications).where(and(eq(notifications.userId, sponsor.id), like(notifications.key, "sponsor-done-%"))).all().length === 1 && db.select().from(notifications).where(and(eq(notifications.userId, learner.id), like(notifications.key, "sponsor-done-me-%"))).all().length === 1);
  settleSponsorships(learner.id);
  check("settling again tells nobody twice", db.select().from(notifications).where(and(eq(notifications.userId, sponsor.id), like(notifications.key, "sponsor-done-%"))).all().length === 1);
  check("nobody can back a goal that is already reached", !ok(acceptSponsorship(other.id, code)) && passedIn(learner.id, py.id) === 10);

  // ---- limits and ending ----
  const goal = sponsorCode(learner.id, py.id, 15);
  const many = Array.from({ length: MAX_SPONSORS_PER_GOAL }, (_, i) => mk(`s${i}`));
  for (const s of many) acceptSponsorship(s.id, goal);
  check("a goal has at most five sponsors", !ok(acceptSponsorship(other.id, goal)) && many.every((s) => backedBy(s.id).length === 1));
  endSponsorship(learner.id, backedBy(many[0].id)[0].id);
  check("the learner can end one, and the sponsor stops seeing it", backedBy(many[0].id).length === 0 && ok(acceptSponsorship(other.id, goal)));
  endSponsorship(other.id, backedBy(other.id)[0].id);
  check("the sponsor can end it too, and neither is told", backedBy(other.id).length === 0 && db.select().from(notifications).where(and(eq(notifications.userId, learner.id), like(notifications.key, "sponsor-end%"))).all().length === 0);
  check("a stranger cannot end someone else’s sponsorship", (endSponsorship(other.id, backedBy(many[1].id)[0].id), backedBy(many[1].id).length === 1));
  const busy = mk("busy");
  for (let l = 5; l < 5 + MAX_OPEN_GOALS; l++) db.insert(sponsorships).values({ sponsorId: sponsor.id, learnerId: busy.id, trackId: py.id, level: l }).run();
  check("a learner has at most five goals open", "error" in askForSponsor(me(busy), py.id, 19) && "code" in askForSponsor(me(busy), py.id, 5));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@sponsor.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

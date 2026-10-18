/** Checks the honest social proof numbers: npm run check:proof (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { competitionMembers, competitions, dailyQuests, db, enrollments, runs, tracks, users } from "../lib/db";
import { MIN_SHOWN, computeSiteProof, proofLines, rawSiteProof, rawTopicProof, shown, topicProof, type SiteProof } from "../lib/proof";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- the rules ----
check("a number below the bar is not shown, at the bar it is", shown(MIN_SHOWN - 1) === null && shown(MIN_SHOWN) === MIN_SHOWN && shown(0) === null && shown(1000) === 1000);
check("the bar is at least five, so one person is never a statistic", MIN_SHOWN >= 5);
const none: SiteProof = { learners: null, levels: null, certificates: null, racers: null, races: 300 };
check("with nothing worth saying there are no lines, and no zeros", proofLines(none).length === 0 && !proofLines(none).join(" ").includes("0 "));
const some = proofLines({ learners: 1234, levels: 80, certificates: null, racers: 9, races: 5 });
check("lines are plain and use real numbers", some.join("|") === "1,234 people practised this week|80 levels passed this week|9 people racing right now");
check("the count of races on offer is a fact about the offer, kept apart from the people-counts", !proofLines({ ...none, races: 300 }).some((l) => /race/.test(l) && /300/.test(l)));

// ---- the real counts ----
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@proof.check")).all().map((r) => r.id);
  const cs = db.select({ id: competitions.id }).from(competitions).where(like(competitions.title, "zz-%")).all().map((r) => r.id);
  if (cs.length) db.delete(competitionMembers).where(inArray(competitionMembers.competitionId, cs)).run();
  if (us.length) { db.delete(runs).where(inArray(runs.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(enrollments).where(inArray(enrollments.userId, us)).run(); }
  if (cs.length) db.delete(competitions).where(inArray(competitions.id, cs)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400, day = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
try {
  const track = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;
  const mk = (n: string, status: "active" | "offboarded" = "active") => db.insert(users).values({ name: `P${n} Tester`, email: `p${n}@proof.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x", status }).returning().get();
  const people = Array.from({ length: 6 }, (_, i) => mk(String(i))), gone = mk("gone", "offboarded");
  const before = rawSiteProof(t), topicBefore = rawTopicProof(track.id, t);

  // three do a quest, two pass a level (one of them twice, same level), one old activity, one offboarded
  for (const u of people.slice(0, 3)) db.insert(dailyQuests).values({ userId: u.id, trackId: track.id, day: day(t - D), kind: "drill", xp: 30 }).run();
  db.insert(runs).values({ userId: people[3].id, trackId: track.id, level: 91, score: 0.9, passed: true, finishedAt: t - 2 * D }).run();
  db.insert(runs).values({ userId: people[3].id, trackId: track.id, level: 91, score: 0.95, passed: true, finishedAt: t - D }).run();   // the same level again: one level, not two
  db.insert(runs).values({ userId: people[4].id, trackId: track.id, level: 92, score: 0.9, passed: true, finishedAt: t - 3 * D }).run();
  db.insert(runs).values({ userId: people[5].id, trackId: track.id, level: 93, score: 0.9, passed: true, finishedAt: t - 20 * D }).run(); // too long ago for this week
  db.insert(dailyQuests).values({ userId: gone.id, trackId: track.id, day: day(t - D), kind: "drill", xp: 30 }).run();
  const after = rawSiteProof(t);
  check("people active this week are counted once each: 3 quests + 2 passers, not the old one, not the offboarded", after.learners - before.learners === 5);
  check("a level is counted once per person and topic, however often it is passed", after.levels - before.levels === 2);

  // a public race with three people in it, and a private one with two
  const race = (slug: string, vis: "public" | "private") => db.insert(competitions).values({ slug, title: `zz-${slug}`, description: "", trackId: track.id, createdBy: people[0].id, visibility: vis, joinPolicy: "invite", goalLevels: 2, startsAt: t - D, endsAt: t + D, maxHumans: 10, prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "", twist: "off" }).returning().get();
  const pub = race("proof-pub", "public"), priv = race("proof-priv", "private");
  for (const u of people.slice(0, 3)) db.insert(competitionMembers).values({ competitionId: pub.id, kind: "human", userId: u.id, status: "joined", joinedAt: t - D }).run();
  for (const u of people.slice(3, 5)) db.insert(competitionMembers).values({ competitionId: priv.id, kind: "human", userId: u.id, status: "joined", joinedAt: t - D }).run();
  db.insert(competitionMembers).values({ competitionId: pub.id, kind: "human", userId: people[5].id, status: "invited", joinedAt: t }).run();
  db.insert(competitionMembers).values({ competitionId: pub.id, kind: "bot", userId: null, status: "joined", joinedAt: t - D, botName: "Echo" }).run();
  const raced = rawSiteProof(t);
  check("only people in public races that are running count as racing: not private, not invited, not bots", raced.racers - after.racers === 3);
  check("running public races are counted, private ones are not", raced.races - after.races === 1);
  db.update(competitions).set({ canceledAt: t }).where(eq(competitions.id, pub.id)).run();
  check("a cancelled race stops counting", rawSiteProof(t).races === after.races && rawSiteProof(t).racers === after.racers);

  // a topic: six enrolled and one offboarded; three passed a level within 30 days (one of them 20 days ago), one 40 days ago
  for (const u of [...people, gone]) db.insert(enrollments).values({ userId: u.id, trackId: track.id }).run();
  const old = mk("old"); db.insert(runs).values({ userId: old.id, trackId: track.id, level: 94, score: 0.9, passed: true, finishedAt: t - 40 * D }).run();
  const tp = rawTopicProof(track.id, t);
  check("people enrolled in a topic are counted once each, and offboarded ones are not", tp.learners - topicBefore.learners === 6);
  check("people who passed a level in the last 30 days are counted: three, not the one from 40 days ago", tp.passedThisMonth - topicBefore.passedThisMonth === 3);
  check("the topic's shown numbers follow the bar", (topicProof(track.id, t).learners === null) === (tp.learners < MIN_SHOWN) && (topicProof(track.id, t).passedThisMonth === null) === (tp.passedThisMonth < MIN_SHOWN));

  // the filtered version never shows what is under the bar
  const filtered = computeSiteProof(t);
  check("every people-count in the filtered numbers is either hidden or at least the bar", [filtered.learners, filtered.levels, filtered.certificates, filtered.racers].every((v) => v === null || v >= MIN_SHOWN));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@proof.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

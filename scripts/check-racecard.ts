/** Checks the share card for a race: npm run check:racecard (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { inArray, like } from "drizzle-orm";
import { competitionMembers, competitions, db, runs, tracks, users } from "../lib/db";
import { snapshotFor } from "../lib/share";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const cs = db.select({ id: competitions.id }).from(competitions).where(like(competitions.title, "rc-%")).all().map((r) => r.id);
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@race.check")).all().map((r) => r.id);
  if (cs.length) db.delete(competitionMembers).where(inArray(competitionMembers.competitionId, cs)).run();
  if (us.length) { db.delete(runs).where(inArray(runs.userId, us)).run(); }
  if (cs.length) db.delete(competitions).where(inArray(competitions.id, cs)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400;
try {
  const mkUser = (n: string, full: string) => db.insert(users).values({ name: full, email: `${n}@race.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const host = mkUser("host", "Hana Host"), friend = mkUser("friend", "Finn Friendly"), stranger = mkUser("stranger", "Sam Stranger"), invited = mkUser("invited", "Ivy Invited");
  const track = db.select().from(tracks).get()!;
  const race = (slug: string, over: Partial<typeof competitions.$inferInsert>) => {
    const c = db.insert(competitions).values({ slug, title: `rc-${slug}`, description: "", trackId: track.id, createdBy: host.id, visibility: "public", joinPolicy: "invite", goalLevels: 2,
      startsAt: t - 10 * D, endsAt: t - 2 * D, maxHumans: 10, prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "", twist: "off", ...over }).returning().get();
    for (const u of [host, friend]) db.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: u.id, status: "joined", joinedAt: c.startsAt }).run();
    db.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: invited.id, status: "invited", joinedAt: c.startsAt }).run();
    return c;
  };
  const pass = (userId: number, level: number, at: number) => db.insert(runs).values({ userId, trackId: track.id, level, score: 0.9, passed: true, finishedAt: at }).run();

  // a finished race: the friend reaches the goal, the host gets one level
  const done = race("rc-done", {});
  pass(friend.id, 1, t - 8 * D); pass(friend.id, 2, t - 7 * D); pass(host.id, 1, t - 6 * D);
  const win = snapshotFor(friend, "race", "rc-done")!, second = snapshotFor(host, "race", "rc-done")!;
  check("the winner's card says #1 and Won", win?.headline === "#1" && win.title.startsWith("Won: ") && win.tone === "gold");
  check("...and that they reached the goal, out of how many racers", /Reached the goal\. 2 of 2 levels/.test(win.subtitle ?? "") && /out of 2 racers/.test(win.subtitle ?? ""));
  check("second place gets #2, silver, and does not claim a win", second.headline === "#2" && second.tone === "silver" && !second.title.startsWith("Won") && second.title.startsWith("Raced: "));
  check("the card shows first name and initial only", win.name === "Finn F." && second.name === "Hana H.");
  check("the card's ref is the race, so sharing again refreshes the same card", win.ref === "rc-done" && win.kind === "race");

  check("someone who is not in the race gets nothing", snapshotFor(stranger, "race", "rc-done") === null);
  check("someone only invited gets nothing", snapshotFor(invited, "race", "rc-done") === null);
  check("an unknown race gives nothing", snapshotFor(friend, "race", "no-such-race") === null);

  // private: the name is never on the card
  const priv = race("rc-priv", { visibility: "private", title: "rc-Secret Project Name" });
  pass(friend.id, 1, t - 8 * D);
  const p = snapshotFor(friend, "race", "rc-priv")!;
  check("a private race's name is not on the card", !JSON.stringify(p).includes("Secret") && p.title.includes("a private race"));

  // live
  const live = race("rc-live", { startsAt: t - 2 * D, endsAt: t + 5 * D });
  pass(friend.id, 3, t - D); // the race counts levels above where they started; earlier passes set the baseline
  const l = snapshotFor(friend, "race", "rc-live")!;
  check("a live race shows progress, not a result", l.tone === "orange" && l.title.startsWith("Racing: ") && /^(\+\d+|Racing)$/.test(l.headline) && /so far|of 2 level/.test(l.subtitle ?? ""));
  void live;

  // upcoming and cancelled
  race("rc-soon", { startsAt: t + 2 * D, endsAt: t + 9 * D });
  const s = snapshotFor(friend, "race", "rc-soon")!;
  check("a race that has not started says Joined", s.headline === "Joined" && s.title.startsWith("Racing: "));
  const cancelled = race("rc-gone", { canceledAt: t - D });
  check("a cancelled race cannot be shared", snapshotFor(friend, "race", "rc-gone") === null);
  void cancelled; void done;
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@race.check")).all().length === 0 && db.select().from(competitions).where(like(competitions.title, "rc-%")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

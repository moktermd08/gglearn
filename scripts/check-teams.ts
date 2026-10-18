/** Checks teams: npm run check:teams (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Needs SESSION_SECRET. Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { dailyQuests, db, runs, teamMembers, teams, tracks, users } from "../lib/db";
import { MAX_MY_TEAMS, MAX_TEAM_SIZE, addMember, joinState, memberCount, membersOf, teamByToken, teamPath, teamToken } from "../lib/teams";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@team.check")).all().map((r) => r.id);
  const ts = db.select({ id: teams.id }).from(teams).where(like(teams.name, "t-%")).all().map((r) => r.id);
  if (ts.length) db.delete(teamMembers).where(inArray(teamMembers.teamId, ts)).run();
  if (us.length) { db.delete(teamMembers).where(inArray(teamMembers.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(runs).where(inArray(runs.userId, us)).run(); }
  if (ts.length) db.delete(teams).where(inArray(teams.id, ts)).run();
  if (us.length) db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t0 = Math.floor(Date.now() / 1000);
try {
  const mkUser = (n: string) => db.insert(users).values({ name: n, email: `${n}@team.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const owner = mkUser("owner"), a = mkUser("a"), b = mkUser("b"), c = mkUser("c");
  const team = db.insert(teams).values({ name: "t-squad", ownerId: owner.id }).returning().get();
  const track = db.select().from(tracks).get()!;

  check("a team's link leads back to it", teamByToken(teamToken(team.id))?.id === team.id && teamPath(team.id) === `/t/${teamToken(team.id)}`);
  check("a changed signature is refused", teamByToken(`${team.id}.${"A".repeat(20)}`) === null);
  check("another team's number with this signature is refused", teamByToken(`${team.id + 1}.${teamToken(team.id).split(".")[1]}`) === null);
  check("junk is refused", ["", "1", "1.", "x.y", "../..", `${team.id}.${"A".repeat(19)}`].every((x) => teamByToken(x) === null));

  check("the owner is added even when joining is off", (() => { db.update(teams).set({ joinOpen: false }).where(eq(teams.id, team.id)).run(); const r = addMember(team.id, owner.id, { force: true }); db.update(teams).set({ joinOpen: true }).where(eq(teams.id, team.id)).run(); return r === null; })());
  check("someone joins an open team", addMember(team.id, a.id) === null && memberCount(team.id) === 2);
  check("joining twice changes nothing", addMember(team.id, a.id) === null && memberCount(team.id) === 2);
  db.update(teams).set({ joinOpen: false }).where(eq(teams.id, team.id)).run();
  check("a closed-to-new-people team refuses a joiner", addMember(team.id, b.id) !== null && memberCount(team.id) === 2);
  check("...and says so", joinState(db.select().from(teams).where(eq(teams.id, team.id)).get()!) === "closed");
  db.update(teams).set({ joinOpen: true }).where(eq(teams.id, team.id)).run();

  db.update(teams).set({ archivedAt: t0 }).where(eq(teams.id, team.id)).run();
  check("a closed team takes nobody", addMember(team.id, b.id) !== null);
  db.update(teams).set({ archivedAt: null }).where(eq(teams.id, team.id)).run();

  // fill it up
  const fillers = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => mkUser(`f${i}`));
  let ok = 0; for (const f of fillers) if (addMember(team.id, f.id) === null) ok++;
  check("a team stops at its size limit", memberCount(team.id) === MAX_TEAM_SIZE && ok === MAX_TEAM_SIZE - 2);
  check("a full team says so and refuses more", addMember(team.id, c.id) !== null && joinState(db.select().from(teams).where(eq(teams.id, team.id)).get()!) === "full");

  // what the board shows
  db.insert(dailyQuests).values({ userId: a.id, trackId: track.id, day: new Date(t0 * 1000).toISOString().slice(0, 10), kind: "drill", xp: 30 }).run();
  db.insert(runs).values({ userId: a.id, trackId: track.id, level: 1, score: 0.9, passed: true, finishedAt: t0 }).run();
  db.insert(runs).values({ userId: owner.id, trackId: track.id, level: 1, score: 0.5, passed: false, finishedAt: t0 }).run();
  db.insert(runs).values({ userId: owner.id, trackId: track.id, level: 2, score: 1, passed: true, finishedAt: t0 - 20 * 86400 }).run(); // long ago: no XP this week, but a level
  const rows = membersOf(db.select().from(teams).where(eq(teams.id, team.id)).get()!);
  const ra = rows.find((r) => r.userId === a.id)!, ro = rows.find((r) => r.userId === owner.id)!;
  check("XP this week is quests plus exams in the last seven days", ra.weekXp === 30 + 90 + 50);
  check("a failed exam still earns its points, an old one none", ro.weekXp === 50);
  check("levels count everything ever passed", ra.levels === 1 && ro.levels === 1);
  check("the best week is first", rows[0].userId === a.id);
  check("the owner is marked", ro.owner && !ra.owner);
  check("someone who left the academy is not listed", (() => { db.update(users).set({ status: "offboarded" }).where(eq(users.id, a.id)).run(); const r = membersOf(db.select().from(teams).where(eq(teams.id, team.id)).get()!); db.update(users).set({ status: "active" }).where(eq(users.id, a.id)).run(); return !r.some((x) => x.userId === a.id); })());

  // a person's own limit
  const many = Array.from({ length: MAX_MY_TEAMS }, (_, i) => db.insert(teams).values({ name: `t-many${i}`, ownerId: c.id }).returning().get());
  for (const m of many) addMember(m.id, c.id, { force: true });
  const extra = db.insert(teams).values({ name: "t-extra", ownerId: owner.id }).returning().get();
  check("nobody can be in more than the allowed number of teams", addMember(extra.id, c.id) !== null);
} finally {
  sweep();
}
console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);

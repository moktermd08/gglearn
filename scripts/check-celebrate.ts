/** Checks celebration moments and their share cards: npm run check:celebrate (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { inArray, like } from "drizzle-orm";
import { db, duels, leagueEntries, notifications, tracks, users } from "../lib/db";
import { celebrationOf, latestCelebration } from "../lib/celebrate";
import { markRead } from "../lib/notifications";
import { snapshotFor } from "../lib/share";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const note = (key: string, kind: string, title = "T", body = "") => ({ id: 1, key, kind, title, body });

// ---- which events are celebrations ----
check("a badge is a celebration, and shares that badge", (() => { const c = celebrationOf(note("badge-streak-7", "badge", "Badge earned: Unstoppable")); return c?.share.kind === "badge" && c.share.ref === "streak-7"; })());
check("a player level-up shares the level card", celebrationOf(note("level-12", "level"))?.share.kind === "level");
check("a league promotion is one", celebrationOf(note("league-2026-W41", "season", "Promoted to Gold league"))?.share.ref === "2026-W41");
check("being moved down is not", celebrationOf(note("league-2026-W41", "season", "Moved down to Silver league")) === null);
check("winning a weekly season is one", celebrationOf(note("season-week-2026-W41", "season", "Season results", "You finished #1 of 20 with 300 points."))?.headline === "You won the season");
check("a podium place is one, and shares that exact season", (() => { const c = celebrationOf(note("season-week-2026-W41", "season", "Season results", "You finished #3 of 20 with 300 points.")); return c?.headline === "On the podium" && c.share.ref === "week:2026-W41"; })());
check("a monthly key is read correctly", celebrationOf(note("season-month-2026-10", "season", "x", "You finished #2 of 9"))?.share.ref === "month:2026-10");
check("fourth place and below is not", celebrationOf(note("season-week-2026-W41", "season", "x", "You finished #4 of 20")) === null);
check("an invitation, a streak freeze and a system notice are not", [note("invite-5", "contest"), note("freeze-grant-welcome", "badge", "Streak freeze earned"), note("cert-expiring-1", "system")].every((n) => celebrationOf(n) === null));

// ---- picking one for a person ----
const t = Math.floor(Date.now() / 1000);
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@celebrate.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(notifications).where(inArray(notifications.userId, us)).run();
  db.delete(duels).where(inArray(duels.hostId, us)).run();
  db.delete(leagueEntries).where(inArray(leagueEntries.userId, us)).run();
  db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
try {
  const mk = (n: string) => db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Tester`, email: `${n}@celebrate.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const me = mk("me"), other = mk("other"), nobody = mk("nobody");
  const add = (userId: number, key: string, kind: "badge" | "level" | "season" | "contest" | "system", title: string, body = "", ageSec = 60, read = false) =>
    db.insert(notifications).values({ userId, key, kind, title, body, href: "", createdAt: t - ageSec, readAt: read ? t : null }).returning().get();
  check("someone with nothing to celebrate gets nothing", latestCelebration(nobody.id) === null);
  add(me.id, "badge-old", "badge", "Badge earned: Old", "", 4 * 86400);
  add(me.id, "badge-seen", "badge", "Badge earned: Seen", "", 120, true);
  add(me.id, "invite-1", "contest", "You are invited");
  check("an old one, one already seen and a non-celebration are all ignored", latestCelebration(me.id) === null);
  const first = add(me.id, "badge-first", "badge", "Badge earned: First", "", 300);
  const second = add(me.id, "level-5", "level", "Level up! You are player level 5", "", 100);
  check("the newest unread celebration is the one shown", latestCelebration(me.id)?.id === second.id);
  markRead(me.id, second.id);
  check("once dismissed it never comes back, and the next one follows", latestCelebration(me.id)?.id === first.id);
  markRead(me.id, first.id);
  check("when all are seen there is nothing", latestCelebration(me.id) === null);
  add(other.id, "badge-x", "badge", "Badge earned: X");
  check("one person's celebration is never shown to another", latestCelebration(me.id) === null && latestCelebration(other.id) !== null);

  // ---- the new cards ----
  const track = db.select().from(tracks).get()!;
  const KEY = "2099-W07";
  db.insert(leagueEntries).values({ key: KEY, audience: "staff", arena: "celebrate-arena", userId: me.id, tier: 1, cohort: 1, points: 450, rank: 2, outcome: "up" }).run();
  db.insert(leagueEntries).values({ key: KEY, audience: "staff", arena: "celebrate-arena", userId: other.id, tier: 1, cohort: 1, points: 100, rank: 9, outcome: "stay" }).run();
  const lg = snapshotFor(me, "league", KEY);
  check("a promotion makes a league card", lg?.headline === "Gold" && /Promoted to Gold league/.test(lg.title) && /#2 of 2 in Silver league with 450 points/.test(lg.subtitle ?? ""));
  check("someone who stayed cannot share a promotion", snapshotFor(other, "league", KEY) === null);
  check("nor can someone who was never in that week", snapshotFor(nobody, "league", KEY) === null && snapshotFor(me, "league", "2099-W99") === null);
  check("the card shows first name and initial only", lg?.name === "Me T.");

  const d = db.insert(duels).values({ code: "cel-won-1", trackId: track.id, hostId: me.id, guestId: other.id, status: "done", hostPoints: 590, guestPoints: 430 }).returning().get();
  db.insert(duels).values({ code: "cel-live-1", trackId: track.id, hostId: me.id, guestId: other.id, status: "live" }).run();
  db.insert(duels).values({ code: "cel-bot-1", trackId: track.id, hostId: me.id, botSeed: "seed-9", status: "done", hostPoints: 300, guestPoints: 400 }).run();
  const won = snapshotFor(me, "duel", d.code), lost = snapshotFor(other, "duel", d.code);
  check("a won duel makes a Won card with the score and the opponent", won?.headline === "Won" && won.tone === "gold" && /590 to 430 against Other T\./.test(won.subtitle ?? ""));
  check("the other player's card is from their side", lost?.headline === "Lost" && /430 to 590/.test(lost.subtitle ?? ""));
  check("a duel still being played cannot be shared", snapshotFor(me, "duel", "cel-live-1") === null);
  check("someone who was not in it cannot share it", snapshotFor(nobody, "duel", d.code) === null && snapshotFor(me, "duel", "no-such-duel") === null);
  const bot = snapshotFor(me, "duel", "cel-bot-1");
  check("against a simulated rival the card says so", bot?.headline === "Lost" && /\(simulated\)/.test(bot.subtitle ?? ""));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@celebrate.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

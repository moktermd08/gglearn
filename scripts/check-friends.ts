/** Checks friends, the friends' feed and cheers: npm run check:friends (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows). Run db:push first. */
import { and, eq, inArray, like, or } from "drizzle-orm";
import { brands, certificates, cheers, dailyQuests, db, friendships, notifications, runs, tracks, userBadges, users } from "../lib/db";
import { MAX_PENDING_OUT, areFriends, befriendByLink, cheer, feedFor, friendIds, relation, remove, requestByEmail, requestsFor, respond, weekBoard } from "../lib/friends";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@friends.check")).all().map((r) => r.id);
  if (!us.length) return;
  db.delete(cheers).where(inArray(cheers.fromId, us)).run(); db.delete(cheers).where(inArray(cheers.toId, us)).run();
  db.delete(friendships).where(inArray(friendships.requesterId, us)).run(); db.delete(friendships).where(inArray(friendships.addresseeId, us)).run();
  db.delete(notifications).where(inArray(notifications.userId, us)).run(); db.delete(certificates).where(inArray(certificates.userId, us)).run();
  db.delete(userBadges).where(inArray(userBadges.userId, us)).run(); db.delete(runs).where(inArray(runs.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run();
  db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const t = Math.floor(Date.now() / 1000), D = 86400, ok = (r: { ok?: true; error?: string }) => "ok" in r;
try {
  const mk = (n: string, status: "active" | "offboarded" = "active", role: "learner" | "admin" = "learner") => db.insert(users).values({ name: `${n[0].toUpperCase()}${n.slice(1)} Tester`, email: `${n}@friends.check`, jobRole: "general", audience: "staff", guest: "yes", role, status, passwordHash: "x" }).returning().get();
  const ana = mk("ana"), ben = mk("ben"), cara = mk("cara"), dan = mk("dan"), gone = mk("gone", "offboarded"), boss = mk("boss", "active", "admin");
  const track = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;
  const staff = db.select({ id: tracks.id, name: tracks.name }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).where(and(eq(tracks.audience, "staff"), eq(brands.kind, "company"))).limit(1).get()!;
  const notes = (uid: number, like_: string) => db.select().from(notifications).where(and(eq(notifications.userId, uid), like(notifications.key, like_))).all().length;
  const MSG = "If that address has an account, they have been asked";

  // ---- asking by email ----
  const unknown = requestByEmail(ana.id, "nobody@friends.check"), real = requestByEmail(ana.id, " BEN@friends.check ");
  check("an unknown address, an own address and a closed account all get the same polite answer as a real one", [unknown, requestByEmail(ana.id, ana.email), requestByEmail(ana.id, gone.email), real].every((r) => ok(r) && (r as { message?: string }).message?.startsWith(MSG)));
  check("only the real address made a request", db.select().from(friendships).where(eq(friendships.requesterId, ana.id)).all().length === 1 && relation(ana.id, ben.id)?.status === "pending");
  check("the person asked is told, and nobody else", notes(ben.id, "friend-req-%") === 1 && notes(cara.id, "friend-req-%") === 0);
  requestByEmail(ana.id, ben.email);
  check("asking twice makes one request", db.select().from(friendships).where(eq(friendships.requesterId, ana.id)).all().length === 1);
  check("a request is not a friendship: nothing is shared yet", !areFriends(ana.id, ben.id) && friendIds(ana.id).length === 0 && feedFor(ana.id).length === 0);
  check("the person asked sees it in their requests, by first name and initial", requestsFor(ben.id).length === 1 && requestsFor(ben.id)[0].name === "Ana T." && requestsFor(ana.id).length === 0);

  // ---- answering ----
  const req = requestsFor(ben.id)[0];
  check("only the person asked can answer", !ok(respond(cara.id, req.id, true)) && !ok(respond(ana.id, req.id, true)) && !ok(respond(ben.id, 99999999, true)));
  check("saying yes makes them friends, both ways, and tells the asker", ok(respond(ben.id, req.id, true)) && areFriends(ana.id, ben.id) && areFriends(ben.id, ana.id) && friendIds(ana.id).includes(ben.id) && notes(ana.id, "friend-yes-%") === 1);
  check("a request cannot be answered twice", !ok(respond(ben.id, req.id, true)));

  requestByEmail(cara.id, dan.email);
  check("saying no deletes the request without telling the asker", ok(respond(dan.id, requestsFor(dan.id)[0].id, false)) && relation(cara.id, dan.id) === undefined && notes(cara.id, "friend-yes-%") === 0);
  requestByEmail(dan.id, cara.email); requestByEmail(cara.id, dan.email);
  check("if they have each asked the other, they are friends", areFriends(cara.id, dan.id));

  // ---- friend links ----
  check("a friend link makes friends at once, and tells the person who shared it", ok(befriendByLink(ana.id, cara.id)) && areFriends(ana.id, cara.id) && notes(ana.id, `friend-yes-${cara.id}`) === 1);
  check("your own link, and a closed account's, do nothing", !ok(befriendByLink(ana.id, ana.id)) && !ok(befriendByLink(gone.id, ben.id)));
  check("using a link for someone you are already friends with is fine and adds nothing", ok(befriendByLink(ana.id, ben.id)) && db.select().from(friendships).where(and(eq(friendships.requesterId, ana.id), eq(friendships.addresseeId, ben.id))).all().length === 1);
  const eve = mk("eve"); requestByEmail(eve.id, ben.email);
  check("a link used while a request is waiting settles it", ok(befriendByLink(ben.id, eve.id)) && areFriends(ben.id, eve.id) && db.select().from(friendships).where(or(and(eq(friendships.requesterId, ben.id), eq(friendships.addresseeId, eve.id)), and(eq(friendships.requesterId, eve.id), eq(friendships.addresseeId, ben.id)))).all().length === 1);

  // ---- ending ----
  remove(cara.id, dan.id);
  check("either side can end a friendship, and neither is told", !areFriends(cara.id, dan.id) && relation(cara.id, dan.id) === undefined);
  const spam = mk("spam"); for (let i = 0; i < MAX_PENDING_OUT; i++) { const u = mk(`t${i}`); requestByEmail(spam.id, u.email); }
  check("nobody can have more than a few requests waiting", !ok(requestByEmail(spam.id, ana.email)) && db.select().from(friendships).where(and(eq(friendships.requesterId, spam.id), eq(friendships.status, "pending"))).all().length === MAX_PENDING_OUT);

  // ---- the week ----
  db.insert(dailyQuests).values({ userId: ben.id, trackId: track.id, day: new Date(t * 1000).toISOString().slice(0, 10), kind: "drill", xp: 30 }).run();
  db.insert(dailyQuests).values({ userId: dan.id, trackId: track.id, day: new Date(t * 1000).toISOString().slice(0, 10), kind: "drill", xp: 30 }).run(); // not a friend of ana any more
  const board = weekBoard(ana.id, t);
  check("the week shows me and my friends, best first, and not people who are not", board.map((r) => r.userId).sort().join() === [ana.id, ben.id, cara.id].sort().join() && board[0].userId === ben.id && board[0].weekXp === 30);
  check("I am shown as You, a friend by first name and initial", board.find((r) => r.me)?.name === "You" && board.find((r) => r.userId === ben.id)?.name === "Ben T.");

  // ---- the feed ----
  const pass = (u: number, trackId: number, level: number, at: number) => db.insert(runs).values({ userId: u, trackId, level, score: 0.9, passed: true, finishedAt: at }).returning().get();
  const p1 = pass(ben.id, track.id, 91, t - D), p1again = pass(ben.id, track.id, 91, t - 2 * 3600);
  pass(ben.id, track.id, 92, t - 20 * D);              // too old
  pass(dan.id, track.id, 91, t - D);                   // not a friend
  const secret = pass(ben.id, staff.id, 93, t - 3600); // a company-only topic
  db.insert(userBadges).values({ userId: cara.id, key: "streak-3", earnedAt: t - 3600 }).run();
  db.insert(certificates).values({ userId: ben.id, trackId: track.id, level: 5, code: "FRIENDCERT1", score: 0.9, issuedAt: t - 7200, signature: "x" }).run();
  db.insert(certificates).values({ userId: ben.id, trackId: track.id, level: 10, code: "FRIENDCERT2", score: 0.9, issuedAt: t - 7200, revokedAt: t, signature: "x" }).run();
  const feed = feedFor(ana.id, t);
  const text = feed.map((f) => `${f.name}: ${f.text}`);
  check("a level passed is in the feed, once, however often it was passed again", feed.filter((f) => f.key === `pass:${p1.id}`).length === 1 && !feed.some((f) => f.key === `pass:${p1again.id}`));
  check("badges and certificates are in it, a revoked certificate is not", text.includes("Cara T.: earned the On Fire badge") && feed.some((f) => f.key === "cert:FRIENDCERT1") && !feed.some((f) => f.key === "cert:FRIENDCERT2"));
  check("old things and non-friends are not", !feed.some((f) => /level 92/.test(f.text)) && !feed.some((f) => f.name.startsWith("Dan")));
  check("it is newest first", feed.every((f, i) => i === 0 || feed[i - 1].at >= f.at));
  const secretItem = feed.find((f) => f.key === `pass:${secret.id}`);
  check("a company-only topic is not named to someone who cannot see it", !!secretItem && /in a topic$/.test(secretItem.text) && !secretItem.text.includes(staff.name));
  check("...but is to the person who runs the whole academy (a friend of Ben's)", (() => { befriendByLink(ben.id, boss.id); const f = feedFor(boss.id, t).find((x) => x.key === `pass:${secret.id}`); return !!f && f.text.includes(staff.name.replace(/^\d+\.\s*/, "").replace(/:\s*Novice to Titan$/, "")); })());
  check("a topic the viewer can see is named", /in Python$/.test(feed.find((f) => f.key === `pass:${p1.id}`)!.text));
  check("everyone sees only their own friends' events", feedFor(eve.id, t).every((f) => f.userId === ben.id));
  check("someone with no friends has an empty feed", feedFor(spam.id, t).length === 0 && feedFor(gone.id, t).length === 0);

  // ---- cheers ----
  check("a friend can cheer a friend's event", ok(cheer(ana.id, `pass:${p1.id}`)) && db.select().from(cheers).where(eq(cheers.eventKey, `pass:${p1.id}`)).all().length === 1);
  check("cheering the same thing again changes nothing", ok(cheer(ana.id, `pass:${p1.id}`)) && db.select().from(cheers).where(eq(cheers.eventKey, `pass:${p1.id}`)).all().length === 1 && notes(ben.id, "cheer-%") === 1);
  check("the person is told who cheered", /Ana T\. cheered you/.test(db.select().from(notifications).where(and(eq(notifications.userId, ben.id), like(notifications.key, "cheer-%"))).get()!.title));
  check("the feed shows the count and that I cheered", (() => { const f = feedFor(ana.id, t).find((x) => x.key === `pass:${p1.id}`)!; return f.cheers === 1 && f.cheered; })());
  check("someone else sees the count but has not cheered", (() => { const f = feedFor(cara.id, t).find((x) => x.key === `pass:${p1.id}`); return !f || (f.cheers === 1 && !f.cheered); })());
  check("you cannot cheer a stranger's event, your own, one that does not exist, or junk", !ok(cheer(eve.id, `badge:${cara.id}:streak-3`)) && !ok(cheer(ben.id, `pass:${p1.id}`)) && !ok(cheer(ana.id, "pass:99999999")) && !ok(cheer(ana.id, "x".repeat(200))) && !ok(cheer(ana.id, "")));
  check("a friend of a different friend cannot cheer an event they cannot see", !ok(cheer(dan.id, `pass:${p1.id}`)));
  remove(ana.id, ben.id);
  check("after the friendship ends, the cheer button stops working and the feed empties of them", !ok(cheer(ana.id, `pass:${p1.id}`)) && !feedFor(ana.id, t).some((f) => f.userId === ben.id));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@friends.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

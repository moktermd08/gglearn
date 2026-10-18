/** Checks reminders and the weekly recap: npm run check:nudges (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows; sends nothing real). Needs SESSION_SECRET. */
import { eq, inArray, like } from "drizzle-orm";
import { dailyQuests, db, emailLog, tracks, users } from "../lib/db";
import { recapWindow, runNudges, streakWindow, unsubToken, userOfUnsubToken } from "../lib/nudges";
import { recapMail, streakMail } from "../lib/nudgeMail";
import type { Mail } from "../lib/mail";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const T = (s: string) => new Date(s);

// ---- the pure parts ----
check("an unsubscribe token leads back to its person", userOfUnsubToken(unsubToken(42)) === 42);
check("a changed signature is refused", userOfUnsubToken(`42.${"A".repeat(22)}`) === null);
check("another person's number with this signature is refused", userOfUnsubToken(`43.${unsubToken(42).split(".")[1]}`) === null);
check("junk is refused", ["", "1", "x.y", "../..", `42.${"A".repeat(21)}`].every((x) => userOfUnsubToken(x) === null));

check("the recap is due on Monday morning", recapWindow(T("2026-10-19T09:00:00Z"))?.key === "2026-10-12");
check("...for the week that just ended, Monday to Sunday", (() => { const w = recapWindow(T("2026-10-19T09:00:00Z"))!; return w.startDay === "2026-10-12" && w.endDay === "2026-10-19"; })());
check("not before 08:00 or from 20:00", recapWindow(T("2026-10-19T07:59:00Z")) === null && recapWindow(T("2026-10-19T20:00:00Z")) === null);
check("not on any other day", ["2026-10-20", "2026-10-21", "2026-10-25", "2026-10-26"].every((d) => d === "2026-10-26" ? recapWindow(T(`${d}T09:00:00Z`)) !== null : recapWindow(T(`${d}T09:00:00Z`)) === null));
check("the streak reminder is due 17:00 to 22:00", streakWindow(T("2026-10-21T17:00:00Z"))?.key === "2026-10-21" && streakWindow(T("2026-10-21T21:59:00Z")) !== null && streakWindow(T("2026-10-21T16:59:00Z")) === null && streakWindow(T("2026-10-21T22:00:00Z")) === null);

const base = { name: "Ana <b>Smith</b>", academy: "gglearn", base: "https://x.test", unsubscribe: "https://x.test/unsubscribe/1.abc" };
const rm = recapMail("a@x.test", { ...base, xp: 1234, newLevels: 2, activeDays: 4, streak: 5, topic: { name: "Python", passed: 3, rival: "Echo", rivalLevel: 5 }, team: { name: "Squad", rank: 2, size: 4 } });
check("the recap names the week's numbers", /1,234 XP/.test(rm.text) && /2 new levels/.test(rm.text) && /5-day streak/.test(rm.text));
check("the recap says where the rival stands", /Echo is 2 levels ahead/.test(rm.text) && /#2 of 4/.test(rm.text));
check("every email has a one-click unsubscribe, in the body and the headers", rm.text.includes(base.unsubscribe) && rm.html.includes(base.unsubscribe) && rm.headers?.["List-Unsubscribe"] === `<${base.unsubscribe}>` && rm.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
const evil = recapMail("a@x.test", { ...base, name: "<b>Ana</b> Smith", xp: 10, newLevels: 0, activeDays: 1, streak: 0 });
check("a name that looks like HTML is escaped in the HTML part", !evil.html.includes("<b>Ana") && evil.html.includes("&lt;b&gt;Ana&lt;/b&gt;"));
check("the greeting uses the first name only", rm.text.startsWith("Hi Ana,"));
check("being ahead of the rival is said kindly", /ahead of Echo/.test(recapMail("a@x.test", { ...base, xp: 10, newLevels: 0, activeDays: 1, streak: 0, topic: { name: "Python", passed: 6, rival: "Echo", rivalLevel: 5 } }).text));
check("a streak reminder says what is at stake", /5-day streak ends/.test(streakMail("a@x.test", { ...base, streak: 5 }).text) && /1-day streak/.test(streakMail("a@x.test", { ...base, streak: 1 }).subject));

// ---- sending, with a stand-in ----
async function main() {
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@nudge.check")).all().map((r) => r.id);
  if (us.length) { db.delete(emailLog).where(inArray(emailLog.userId, us)).run(); db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run(); }
};
sweep();
try {
  const track = db.select().from(tracks).get()!;
  const mk = (n: string, nudges: "on" | "off" | "declined") => db.insert(users).values({ name: `${n} Test`, email: `${n}@nudge.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x", emailNudges: nudges }).returning().get();
  const quest = (userId: number, d: string, xp = 30) => db.insert(dailyQuests).values({ userId, trackId: track.id, day: d, kind: "drill", xp }).run();
  const a = mk("a", "on"), b = mk("b", "off"), c = mk("c", "on"), d = mk("d", "declined"), e = mk("e", "on");
  for (const day of ["2026-10-16", "2026-10-17", "2026-10-18"]) { quest(a.id, day); quest(b.id, day); quest(d.id, day); } // a last-week streak, ending Sunday
  quest(e.id, "2026-10-19"); quest(e.id, "2026-10-20");                                                                   // a two-day streak ending Tuesday
  const only = [a.id, b.id, c.id, d.id, e.id];
  const outbox: Mail[] = []; let failNext = false;
  const send = async (m: Mail) => { if (failNext) return { ok: false, error: "boom" }; outbox.push(m); return { ok: true }; };
  const run = (at: string, extra: { dry?: boolean; max?: number } = {}) => runNudges({ now: T(at), base: "https://x.test", send, only, ...extra });

  let r = await run("2026-10-19T09:00:00Z", { dry: true });
  check("a dry run lists the recap and sends and records nothing", r.sent.length === 1 && r.sent[0].email === "a@nudge.check" && outbox.length === 0 && db.select().from(emailLog).where(inArray(emailLog.userId, only)).all().length === 0);

  r = await run("2026-10-19T09:00:00Z");
  check("Monday morning: only the person who opted in and had a week gets the recap", r.sent.length === 1 && r.sent[0].email === "a@nudge.check" && outbox.length === 1);
  check("...not someone who said no, or declined, or did nothing", !outbox.some((m) => /^(b|c|d)@/.test(m.to)));
  check("the recap carries the week's XP (3 quests of 30)", /90 XP/.test(outbox[0].text));

  r = await run("2026-10-19T09:30:00Z");
  check("running again the same morning sends nothing", r.sent.length === 0 && outbox.length === 1);
  r = await run("2026-10-19T18:00:00Z");
  check("...and the same evening's streak reminder is skipped for someone who got the recap", r.sent.length === 0 && outbox.length === 1);
  r = await run("2026-10-20T10:00:00Z");
  check("on another morning nothing is due", r.due.length === 0 && r.sent.length === 0);

  r = await run("2026-10-21T18:00:00Z");
  check("Wednesday evening: a two-day streak still open gets a reminder", r.sent.length === 1 && r.sent[0].email === "e@nudge.check" && r.sent[0].kind === "streak" && /2-day streak/.test(outbox[1].text));
  r = await run("2026-10-21T19:00:00Z");
  check("only one reminder a day", r.sent.length === 0 && outbox.length === 2);
  check("a streak that has already ended gets none", !outbox.some((m) => m.to === "a@nudge.check" && /streak/.test(m.subject)));

  quest(e.id, "2026-10-22");
  r = await run("2026-10-22T18:00:00Z");
  check("someone who has done a quest today is not nagged", r.sent.length === 0);

  // a failed send is not lost
  db.delete(emailLog).where(inArray(emailLog.userId, only)).run();
  failNext = true; r = await run("2026-10-19T09:00:00Z");
  check("a failed send is reported and not recorded", r.failed.length === 1 && r.sent.length === 0 && db.select().from(emailLog).where(eq(emailLog.userId, a.id)).all().length === 0);
  failNext = false; r = await run("2026-10-19T10:00:00Z");
  check("...so the next run sends it", r.sent.length === 1 && r.failed.length === 0);

  // the cap
  db.delete(emailLog).where(inArray(emailLog.userId, only)).run(); outbox.length = 0;
  const x = mk("x", "on"); quest(x.id, "2026-10-14");
  only.push(x.id);
  r = await run("2026-10-19T09:00:00Z", { max: 1 });
  check("a run stops at its cap", r.sent.length === 1 && outbox.length === 1);
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@nudge.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
}
main();

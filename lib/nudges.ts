import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { dailyQuests, db, emailLog, enrollments, runs, teamMembers, teams, tracks, users } from "@/lib/db";
import { factsOf, streakOf } from "@/lib/progression";
import { activityDays } from "@/lib/freezes";
import { trackStats } from "@/lib/stats";
import { lookFor } from "@/lib/brand";
import { membersOf } from "@/lib/teams";
import { topicLabel } from "@/lib/topicName";
import { rivalFor } from "@/lib/rivals";
import { recapMail, streakMail, type Recap } from "@/lib/nudgeMail";
import type { Mail } from "@/lib/mail";

/**
 * Reminders and the weekly recap. Only people who said yes (users.emailNudges = "on") are ever emailed. Two kinds:
 *   recap   Monday morning (UTC), the week just ended, only when there was something to report
 *   streak  early evening (UTC), only when a streak of two days or more is still open and nothing was done today
 * A runner (scripts/send-nudges.ts) calls runNudges on a timer. Each email is claimed in `email_log` before it is sent, so running twice, or two
 * runs overlapping, never sends one twice; a failed send gives its claim back so the next run can try again.
 */
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
const sign = (id: number) => createHmac("sha256", secret()).update(`unsub:${id}`).digest("base64url").slice(0, 22);

/** The unsubscribe token for a person: their id and a signature, so it needs no storage and cannot be made up for someone else. */
export const unsubToken = (userId: number) => `${userId}.${sign(userId)}`;
export function userOfUnsubToken(token: string): number | null {
  const m = /^(\d{1,9})\.([A-Za-z0-9_-]{22})$/.exec(token);
  if (!m) return null;
  const want = Buffer.from(sign(Number(m[1]))), got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? Number(m[1]) : null;
}

// ---- when ----

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export const RECAP_FROM_HOUR = 8, RECAP_TO_HOUR = 20, STREAK_FROM_HOUR = 17, STREAK_TO_HOUR = 22;

/** The recap is due on Monday (UTC) between 08:00 and 20:00, for the week that ended Sunday. `key` is the Monday that week started. */
export function recapWindow(now: Date): { key: string; startDay: string; endDay: string; startSec: number; endSec: number } | null {
  if (now.getUTCDay() !== 1 || now.getUTCHours() < RECAP_FROM_HOUR || now.getUTCHours() >= RECAP_TO_HOUR) return null;
  const thisMonday = new Date(`${day(now)}T00:00:00Z`), start = addDays(thisMonday, -7);
  return { key: day(start), startDay: day(start), endDay: day(thisMonday), startSec: start.getTime() / 1000, endSec: thisMonday.getTime() / 1000 };
}
/** The streak reminder is due between 17:00 and 22:00 UTC, once a day. */
export const streakWindow = (now: Date): { key: string } | null => (now.getUTCHours() >= STREAK_FROM_HOUR && now.getUTCHours() < STREAK_TO_HOUR ? { key: day(now) } : null);

// ---- what ----

/** One person's week, from real activity. Returns null when there is nothing worth a recap (no XP that week). */
export function recapFor(userId: number, win: NonNullable<ReturnType<typeof recapWindow>>, base: string, now: Date): Recap | null {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return null;
  const quest = db.select({ t: dailyQuests.trackId, v: sql<number>`coalesce(sum(${dailyQuests.xp}), 0)` }).from(dailyQuests)
    .where(and(eq(dailyQuests.userId, userId), gte(dailyQuests.day, win.startDay), lt(dailyQuests.day, win.endDay))).groupBy(dailyQuests.trackId).all();
  const exam = db.select({ t: runs.trackId, v: sql<number>`coalesce(sum(round(${runs.score} * 100) + case when ${runs.passed} then 50 else 0 end), 0)` }).from(runs)
    .where(and(eq(runs.userId, userId), gte(runs.finishedAt, win.startSec), lt(runs.finishedAt, win.endSec))).groupBy(runs.trackId).all();
  const byTrack = new Map<number, number>();
  for (const r of [...quest, ...exam]) byTrack.set(r.t, (byTrack.get(r.t) ?? 0) + Number(r.v));
  const xp = [...byTrack.values()].reduce((a, b) => a + b, 0);
  if (xp <= 0) return null;

  const passes = db.select({ t: runs.trackId, l: runs.level, at: runs.finishedAt }).from(runs).where(and(eq(runs.userId, userId), eq(runs.passed, true))).all();
  const before = new Set(passes.filter((p) => (p.at ?? 0) < win.startSec).map((p) => `${p.t}:${p.l}`));
  const newLevels = new Set(passes.filter((p) => (p.at ?? 0) >= win.startSec && (p.at ?? 0) < win.endSec && !before.has(`${p.t}:${p.l}`)).map((p) => `${p.t}:${p.l}`)).size;

  const facts = factsOf(userId);
  const activeDays = [...activityDays(userId)].filter((d) => d >= win.startDay && d < win.endDay).length; // real practice, not frozen days
  const streak = streakOf(facts.days, day(now)).current;

  // the subject worked on most, and how its rival stands
  const topId = [...byTrack.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  let topic: Recap["topic"];
  const t = topId ? db.select({ t: tracks, e: enrollments }).from(tracks).innerJoin(enrollments, and(eq(enrollments.trackId, tracks.id), eq(enrollments.userId, userId))).where(eq(tracks.id, topId)).get() : undefined;
  if (t) { const s = trackStats(userId, t.t, t.e.startedAt); topic = { name: topicLabel(t.t.name), passed: s.passed, rival: rivalFor(t.t.slug).name, rivalLevel: s.rival.level }; }

  // the first team they are in, and where they stood in it
  let team: Recap["team"];
  const tm = db.select({ t: teams }).from(teamMembers).innerJoin(teams, eq(teams.id, teamMembers.teamId)).where(and(eq(teamMembers.userId, userId), sql`${teams.archivedAt} is null`)).orderBy(asc(teamMembers.joinedAt)).get();
  if (tm) { const rows = membersOf(tm.t, win.endSec - 7 * 86400); const rank = rows.findIndex((r) => r.userId === userId) + 1; if (rank > 0 && rows.length > 1) team = { name: tm.t.name, rank, size: rows.length }; }

  return { name: u.name, academy: lookFor(userId).name, base, unsubscribe: `${base}/unsubscribe/${unsubToken(userId)}`, xp, newLevels, activeDays, streak, topic, team };
}

// ---- run ----

export type Sent = { kind: "recap" | "streak"; userId: number; email: string; subject: string };
export type RunResult = { due: string[]; considered: number; sent: Sent[]; skipped: number; failed: { email: string; error: string }[] };

/**
 * Works out which emails are due at `now` and sends them through `send`. With `dry` nothing is sent or claimed: the result lists what would go.
 * `send` is passed in so the runner uses the real mail service and the tests use a stand-in.
 */
export async function runNudges(o: { now: Date; base: string; send: (m: Mail, key: string) => Promise<{ ok: boolean; error?: string }>; dry?: boolean; max?: number; only?: number[] }): Promise<RunResult> {
  const res: RunResult = { due: [], considered: 0, sent: [], skipped: 0, failed: [] };
  const recap = recapWindow(o.now), streak = streakWindow(o.now);
  if (recap) res.due.push(`recap ${recap.key}`);
  if (streak) res.due.push(`streak ${streak.key}`);
  if (!recap && !streak) return res;
  const people = db.select().from(users).where(and(eq(users.emailNudges, "on"), eq(users.status, "active"))).all().filter((u) => !o.only || o.only.includes(u.id));
  const max = o.max ?? 500;
  const claim = (userId: number, kind: string, key: string) => !!db.insert(emailLog).values({ userId, kind, key }).onConflictDoNothing().returning().get();
  const release = (userId: number, kind: string, key: string) => db.delete(emailLog).where(and(eq(emailLog.userId, userId), eq(emailLog.kind, kind), eq(emailLog.key, key))).run();
  const done = (userId: number, kind: string, key: string) => !!db.select().from(emailLog).where(and(eq(emailLog.userId, userId), eq(emailLog.kind, kind), eq(emailLog.key, key))).get();

  for (const u of people) {
    res.considered++;
    const todo: { kind: "recap" | "streak"; key: string; mail: () => Mail | null }[] = [];
    if (recap && !done(u.id, "recap", recap.key)) todo.push({ kind: "recap", key: recap.key, mail: () => { const r = recapFor(u.id, recap, o.base, o.now); return r ? recapMail(u.email, r) : null; } });
    if (streak && !done(u.id, "streak", streak.key)) todo.push({ kind: "streak", key: streak.key, mail: () => {
      const facts = factsOf(u.id), s = streakOf(facts.days, day(o.now));
      if (s.current < 2 || s.activeToday) return null;
      return streakMail(u.email, { name: u.name, academy: lookFor(u.id).name, base: o.base, unsubscribe: `${o.base}/unsubscribe/${unsubToken(u.id)}`, streak: s.current });
    } });
    // a Monday recap is enough for that evening: someone who got one does not also get a streak reminder the same day
    for (const t of todo) {
      if (res.sent.length >= max) return res;
      if (t.kind === "streak" && recap && (done(u.id, "recap", recap.key) || res.sent.some((x) => x.userId === u.id && x.kind === "recap"))) { res.skipped++; continue; }
      const mail = t.mail();
      if (!mail) { res.skipped++; continue; }
      if (o.dry) { res.sent.push({ kind: t.kind, userId: u.id, email: u.email, subject: mail.subject }); continue; }
      if (!claim(u.id, t.kind, t.key)) { res.skipped++; continue; }
      const r = await o.send(mail, `${t.kind}-${u.id}-${t.key}`);
      if (r.ok) res.sent.push({ kind: t.kind, userId: u.id, email: u.email, subject: mail.subject });
      else { release(u.id, t.kind, t.key); res.failed.push({ email: u.email, error: r.error ?? "send failed" }); }
    }
  }
  return res;
}

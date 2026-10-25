import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, emailLog, routeAssessments, users } from "@/lib/db";
import { escapeHtml, type Mail } from "@/lib/mail";
import { BTN, unsubHeaders, wrap } from "@/lib/nudgeMail";
import { lookFor } from "@/lib/brand";
import { dateAt } from "@/lib/roadmap";
import { targetBySlug } from "@/lib/route";
import { routeSummary } from "@/lib/routePlan";

/**
 * The weekly email about someone's route plan. It is its own thing, apart from the recap and streak emails (lib/nudges.ts): off until the person
 * turns it on for that plan, and its unsubscribe link switches off only this, for only that plan. One email a week, on Wednesday between 08:00 and
 * 20:00 UTC (never the same day as the Monday recap), and only while there is something left to do and the timeframe has not ended. Each email is
 * claimed in `email_log` before it is sent, so running twice never sends one twice; a failed send gives its claim back.
 */
export const ROUTE_FROM_HOUR = 8, ROUTE_TO_HOUR = 20, ROUTE_WEEKDAY = 3;
const KIND = "route";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
};
// the label keeps this token from standing in for the recap's unsubscribe token (lib/nudges.ts), and the other way round
const sign = (id: number) => createHmac("sha256", secret()).update(`route-unsub:${id}`).digest("base64url").slice(0, 22);
export const routeUnsubToken = (assessmentId: number) => `${assessmentId}.${sign(assessmentId)}`;
export function assessmentOfUnsubToken(token: string): number | null {
  const m = /^(\d{1,9})\.([A-Za-z0-9_-]{22})$/.exec(token);
  if (!m) return null;
  const want = Buffer.from(sign(Number(m[1]))), got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? Number(m[1]) : null;
}

/** Switches the weekly email off for the plan the token belongs to. True if the token was good. */
export function unsubscribeRoute(token: string): boolean {
  const id = assessmentOfUnsubToken(token);
  if (id === null) return false;
  db.update(routeAssessments).set({ reminders: "off" }).where(eq(routeAssessments.id, id)).run();
  return true;
}

/** Turns the weekly email on or off for a person's own plan. */
export function setReminders(userId: number, targetSlug: string, on: boolean, at = Math.floor(Date.now() / 1000)) {
  db.update(routeAssessments).set(on ? { reminders: "on", remindersAt: at } : { reminders: "off" })
    .where(and(eq(routeAssessments.userId, userId), eq(routeAssessments.targetSlug, targetSlug))).run();
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** The reminder is due on Wednesday (UTC) between 08:00 and 20:00. `key` is the Monday that week started, so there is one a week. */
export function routeWindow(now: Date): { key: string } | null {
  if (now.getUTCDay() !== ROUTE_WEEKDAY || now.getUTCHours() < ROUTE_FROM_HOUR || now.getUTCHours() >= ROUTE_TO_HOUR) return null;
  return { key: day(addDays(new Date(`${day(now)}T00:00:00Z`), -2)) };
}

export type RouteNote = {
  name: string; academy: string; base: string; unsubscribe: string;
  jobTitle: string; stepsDone: number; stepsTotal: number; status: "on-track" | "behind";
  weeksLate: number;
  /** what to be working on, already worded, with its due date */
  steps: { label: string; due: string; kind: "learn" | "action" }[];
  finish: string;
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The reminder as plain text and HTML. Pure: everything it says comes in as data, and every name that came from a person is escaped. */
export function routeMail(to: string, n: RouteNote): Mail {
  const first = n.name.split(" ")[0] || "there", link = `${n.base}/route`;
  const lead = n.status === "behind"
    ? `You are about ${plural(Math.max(1, Math.round(n.weeksLate)), "week")} behind your plan. That happens. Open it and re-plan from today, and it will fit what is left before ${n.finish}.`
    : `You are on track: ${n.stepsDone} of ${n.stepsTotal} steps done, with your finish line on ${n.finish}.`;
  const lines = n.steps.map((s) => `${s.label} (by ${s.due})`);
  const why = `You get this because you asked for a weekly reminder about your route to ${n.jobTitle} from ${n.academy}.`;
  const text = `Hi ${first},\n\n${lead}\n\nThis week:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen your route:\n${link}\n\n${why} Stop these emails in one click: ${n.unsubscribe}`;
  const html = wrap(`<p>Hi ${escapeHtml(first)},</p><p style="font-size:18px"><b>Your route to ${escapeHtml(n.jobTitle)}</b></p><p>${escapeHtml(lead)}</p>
<p><b>This week</b></p><ul style="padding-left:18px">${n.steps.map((s) => `<li>${escapeHtml(s.label)} <span style="color:#6b7280">(by ${escapeHtml(s.due)})</span></li>`).join("")}</ul>
<p><a href="${escapeHtml(link)}" style="${BTN}">Open my route</a></p>`, why, n.unsubscribe);
  return { to, subject: n.status === "behind" ? "Your route plan: time to re-plan from today" : `This week on your route: ${n.steps[0]?.label ?? "your next step"}`, text, html, headers: unsubHeaders(n.unsubscribe) };
}

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The mail for one plan at `now`, or null when there is nothing worth sending (no plan, all done, timeframe over). */
export function reminderFor(a: typeof routeAssessments.$inferSelect, base: string, now: Date): Mail | null {
  const person = db.select().from(users).where(eq(users.id, a.userId)).get();
  const target = targetBySlug(a.targetSlug);
  if (!person || !target || person.status !== "active") return null;
  const s = routeSummary(person, target, Math.floor(now.getTime() / 1000));
  if (!s || s.state !== "planned" || !s.progress || !s.view) return null;
  const p = s.progress;
  if (p.status === "done" || p.status === "over") return null;
  return routeMail(person.email, {
    name: person.name, academy: lookFor(person.id).name, base, unsubscribe: `${base}/unsubscribe/route/${routeUnsubToken(a.id)}`,
    jobTitle: target.title, stepsDone: p.stepsDone, stepsTotal: p.stepsTotal, status: p.status, weeksLate: p.weeksLate,
    steps: p.focus.slice(0, 3).map((i) => ({ label: i.label, kind: i.kind, due: date(dateAt(s.view!.row.startsOn, i.endWeek)) })),
    finish: date(s.view.row.endsOn),
  });
}

export type RouteSent = { userId: number; email: string; subject: string };
export type RouteRun = { due: boolean; considered: number; sent: RouteSent[]; skipped: number; failed: { email: string; error: string }[] };

/** Sends this week's reminders if `now` is inside the window. With `dry` nothing is sent or claimed. `send` is passed in so tests can stand in for the mail service. */
export async function runRouteReminders(o: { now: Date; base: string; send: (m: Mail, key: string) => Promise<{ ok: boolean; error?: string }>; dry?: boolean; max?: number; only?: number[] }): Promise<RouteRun> {
  const res: RouteRun = { due: false, considered: 0, sent: [], skipped: 0, failed: [] };
  const win = routeWindow(o.now);
  if (!win) return res;
  res.due = true;
  const max = o.max ?? 500;
  const rows = db.select().from(routeAssessments).where(and(eq(routeAssessments.reminders, "on"), eq(routeAssessments.status, "complete"))).all().filter((a) => !o.only || o.only.includes(a.userId));
  for (const a of rows) {
    res.considered++;
    if (res.sent.length >= max) return res;
    const key = `${win.key}:${a.id}`;
    if (db.select().from(emailLog).where(and(eq(emailLog.userId, a.userId), eq(emailLog.kind, KIND), eq(emailLog.key, key))).get()) { res.skipped++; continue; }
    const mail = reminderFor(a, o.base, o.now);
    if (!mail) { res.skipped++; continue; }
    if (o.dry) { res.sent.push({ userId: a.userId, email: mail.to, subject: mail.subject }); continue; }
    if (!db.insert(emailLog).values({ userId: a.userId, kind: KIND, key }).onConflictDoNothing().returning().get()) { res.skipped++; continue; }
    const r = await o.send(mail, `${KIND}-${a.id}-${key}`);
    if (r.ok) res.sent.push({ userId: a.userId, email: mail.to, subject: mail.subject });
    else { db.delete(emailLog).where(and(eq(emailLog.userId, a.userId), eq(emailLog.kind, KIND), eq(emailLog.key, key))).run(); res.failed.push({ email: mail.to, error: r.error ?? "send failed" }); }
  }
  return res;
}

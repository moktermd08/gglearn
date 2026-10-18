import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, notifications } from "@/lib/db";

/**
 * Celebration moments: the few things that happened to someone that they would want to show off. They are real events the app already records
 * as notifications (a badge, a player level, a league promotion, a top-three weekly finish), so nothing here can invent one. The newest unread
 * one is shown once as a toast with confetti and a one-tap share; dismissing it (or sharing) marks it read, so it never comes back.
 * Old events are not dug up: only ones from the last three days count, and a badge someone already had when badges began is filed as read.
 */
export const CELEBRATE_WITHIN_SEC = 3 * 86400;

export type Celebration = {
  id: number; headline: string; title: string; body: string; tone: "gold" | "indigo" | "orange" | "silver";
  /** what to turn into a share card; the server rebuilds it from real data, so this is only a pointer */
  share: { kind: "badge" | "level" | "league" | "season"; ref: string };
};

type Note = { id: number; key: string; kind: string; title: string; body: string };

/** Turns a notification into a celebration, or null when it is not one (an invitation, a plain result, a demotion). Pure. */
export function celebrationOf(n: Note): Celebration | null {
  const base = { id: n.id, title: n.title, body: n.body };
  let m: RegExpExecArray | null;
  if ((m = /^badge-(.+)$/.exec(n.key))) return { ...base, headline: "You earned a badge", tone: "gold", share: { kind: "badge", ref: m[1] } };
  if (/^level-\d+$/.test(n.key)) return { ...base, headline: "Player level up", tone: "indigo", share: { kind: "level", ref: "level" } };
  if ((m = /^league-(.+)$/.exec(n.key))) return /^Promoted/.test(n.title) ? { ...base, headline: "League promotion", tone: "gold", share: { kind: "league", ref: m[1] } } : null;
  if ((m = /^season-(week|month)-(.+)$/.exec(n.key))) {
    const rank = Number(/#(\d+)/.exec(n.body)?.[1] ?? 0);
    return rank >= 1 && rank <= 3 ? { ...base, headline: rank === 1 ? "You won the season" : "On the podium", tone: rank === 1 ? "gold" : "silver", share: { kind: "season", ref: `${m[1]}:${m[2]}` } } : null;
  }
  return null;
}

/** The newest unread celebration for a person, or null. */
export function latestCelebration(userId: number, at = Math.floor(Date.now() / 1000)): Celebration | null {
  const rows = db.select({ id: notifications.id, key: notifications.key, kind: notifications.kind, title: notifications.title, body: notifications.body }).from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), inArray(notifications.kind, ["badge", "level", "season"]), gte(notifications.createdAt, at - CELEBRATE_WITHIN_SEC)))
    .orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(12).all();
  for (const r of rows) { const c = celebrationOf(r); if (c) return c; }
  return null;
}

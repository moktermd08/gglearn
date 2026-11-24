import { desc, eq, isNotNull, and } from "drizzle-orm";
import { dailyQuests, db, notifications, planItems, planLogs, runs, tracks } from "@/lib/db";
import { topicLabel } from "@/lib/topicName";

/** Everything a person has done, newest first, read from records that already exist (nothing is stored for this page). */
export type Kind = "exam" | "quest" | "plan" | "earned";
export type Entry = { id: string; kind: Kind; at: number; title: string; detail: string; href: string; good: boolean };
export const KINDS: { key: Kind; label: string }[] = [
  { key: "exam", label: "Exams" }, { key: "quest", label: "Daily quests" }, { key: "plan", label: "Plan" }, { key: "earned", label: "Badges & levels" },
];
const CAP = 2000; // per source; far more than anyone has, but keeps one page load bounded
const QUEST = { study: "Studied", drill: "Drilled", exam: "Took the daily exam in" } as const;

export function activityHistoryFor(userId: number): Entry[] {
  const out: Entry[] = [];
  const names = new Map(db.select({ id: tracks.id, name: tracks.name, slug: tracks.slug }).from(tracks).all().map((t) => [t.id, t]));
  const subject = (id: number) => { const t = names.get(id); return { label: t ? topicLabel(t.name) : "a subject", href: t ? `/tracks/${t.slug}` : "/dashboard" }; };

  for (const r of db.select().from(runs).where(and(eq(runs.userId, userId), isNotNull(runs.finishedAt))).orderBy(desc(runs.finishedAt)).limit(CAP).all()) {
    const s = subject(r.trackId);
    out.push({ id: `run-${r.id}`, kind: "exam", at: r.finishedAt!, title: `${r.passed ? "Passed" : "Tried"} ${s.label} level ${r.level}`,
      detail: r.score != null ? `Scored ${Math.round(r.score * 100)}%` : "", href: s.href, good: !!r.passed });
  }
  // a quest is recorded for a day, not a moment, so it takes the start of that day and sits after anything timed within it
  for (const q of db.select().from(dailyQuests).where(eq(dailyQuests.userId, userId)).orderBy(desc(dailyQuests.day)).limit(CAP).all()) {
    const s = subject(q.trackId);
    out.push({ id: `quest-${q.id}`, kind: "quest", at: Math.floor(Date.parse(`${q.day}T00:00:00Z`) / 1000), title: `${QUEST[q.kind]} ${s.label}`, detail: q.xp ? `+${q.xp} XP` : "", href: s.href, good: true });
  }
  for (const l of db.select({ id: planLogs.id, at: planLogs.at, title: planItems.title }).from(planLogs).innerJoin(planItems, eq(planLogs.itemId, planItems.id))
    .where(eq(planItems.userId, userId)).orderBy(desc(planLogs.at)).limit(CAP).all()) {
    out.push({ id: `plan-${l.id}`, kind: "plan", at: l.at, title: `Logged: ${l.title}`, detail: "", href: "/plan", good: true });
  }
  for (const n of db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(CAP).all()) {
    if (n.kind !== "badge" && n.kind !== "level") continue;
    out.push({ id: `note-${n.id}`, kind: "earned", at: n.createdAt, title: n.title, detail: n.body, href: n.href || "/achievements", good: true });
  }
  return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

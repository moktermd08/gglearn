import { and, eq, sql } from "drizzle-orm";
import { certificates, dailyQuests, db, runs } from "@/lib/db";
import { rivalFor, rivalProgress } from "@/lib/rivals";
import { levelsPassed } from "@/lib/progress";

export const today = () => new Date().toISOString().slice(0, 10);
export const QUEST_XP = { study: 20, drill: 30, exam: 40 } as const;
export const QUEST_LABEL = {
  study: ["Study the guide", "Read today's study guide"],
  drill: ["Quick drill", "Answer 5 instant-feedback questions"],
  exam: ["Take an exam", "Finish any level exam"],
} as const;

/** Mark a quest done for today. Returns the XP awarded (0 when it was already done). */
export function completeQuest(userId: number, trackId: number, kind: keyof typeof QUEST_XP): number {
  const r = db.insert(dailyQuests).values({ userId, trackId, day: today(), kind, xp: QUEST_XP[kind] })
    .onConflictDoNothing().run();
  return r.changes ? QUEST_XP[kind] : 0;
}

export function trackStats(userId: number, track: { id: number; slug: string }, startedAt: number) {
  const runXp = db.select({ v: sql<number>`coalesce(sum(round(${runs.score} * 100) + case when ${runs.passed} then 50 else 0 end), 0)` })
    .from(runs).where(and(eq(runs.userId, userId), eq(runs.trackId, track.id), sql`${runs.finishedAt} is not null`)).get()?.v ?? 0;
  const quests = db.select().from(dailyQuests).where(and(eq(dailyQuests.userId, userId), eq(dailyQuests.trackId, track.id))).all();
  const questXp = quests.reduce((s, q) => s + q.xp, 0);
  const t = today();
  const doneToday = new Set(quests.filter((q) => q.day === t).map((q) => q.kind));

  // streak = consecutive days (ending today or yesterday) with at least one quest
  const days = new Set(quests.map((q) => q.day));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }

  const passed = levelsPassed(userId, track.id);
  const rival = rivalProgress(rivalFor(track.slug), track.slug, startedAt);
  const certs = db.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.trackId, track.id))).all();
  const xp = runXp + questXp;
  return { xp, passed, streak, doneToday, rival, certs, questCount: quests.length };
}

export type Badge = { key: string; name: string; desc: string; icon: string; earned: boolean };
export function badgesFor(s: ReturnType<typeof trackStats>): Badge[] {
  return [
    { key: "first", name: "First Blood", desc: "Pass your first level", icon: "⚔️", earned: s.passed >= 1 },
    { key: "s3", name: "On Fire", desc: "3-day streak", icon: "🔥", earned: s.streak >= 3 },
    { key: "s7", name: "Unstoppable", desc: "7-day streak", icon: "⚡", earned: s.streak >= 7 },
    { key: "ahead", name: "Ahead of the Pack", desc: "Pass more levels than your rival", icon: "🏁", earned: s.passed > s.rival.level },
    { key: "half", name: "Halfway Hero", desc: "Reach level 10", icon: "🛡️", earned: s.passed >= 10 },
    { key: "cert", name: "Certified", desc: "Earn a certificate", icon: "🎓", earned: s.certs.length > 0 },
    { key: "titan", name: "Titan", desc: "Reach level 20", icon: "👑", earned: s.passed >= 20 },
  ];
}

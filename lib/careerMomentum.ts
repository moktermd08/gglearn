import { and, eq, isNotNull } from "drizzle-orm";
import { dailyQuests, db, runs, type users } from "@/lib/db";
import type { Diagnosis, FamilyFit } from "@/lib/careerDoctor";

type Person = typeof users.$inferSelect;

/**
 * Where someone keeps showing up, as opposed to where they once passed. Career doctor's fit says what you can do; momentum says what you keep doing.
 * Worked out from finished exams and daily quests already recorded, over the last WEEKS weeks. Nothing is stored. It describes how consistently
 * someone practises and holds their results: it is not a measure of the value they add at work, and the page says so.
 */
export const WEEKS = 12;
const DAY = 86400, WEEK = 7 * DAY;
/** Weeks of activity (out of WEEKS) that count as fully regular, and the days a result stays fresh before it starts to fade. */
const REGULAR_WEEKS = 8, FRESH_DAYS = 14, STALE_DAYS = 180;

export type Event = { at: number; /** 0..1 for a finished exam, null for a quest */ score: number | null; passed: boolean; level: number };
export type Momentum = {
  /** 0..1, combined from the four parts below */ score: number;
  /** distinct weeks with any activity, out of WEEKS */ weeks: number;
  /** days since the last activity of any time, null when there has never been any */ daysSince: number | null;
  /** average score of finished exams in the window, null when there were none */ reliability: number | null;
  /** levels newly passed in the window, above the best before it; for a field, the most in any one area */ gained: number;
  label: "Steady" | "Building" | "Fading" | "Not yet";
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** The pure part: events for one subject (any time, newest or oldest first) at a given moment. */
export function momentumOf(events: Event[], at: number): Momentum {
  const from = at - WEEKS * WEEK;
  const recent = events.filter((e) => e.at >= from && e.at <= at);
  const last = events.reduce((m, e) => (e.at <= at && e.at > m ? e.at : m), 0);
  const weeks = new Set(recent.map((e) => Math.floor((at - e.at) / WEEK))).size;
  const scored = recent.filter((e) => e.score !== null);
  const reliability = scored.length ? scored.reduce((n, e) => n + e.score!, 0) / scored.length : null;
  const before = events.filter((e) => e.at < from && e.passed).reduce((m, e) => Math.max(m, e.level), 0);
  const gained = new Set(recent.filter((e) => e.passed && e.level > before).map((e) => e.level)).size;
  const daysSince = last ? Math.floor((at - last) / DAY) : null;

  const regularity = clamp(weeks / REGULAR_WEEKS);
  const recency = daysSince === null ? 0 : clamp(1 - (daysSince - FRESH_DAYS) / (STALE_DAYS - FRESH_DAYS));
  const score = 0.35 * regularity + 0.25 * recency + 0.25 * (reliability ?? 0) + 0.15 * clamp(gained / 2);
  const label = daysSince === null ? "Not yet" : weeks === 0 ? "Fading" : score >= 0.6 && weeks >= 4 ? "Steady" : "Building";
  return { score, weeks, daysSince, reliability, gained, label };
}

/** Every finished exam and quest this person has, grouped by track. */
export function eventsByTrack(person: Person): Map<number, Event[]> {
  const out = new Map<number, Event[]>();
  const add = (t: number, e: Event) => out.set(t, [...(out.get(t) ?? []), e]);
  for (const r of db.select().from(runs).where(and(eq(runs.userId, person.id), isNotNull(runs.finishedAt))).all())
    add(r.trackId, { at: r.finishedAt!, score: r.score, passed: !!r.passed, level: r.level });
  for (const q of db.select().from(dailyQuests).where(eq(dailyQuests.userId, person.id)).all())
    add(q.trackId, { at: Math.floor(Date.parse(`${q.day}T12:00:00Z`) / 1000), score: null, passed: false, level: 0 });
  return out;
}

export type FamilyMomentum = Momentum & { /** areas with activity in the window */ active: number };

/** A field's momentum: the average of its three most consistent areas, so one steady habit is not drowned out by many untried ones. */
export function familyMomentum(f: FamilyFit, by: Map<number, Event[]>, at = Math.floor(Date.now() / 1000)): FamilyMomentum {
  const seen = new Set<number>(), parts: Momentum[] = [];
  for (const r of f.roles) for (const a of r.areas) if (!seen.has(a.trackId)) { seen.add(a.trackId); parts.push(momentumOf(by.get(a.trackId) ?? [], at)); }
  const live = parts.filter((p) => p.weeks > 0).sort((a, b) => b.score - a.score);
  const top = live.slice(0, 3);
  if (!top.length) return { ...momentumOf([], at), label: parts.some((p) => p.daysSince !== null) ? "Fading" : "Not yet", active: 0 };
  const avg = (k: "score" | "weeks") => top.reduce((n, p) => n + p[k], 0) / top.length;
  const rel = top.filter((p) => p.reliability !== null);
  const score = avg("score"), weeks = Math.round(Math.max(...top.map((p) => p.weeks)));
  return {
    score, weeks, daysSince: Math.min(...top.map((p) => p.daysSince ?? Infinity)),
    reliability: rel.length ? rel.reduce((n, p) => n + p.reliability!, 0) / rel.length : null,
    gained: Math.max(...top.map((p) => p.gained)), // the most in any one area: levels in different areas are not the same ladder, so they are not added up
    label: score >= 0.6 && weeks >= 4 ? "Steady" : "Building", active: live.length,
  };
}

/** Momentum for every field in a diagnosis, by field name. */
export function momentumFor(person: Person, d: Diagnosis, at = Math.floor(Date.now() / 1000)): Map<string, FamilyMomentum> {
  const by = eventsByTrack(person);
  return new Map(d.families.map((f) => [f.family, familyMomentum(f, by, at)]));
}

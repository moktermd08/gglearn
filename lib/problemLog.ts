import { gte, sql } from "drizzle-orm";
import { db, problemPicks } from "@/lib/db";
import { MAPS } from "@/lib/lifecycle/maps";

/**
 * Anonymous counts of what people pick in a map's problem finder, so the list of problems can follow what people really have.
 * Stored: the day, the map, what kind of pick, which problem or stop, and a count. Never stored: who, from where, or anything typed.
 */
export type PickKind = "pick" | "stop" | "nomatch";
const KINDS: readonly PickKind[] = ["pick", "stop", "nomatch"];
const today = () => new Date().toISOString().slice(0, 10);

/** What a request may log: a real map, a real kind, and ids that exist on that map. Anything else is ignored, so nobody can fill the table with junk. */
export function cleanPick(kind: string, mapId: string, ids: readonly string[]): { map: string; kind: PickKind; ids: string[] } | null {
  if (!KINDS.includes(kind as PickKind) || !Object.hasOwn(MAPS, mapId)) return null;
  const m = MAPS[mapId];
  if (kind === "nomatch") return { map: mapId, kind, ids: [""] };
  const one = [...new Set(ids)].slice(0, kind === "stop" ? 1 : 4);
  if (!one.length) return null;
  const ok = kind === "pick" ? one.every((id) => m.PROBLEMS.some((p) => p.id === id)) : one.every((id) => m.STATION_BY_ID.has(id));
  return ok ? { map: mapId, kind: kind as PickKind, ids: one } : null;
}

/** Counts one pick (a combined route counts each of its problems once). Returns how many were counted; never throws, so a missing table cannot break the map. */
export function recordPick(kind: string, mapId: string, ids: readonly string[], day: string = today()): number {
  const c = cleanPick(kind, mapId, ids);
  if (!c) return 0;
  try {
    for (const id of c.ids) {
      db.insert(problemPicks).values({ day, map: c.map, kind: c.kind, problem: id, n: 1 })
        .onConflictDoUpdate({ target: [problemPicks.day, problemPicks.map, problemPicks.kind, problemPicks.problem], set: { n: sql`${problemPicks.n} + 1` } }).run();
    }
    return c.ids.length;
  } catch {
    return 0;
  }
}

export type MapReport = {
  id: string; label: string;
  picks: { id: string; say: string; n: number }[];
  /** problems nobody picked in the period: candidates to reword or drop */ unpicked: { id: string; say: string }[];
  stops: { id: string; name: string; n: number }[];
  nomatch: number; total: number;
};
export type ProblemReport = { days: number; maps: MapReport[] } | { error: "missing" };

/** What people picked in the last `days` days, per map. Says "missing" when the table has not been created yet (run npm run db:push). */
export function problemReport(days = 30, day: string = today()): ProblemReport {
  const cutoff = new Date(new Date(`${day}T00:00:00Z`).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  let rows: { map: string; kind: PickKind; problem: string; n: number }[];
  try {
    rows = db.select({ map: problemPicks.map, kind: problemPicks.kind, problem: problemPicks.problem, n: sql<number>`sum(${problemPicks.n})` })
      .from(problemPicks).where(gte(problemPicks.day, cutoff)).groupBy(problemPicks.map, problemPicks.kind, problemPicks.problem).all();
  } catch {
    return { error: "missing" };
  }
  const maps = Object.values(MAPS).filter((m) => m.PROBLEMS.length > 0).map((m): MapReport => {
    const mine = rows.filter((r) => r.map === m.id);
    const picks = mine.filter((r) => r.kind === "pick").map((r) => ({ id: r.problem, say: m.PROBLEMS.find((p) => p.id === r.problem)?.say ?? r.problem, n: r.n })).sort((a, b) => b.n - a.n);
    const picked = new Set(picks.map((p) => p.id));
    return {
      id: m.id, label: m.label, picks,
      unpicked: m.PROBLEMS.filter((p) => !picked.has(p.id)).map((p) => ({ id: p.id, say: p.say })),
      stops: mine.filter((r) => r.kind === "stop").map((r) => ({ id: r.problem, name: m.STATION_BY_ID.get(r.problem)?.name ?? r.problem, n: r.n })).sort((a, b) => b.n - a.n),
      nomatch: mine.filter((r) => r.kind === "nomatch").reduce((s, r) => s + r.n, 0),
      total: mine.reduce((s, r) => s + r.n, 0),
    };
  });
  return { days, maps };
}

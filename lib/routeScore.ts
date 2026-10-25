import type { RouteAnswers } from "@/lib/db/schema";

export type AreaStatus = "ready" | "nearly" | "building" | "start";

/** How far a level is from the bar the target job sets. */
export function areaStatus(placed: number, target: number): AreaStatus {
  const gap = target - placed;
  return gap <= 0 ? "ready" : gap === 1 ? "nearly" : gap <= 3 ? "building" : "start";
}

export const STATUS_LABEL: Record<AreaStatus, string> = { ready: "Ready", nearly: "Nearly there", building: "Building", start: "Start here" };

export type AreaScore = { key: string; placed: number; target: number };

/** Share of the bar already met across the areas that were checked, 0 to 1. Each area counts only up to its own target. */
export function readiness(areas: AreaScore[]): number {
  const total = areas.reduce((n, a) => n + a.target, 0);
  return total ? areas.reduce((n, a) => n + Math.min(a.placed, a.target), 0) / total : 0;
}

/** The areas with the most still to learn first; ties keep the order the target lists them in. */
export function byGap<T extends AreaScore>(areas: T[]): T[] {
  return areas.map((a, i) => ({ a, i })).sort((x, y) => (y.a.target - y.a.placed) - (x.a.target - x.a.placed) || x.i - y.i).map((x) => x.a);
}

export const HORIZON_MIN = 1, HORIZON_MAX = 60, HOURS_MIN = 1, HOURS_MAX = 40;

/** Total levels still to climb across the areas: the size of the job a plan has to fit into the time. */
export const levelsToClimb = (areas: AreaScore[]) => areas.reduce((n, a) => n + Math.max(0, a.target - a.placed), 0);

export type Note = { tone: "info" | "warn"; text: string };

/** Plain observations from the answers that change what someone should do first. Nothing here is a score. */
export function notes(a: RouteAnswers, rightToWork?: { no: string; unsure: string }): Note[] {
  const out: Note[] = [];
  if (rightToWork && a.workRights === "no") out.push({ tone: "warn", text: rightToWork.no });
  if (rightToWork && a.workRights === "unsure") out.push({ tone: "warn", text: rightToWork.unsure });
  if (a.digital <= 2) out.push({ tone: "info", text: "You rated your computer confidence low. Applications, tests and the job itself are all online, so the Core office skills area is worth doing early." });
  if (a.writing <= 2) out.push({ tone: "info", text: "You rated your writing confidence low. Personal statements carry a lot of weight, so spend time on the examples and plain English areas." });
  if (a.paidWork === "none" && a.unpaid.length) out.push({ tone: "info", text: "You have no paid work to point to, but your unpaid experience counts. The Behaviours area shows how to turn it into evidence." });
  if (a.paidWork === "none" && !a.unpaid.length) out.push({ tone: "info", text: "Think about anything you have done for other people, such as helping at a school, a club or a neighbour. Small things count as evidence when you describe them well." });
  return out;
}

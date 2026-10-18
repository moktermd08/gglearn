/**
 * The league's rules with nothing else attached, so they can be tested without a database.
 * Eight tiers. Each week people are placed in a cohort of up to COHORT_SIZE in their tier; at the end of the week roughly the top fifth move up
 * and the bottom fifth move down. Small cohorts are protected: nobody is demoted from fewer than MIN_FOR_DEMOTION, and nobody is promoted
 * (or kept from relegation) on zero points.
 */
export const TIERS = [
  { name: "Bronze", hue: 28 }, { name: "Silver", hue: 210 }, { name: "Gold", hue: 45 }, { name: "Sapphire", hue: 222 },
  { name: "Ruby", hue: 350 }, { name: "Emerald", hue: 152 }, { name: "Amethyst", hue: 275 }, { name: "Diamond", hue: 190 },
] as const;
export const MAX_TIER = TIERS.length - 1, COHORT_SIZE = 30, MIN_FOR_DEMOTION = 5, MIN_FOR_PROMOTION = 2, MOVE_SHARE = 0.2;

export type Outcome = "up" | "down" | "stay";

/** How many places move each way in a cohort of `n`. */
export function movesFor(n: number): { up: number; down: number } {
  const share = Math.max(1, Math.round(n * MOVE_SHARE));
  const up = n >= MIN_FOR_PROMOTION ? share : 0;
  const down = n >= MIN_FOR_DEMOTION ? share : 0;
  return { up, down: Math.min(down, Math.max(0, n - up - 1)) }; // never move everyone, and always leave someone in the middle
}

export type Ranked = { userId: number; points: number };

/** Orders a cohort: most points first. Ties are broken by the caller's order (it passes people already sorted with the board's own tie-breaks). */
export const rankCohort = <T extends Ranked>(people: T[]): (T & { rank: number })[] =>
  [...people].sort((a, b) => b.points - a.points).map((p, i) => ({ ...p, rank: i + 1 }));

/** What happens to each person in a cohort, given the tier it played in. Top tier cannot go up; Bronze cannot go down. */
export function outcomesFor(ranked: (Ranked & { rank: number })[], tier: number): Map<number, Outcome> {
  const { up, down } = movesFor(ranked.length);
  const out = new Map<number, Outcome>();
  for (const r of ranked) {
    const climbs = r.rank <= up && r.points > 0 && tier < MAX_TIER;
    const drops = r.rank > ranked.length - down && tier > 0;
    out.set(r.userId, climbs ? "up" : drops ? "down" : "stay");
  }
  return out;
}

export const nextTier = (tier: number, outcome: Outcome | null | undefined) =>
  outcome === "up" ? Math.min(MAX_TIER, tier + 1) : outcome === "down" ? Math.max(0, tier - 1) : tier;

/** The cohort number to put a new person in: the lowest-numbered one with room, or a new one. `sizes` maps cohort number to how many are in it. */
export function cohortFor(sizes: Map<number, number>): number {
  for (const c of [...sizes.keys()].sort((a, b) => a - b)) if ((sizes.get(c) ?? 0) < COHORT_SIZE) return c;
  return (sizes.size ? Math.max(...sizes.keys()) : 0) + 1;
}

/** Where someone stands in their cohort right now, in words: what they need to do. */
export function standingNote(rank: number, n: number, points: number, tier: number, pointsAt: (rank: number) => number | null): string {
  const { up, down } = movesFor(n);
  if (n < 2) return "You are the only one in your cohort so far. Anyone else who joins will race you.";
  if (points <= 0) return "Score a point this week to get off the bottom and into the race.";
  if (up > 0 && tier < MAX_TIER && rank <= up) return tier === MAX_TIER - 1 ? "You are in the promotion zone for Diamond. Hold your place until Sunday." : "You are in the promotion zone. Hold your place until Sunday.";
  if (down > 0 && tier > 0 && rank > n - down) { const safe = pointsAt(n - down); return safe != null ? `You are in the relegation zone. ${Math.max(1, safe - points + 1)} more point${safe - points + 1 === 1 ? "" : "s"} gets you clear.` : "You are in the relegation zone."; }
  if (up > 0 && tier < MAX_TIER) { const need = pointsAt(up); return need != null ? `${Math.max(1, need - points + 1)} more point${need - points + 1 === 1 ? "" : "s"} puts you in the promotion zone.` : "Keep climbing to reach the promotion zone."; }
  return tier === MAX_TIER ? "You are in the top league. Stay ahead to keep your place." : "Keep climbing.";
}

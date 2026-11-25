import { TIERS } from "@/lib/levels";

/**
 * The pure rules of the term bank: no database, so they can be checked on their own (scripts/check-terms.ts).
 *
 * A term sits at one of five tiers, and the tiers are the five ranks the rest of the app already uses (Initiate, Adept, Expert, Master, Titan).
 * Someone "is at" a rank when they know at least TERM_PASS of the terms they have been asked at that tier, and of every lower tier they have been asked.
 */

export const RANKS = TIERS.map((t) => t.name);
export const rankName = (rank: number) => (rank >= 1 && rank <= RANKS.length ? RANKS[rank - 1] : "Not yet at Initiate");

export const TERM_PASS = 0.8;
/** A tier needs this many answered terms before it counts towards a rank: two lucky answers are not a level. */
export const MIN_TIER_TESTED = 3;
export const MIN_PICK = 5;
export const MAX_PICK = 40;
/** A placement stage asks this many terms at one rank, so a pass (8 of 10) is real evidence and one slip does not decide it. */
export const PLACEMENT_SIZE = 10;
/** Fewer than this many answers at a rank cannot fail it, only (with enough right) pass it: four answers are too few to hold someone back. */
export const MIN_TIER_TO_FAIL = 5;

export type TermLite = {
  id: number;
  term: string;
  meaning: string;
  tier: number;
  group: string;
  bankId: number | null;
  /** "shared": a term in a bank. "mine": one the candidate added themselves. Meanings are only offered as wrong answers within the same kind, so their style never gives the answer away. */
  source: "shared" | "mine";
  similar: string[];
  /** more true lines about the term, beyond the meaning (verb-first) */
  facts: string[];
  /** a situation that points to this term, reading after "when you" */
  useWhen: string;
  /** believable lines that are false of this term */
  mistakes: string[];
};

export type TierStats = Record<number, { tested: number; right: number }>;

/**
 * The highest rank (0 to 5) a set of results supports. A tier asked at least MIN_TIER_TESTED times and at TERM_PASS is reached. A tier below TERM_PASS stops the climb
 * only when there is enough to say so: MIN_TIER_TO_FAIL answers, or three or four answers with half or fewer right. Three right out of four is too few to hold anyone back.
 */
export function rankFromStats(stats: TierStats): number {
  let rank = 0;
  for (let t = 1; t <= RANKS.length; t++) {
    const s = stats[t];
    if (!s || s.tested < MIN_TIER_TESTED) continue; // not tested enough to say either way
    const share = s.right / s.tested;
    if (share >= TERM_PASS) { rank = t; continue; }
    if (s.tested >= MIN_TIER_TO_FAIL || share <= 0.5) break;
  }
  return rank;
}

/** Tiers that were asked but too few times to count, and tiers not asked at all: shown to the person so a gap is not mistaken for a pass. */
export function untested(stats: TierStats): number[] {
  return RANKS.map((_, i) => i + 1).filter((t) => (stats[t]?.tested ?? 0) < MIN_TIER_TESTED);
}

export function pooledShare(stats: TierStats): number {
  let tested = 0, right = 0;
  for (const s of Object.values(stats)) { tested += s.tested; right += s.right; }
  return tested ? right / tested : 0;
}

/**
 * The highest rank of terms a level of a role covers, spread across the five ranks: the first rung stops at Adept and the top rung takes in everything up to
 * Titan. A role with no ladder (or one level) takes in all five. This is both the list ceiling for a level and the rank a goal at that level asks for.
 */
export function rankForRung(rung: number, rungs: number): number {
  if (rungs <= 1) return RANKS.length;
  const r = Math.min(Math.max(rung, 1), rungs);
  return Math.min(RANKS.length, 1 + Math.ceil((r * (RANKS.length - 1)) / rungs));
}

// ---- Study: a Leitner box per term. Meeting a term puts it in box 1; knowing it moves it up a box and pushes its next sight further away; forgetting sends it back.
export const BOX_DAYS = [0, 1, 3, 7, 14, 30]; // index = box
export const KNOWN_BOX = 4;
export const RETRY_SECONDS = 600; // a term you did not know comes back later in the same sitting

export type StudyState = "new" | "learning" | "known";
export const studyState = (box: number | null | undefined): StudyState => (box == null ? "new" : box >= KNOWN_BOX ? "known" : "learning");

export function nextReview(box: number | null, knew: boolean, nowSec: number): { box: number; dueAt: number; lapse: boolean } {
  if (!knew) return { box: 1, dueAt: nowSec + RETRY_SECONDS, lapse: (box ?? 0) >= KNOWN_BOX };
  const next = Math.min(BOX_DAYS.length - 1, (box ?? 0) + 1);
  return { box: next, dueAt: nowSec + BOX_DAYS[next] * 86400, lapse: false };
}

/** What the result says about a claim: confirmed when they reach the rank they claimed, otherwise how far short. */
export function verdict(claimed: number, reached: number, tested: boolean): "confirmed" | "above" | "below" | "unproven" {
  if (!tested) return "unproven";
  if (reached > claimed) return "above";
  if (reached === claimed) return "confirmed";
  return "below";
}

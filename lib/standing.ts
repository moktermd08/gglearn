/**
 * Where someone stands on a career ladder, from two independent sources. Pure: no database, no clock.
 * The title is what an authority (a manager or admin promotion) decided and always wins. The verified level is what real exams
 * prove. They are shown side by side and never merged: a gap between them is a reason to take the exams, not a correction of the title.
 */

export type RungEvidence = { level: number; /** steps that can be passed today */ counted: number; /** of those, how many exams have met */ met: number };

/**
 * The highest rung the exams prove: every measurable rung up to it is fully met. A rung with nothing to measure neither proves nor blocks.
 * Null when not even the first measurable rung is met.
 */
export function verifiedLevel(rungs: RungEvidence[]): number | null {
  let out: number | null = null;
  for (const r of [...rungs].sort((a, b) => a.level - b.level)) {
    if (r.counted === 0) continue;
    if (r.met < r.counted) break;
    out = r.level;
  }
  return out;
}

export type Agreement =
  /** title and exams say the same */
  | "agree"
  /** the title is higher than the exams prove: tests are open to verify it */
  | "title-ahead"
  /** the exams prove more than the title says: a case for promotion */
  | "verified-ahead"
  /** nothing measurable on the ladder yet */
  | "unverified";

export type Standing = {
  /** the level on the ladder: the latest promotion, or the bottom rung when nobody has promoted this person */
  level: number;
  basis: "authority" | "default";
  verified: number | null;
  agreement: Agreement;
  /** ladder levels between the verified level and the title (title-ahead), or the other way round (verified-ahead) */
  rungsApart: number;
};

/** `levels` is every level number on the ladder; `promoted` the level of the latest promotion, or null when there is none. */
export function standing(levels: number[], promoted: number | null, verified: number | null): Standing {
  const sorted = [...levels].sort((a, b) => a - b);
  const level = promoted ?? sorted[0];
  const basis = promoted === null ? "default" : "authority";
  if (verified === null) return { level, basis, verified, agreement: "unverified", rungsApart: 0 };
  const between = (lo: number, hi: number) => sorted.filter((l) => l > lo && l <= hi).length;
  if (level > verified) return { level, basis, verified, agreement: "title-ahead", rungsApart: between(verified, level) };
  if (level < verified) return { level, basis, verified, agreement: "verified-ahead", rungsApart: between(level, verified) };
  return { level, basis, verified, agreement: "agree", rungsApart: 0 };
}

/** A route target made from a career ladder is named by role and level: `career~lead_developer~3`. Role keys are lower case with spaces. */
export const careerSlug = (role: string, level: number) => `career~${role.trim().toLowerCase().replace(/ /g, "_")}~${level}`;

export function parseCareerSlug(slug: string): { role: string; level: number } | null {
  const m = /^career~([^~]+)~(\d{1,3})$/.exec(slug);
  return m ? { role: m[1].replace(/_/g, " "), level: Number(m[2]) } : null;
}

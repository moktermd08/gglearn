export const LEVELS = [
  "Novice", "Apprentice", "Learner", "Beginner", "Trainee",
  "Practitioner", "Competent", "Capable", "Skilled", "Proficient",
  "Advanced", "Specialist", "Expert", "Veteran", "Master",
  "Elite", "Virtuoso", "Legend", "Grandmaster", "Titan",
] as const;

export const MAX_LEVEL = LEVELS.length;
export const QUESTIONS_PER_RUN = 10;
export const PASS_MARK = 0.8;

export const KIND_LABEL: Record<string, string> = {
  subject: "Subject", product: "Product", service: "Service",
  tool: "Tool", technology: "Technology", process: "Process",
};

/** Five ranks of four levels each. The avatars evolve with the rank. */
export const TIERS = [
  { name: "Initiate", from: 1, hue: 200 },
  { name: "Adept", from: 5, hue: 150 },
  { name: "Expert", from: 9, hue: 45 },
  { name: "Master", from: 13, hue: 280 },
  { name: "Titan", from: 17, hue: 350 },
] as const;

/** 0..4 tier index for a level (level 0 = not started = tier 0). */
export const tierOf = (level: number) => Math.min(4, Math.max(0, Math.floor((Math.max(level, 1) - 1) / 4)));

/** Passing these levels issues a certificate. */
export const CERT_LEVELS = [5, 10, 15, 20] as const;
export const certTitle = (level: number) =>
  ({ 5: "Foundation", 10: "Practitioner", 15: "Expert", 20: "Titan" } as Record<number, string>)[level] ?? "Level";

/** XP needed per level. The rival's level is derived from XP with the same scale. */
export const XP_PER_LEVEL = 150;

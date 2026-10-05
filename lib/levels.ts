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

/**
 * Live duels: the rules and the clock, with nothing else attached so they can be tested exactly.
 *
 * A duel is DUEL_SIZE multiple-choice questions, the same ones for both players, shown at the same moment. Every moment comes from the
 * SERVER's clock and from when answers arrived, never from a player's own timer, so nobody can pause or slow the match.
 *   - a short countdown, then question 1 opens
 *   - a question stays open for QUESTION_MS, or closes early the moment both players have answered
 *   - then the right answer is shown for REVEAL_MS, then the next question opens
 * Nothing is stored about the schedule: it is worked out from when the duel started and when each answer came in, so it is always the same.
 */
export const DUEL_SIZE = 5, LEAD_MS = 5000, QUESTION_MS = 15000, REVEAL_MS = 4000;
export const CORRECT_POINTS = 100, SPEED_POINTS = 50; // up to 150 a question: right answers count most, quick ones a little more

/** What a question is worth: nothing if wrong or missed; 100, plus up to 50 for answering quickly. */
export function pointsFor(correct: boolean, answeredAfterMs: number): number {
  if (!correct) return 0;
  const left = Math.max(0, Math.min(1, 1 - answeredAfterMs / QUESTION_MS));
  return CORRECT_POINTS + Math.round(SPEED_POINTS * left);
}

/** When each player answered each question, in server milliseconds. A missing entry means they have not (or never did). */
export type AnswerTimes = { a?: number; b?: number }[];

export type Phase =
  | { phase: "countdown"; startsAt: number }
  | { phase: "question"; index: number; openAt: number; deadline: number }
  | { phase: "reveal"; index: number; openAt: number; closedAt: number; nextAt: number | null }
  | { phase: "done"; endedAt: number };

/**
 * Where a duel is at `now`. `botAfter[i]` is how long after question i opens the simulated rival answers it (null when the opponent is a person);
 * a rival that would take longer than the question allows simply does not answer in time. A player who has not answered holds the question open to its deadline.
 */
export function phaseAt(startedAt: number, answers: AnswerTimes, now: number, size = DUEL_SIZE, botAfter: number[] | null = null): Phase {
  let open = startedAt + LEAD_MS;
  if (now < open) return { phase: "countdown", startsAt: open };
  for (let i = 0; i < size; i++) {
    const a = answers[i]?.a, b = botAfter ? (botAfter[i] < QUESTION_MS ? open + botAfter[i] : undefined) : answers[i]?.b;
    const deadline = open + QUESTION_MS;
    const bothIn = a !== undefined && b !== undefined;
    const closedAt = bothIn ? Math.min(deadline, Math.max(a!, b!)) : deadline;
    if (!bothIn && now < deadline) return { phase: "question", index: i, openAt: open, deadline };
    if (bothIn && now < closedAt) return { phase: "question", index: i, openAt: open, deadline };
    const nextAt = closedAt + REVEAL_MS;
    if (now < nextAt) return { phase: "reveal", index: i, openAt: open, closedAt, nextAt: i + 1 < size ? nextAt : null };
    open = nextAt;
  }
  return { phase: "done", endedAt: open };
}

/** Can an answer for question `index` be taken at `now`? Only while that question is the open one. */
export function acceptsAnswer(startedAt: number, answers: AnswerTimes, now: number, index: number, size = DUEL_SIZE, botAfter: number[] | null = null): boolean {
  const p = phaseAt(startedAt, answers, now, size, botAfter);
  return p.phase === "question" && p.index === index;
}

// ---- the simulated rival ----

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; };
export const BOT_NAMES = ["Echo", "Pixel", "Orbit", "Nova", "Byte", "Ziggy", "Rex", "Bolt"] as const;
export const botNameFor = (seed: string) => BOT_NAMES[hash(`name:${seed}`) % BOT_NAMES.length];

/** The simulated rival's whole match, decided from a seed alone: does it get each question right, and how long does it take. Clearly labelled as simulated wherever shown. */
export function botPlan(seed: string, size = DUEL_SIZE): { correct: boolean; afterMs: number }[] {
  const skill = 0.55 + (hash(`skill:${seed}`) % 25) / 100; // between 55% and 79% right
  return Array.from({ length: size }, (_, i) => ({
    correct: (hash(`c:${seed}:${i}`) % 100) / 100 < skill,
    afterMs: 3500 + (hash(`t:${seed}:${i}`) % 9000), // between 3.5 and 12.5 seconds
  }));
}

/** How long after each question opens the rival answers it. */
export const botAfterMs = (seed: string, size = DUEL_SIZE): number[] => botPlan(seed, size).map((p) => p.afterMs);

/**
 * Every question's opening and closing moment, as far as the answers so far say (a question nobody has answered yet runs to its deadline). The server
 * uses this to know when each question opened, which is what a player's answer time is measured from.
 */
export function schedule(startedAt: number, answers: AnswerTimes, size = DUEL_SIZE, botAfter: number[] | null = null): { opens: number[]; closes: number[]; endedAt: number } {
  const opens: number[] = [], closes: number[] = [];
  let open = startedAt + LEAD_MS;
  for (let i = 0; i < size; i++) {
    const a = answers[i]?.a, b = botAfter ? (botAfter[i] < QUESTION_MS ? open + botAfter[i] : undefined) : answers[i]?.b;
    const deadline = open + QUESTION_MS, close = a !== undefined && b !== undefined ? Math.min(deadline, Math.max(a, b)) : deadline;
    opens.push(open); closes.push(close);
    open = close + REVEAL_MS;
  }
  return { opens, closes, endedAt: open };
}

export type Result = { you: number; them: number; outcome: "win" | "lose" | "draw" };
export const resultOf = (you: number, them: number): Result => ({ you, them, outcome: you > them ? "win" : you < them ? "lose" : "draw" });

/** Checks the live duel's clock and scoring: npm run check:duelrules (pure; touches no data). */
import { DUEL_SIZE, LEAD_MS, QUESTION_MS, REVEAL_MS, acceptsAnswer, botAfterMs, botNameFor, botPlan, phaseAt, pointsFor, resultOf, schedule, type AnswerTimes } from "../lib/duelRules";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const T0 = 1_000_000;
const none: AnswerTimes = [];
const p = (now: number, a: AnswerTimes = none, bot: number[] | null = null) => phaseAt(T0, a, now, DUEL_SIZE, bot);

check("before the lead time it is a countdown", p(T0).phase === "countdown" && (p(T0 + LEAD_MS - 1) as { startsAt: number }).startsAt === T0 + LEAD_MS);
const q0 = p(T0 + LEAD_MS) as { phase: string; index: number; openAt: number; deadline: number };
check("question 1 opens when the countdown ends and is open for its time", q0.phase === "question" && q0.index === 0 && q0.openAt === T0 + LEAD_MS && q0.deadline === T0 + LEAD_MS + QUESTION_MS);
check("it stays open until the deadline when nobody answers", p(T0 + LEAD_MS + QUESTION_MS - 1).phase === "question");
check("then the answer is shown", p(T0 + LEAD_MS + QUESTION_MS).phase === "reveal");
check("...for the reveal time, and then question 2 opens", p(T0 + LEAD_MS + QUESTION_MS + REVEAL_MS - 1).phase === "reveal" && (p(T0 + LEAD_MS + QUESTION_MS + REVEAL_MS) as { index: number }).index === 1);

const open0 = T0 + LEAD_MS;
check("one player answering does not close the question", p(open0 + 3000, [{ a: open0 + 2000 }]).phase === "question");
check("both answering closes it at once, not before", p(open0 + 3499, [{ a: open0 + 2000, b: open0 + 3500 }]).phase === "question" && p(open0 + 3500, [{ a: open0 + 2000, b: open0 + 3500 }]).phase === "reveal");
const early = p(open0 + 5000, [{ a: open0 + 2000, b: open0 + 3500 }]) as { phase: string; closedAt: number; nextAt: number };
check("...and the next question opens after the reveal, earlier than the full schedule", early.closedAt === open0 + 3500 && early.nextAt === open0 + 3500 + REVEAL_MS && early.nextAt < open0 + QUESTION_MS);
check("after an early close the next question opens at the right moment", (p(open0 + 3500 + REVEAL_MS, [{ a: open0 + 2000, b: open0 + 3500 }]) as { index: number }).index === 1);
check("a late second answer cannot reopen anything: the deadline caps the close", (p(open0 + QUESTION_MS, [{ a: open0 + 2000, b: open0 + QUESTION_MS + 500 }]) as { phase: string }).phase === "reveal");

// a whole duel where everybody answers instantly
let t = open0; const quick: AnswerTimes = [];
for (let i = 0; i < DUEL_SIZE; i++) { quick.push({ a: t + 1000, b: t + 2000 }); t = t + 2000 + REVEAL_MS; }
check("five instant questions end the duel sooner than the full schedule", p(t, quick).phase === "done" && (p(t, quick) as { endedAt: number }).endedAt === t && t < open0 + DUEL_SIZE * (QUESTION_MS + REVEAL_MS) && p(t - 1, quick).phase === "reveal");
check("the last question has no next", (p(open0 + 4 * (2000 + REVEAL_MS) + 2000, quick) as { nextAt: number | null }).nextAt === null);
const full = open0 + DUEL_SIZE * (QUESTION_MS + REVEAL_MS);
check("with nobody answering the duel lasts exactly the full schedule", p(full - 1).phase === "reveal" && p(full).phase === "done" && (p(full) as { endedAt: number }).endedAt === full);

check("an answer is only taken for the open question", acceptsAnswer(T0, none, open0 + 1000, 0) && !acceptsAnswer(T0, none, open0 + 1000, 1) && !acceptsAnswer(T0, none, T0 + 100, 0));
check("...not once it has closed or during the reveal", !acceptsAnswer(T0, none, open0 + QUESTION_MS, 0) && !acceptsAnswer(T0, none, open0 + QUESTION_MS + 100, 0));
check("...nor once both have answered", !acceptsAnswer(T0, [{ a: open0 + 1000, b: open0 + 2000 }], open0 + 2500, 0));
check("...and the next question takes answers when it opens", acceptsAnswer(T0, none, open0 + QUESTION_MS + REVEAL_MS + 10, 1));

// scoring
check("a wrong or missed answer scores nothing", pointsFor(false, 0) === 0 && pointsFor(false, 5000) === 0);
check("a right answer is worth 100 and up to 50 more for speed", pointsFor(true, QUESTION_MS) === 100 && pointsFor(true, 0) === 150 && pointsFor(true, QUESTION_MS / 2) === 125);
check("speed never goes below or above its range", pointsFor(true, QUESTION_MS * 3) === 100 && pointsFor(true, -500) === 150);
check("a win, a loss and a draw", resultOf(300, 200).outcome === "win" && resultOf(200, 300).outcome === "lose" && resultOf(250, 250).outcome === "draw");

// the simulated rival
const plan = botPlan("seed-1");
check("the rival's match is decided by its seed alone", JSON.stringify(plan) === JSON.stringify(botPlan("seed-1")) && JSON.stringify(plan) !== JSON.stringify(botPlan("seed-2")));
check("it plays every question and takes a believable time", plan.length === DUEL_SIZE && plan.every((x) => x.afterMs >= 3500 && x.afterMs < 12500));
const rights = Array.from({ length: 300 }, (_, i) => botPlan(`s${i}`)).flat().filter((x) => x.correct).length / (300 * DUEL_SIZE);
check("it gets between half and four fifths right overall, so it is beatable but not hopeless", rights > 0.5 && rights < 0.85);
check("it has a name from a fixed list", ["Echo", "Pixel", "Orbit", "Nova", "Byte", "Ziggy", "Rex", "Bolt"].includes(botNameFor("seed-1")) && botNameFor("seed-1") === botNameFor("seed-1"));
const after = botAfterMs("seed-1");
check("the rival's answer delays match its plan", after.length === DUEL_SIZE && after.every((x, i) => x === plan[i].afterMs));
check("against the rival, a question closes early once you and it have both answered", (p(open0 + after[0] + 100, [{ a: open0 + 400 }], after) as { phase: string }).phase === "reveal" && p(open0 + 300, [{ a: open0 + 200 }], after).phase === "question");
check("a rival that is slower than the question allows does not hold up the early close", (() => { const slow = [QUESTION_MS + 1, 0, 0, 0, 0]; return p(open0 + 1000, [{ a: open0 + 500 }], slow).phase === "question" && p(open0 + QUESTION_MS, [{ a: open0 + 500 }], slow).phase === "reveal"; })());

// the full schedule
const sc = schedule(T0, quick);
check("the schedule lists when each question opened and closed", sc.opens.length === DUEL_SIZE && sc.opens[0] === open0 && sc.closes[0] === open0 + 2000 && sc.opens[1] === open0 + 2000 + REVEAL_MS);
check("it ends where the clock says the duel is done", sc.endedAt === t);
const scNone = schedule(T0, []);
check("with no answers every question runs its full time", scNone.closes.every((c, i) => c === scNone.opens[i] + QUESTION_MS) && scNone.endedAt === full);
const scBot = schedule(T0, [{ a: open0 + 400 }], DUEL_SIZE, after);
check("against the rival, the schedule uses its delays", scBot.closes[0] === open0 + Math.max(400, after[0]));

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

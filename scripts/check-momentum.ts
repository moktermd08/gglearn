/**
 * Checks the Career doctor's momentum: npm run check:momentum. Pure, touches no database. Steady practice reads as steady, a one-off pass long ago
 * fades, an empty history is "Not yet", and old results never count as recent.
 */
import { momentumOf, WEEKS, type Event } from "../lib/careerMomentum";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const DAY = 86400, WEEK = 7 * DAY, NOW = 1_800_000_000;
const ago = (days: number) => NOW - days * DAY;
const exam = (days: number, score: number, level: number, passed = true): Event => ({ at: ago(days), score, passed, level });
const quest = (days: number): Event => ({ at: ago(days), score: null, passed: false, level: 0 });

const none = momentumOf([], NOW);
check("no history is Not yet", none.label === "Not yet" && none.score === 0 && none.daysSince === null);

const steady = momentumOf(Array.from({ length: 10 }, (_, i) => exam(i * 7 + 1, 0.85, 1 + (i < 2 ? 1 : 0))), NOW);
check("weekly practice for 10 weeks is Steady", steady.label === "Steady" && steady.weeks === 10 && steady.score > 0.6);
check("reliability is the average score", Math.abs(steady.reliability! - 0.85) < 1e-9);

const oldPass = momentumOf([exam(400, 1, 3)], NOW);
check("one pass over a year ago is Fading with nothing recent", oldPass.label === "Fading" && oldPass.weeks === 0 && oldPass.daysSince === 400 && oldPass.gained === 0);
check("old pass scores below steady practice", oldPass.score < steady.score);

const burst = momentumOf([exam(1, 0.9, 1), exam(2, 0.9, 2), exam(3, 0.9, 3)], NOW);
check("three exams in one week is Building, not Steady", burst.label === "Building" && burst.weeks === 1);
check("levels above the earlier best count as gained", burst.gained === 3);

const regain = momentumOf([exam(300, 1, 4), exam(5, 0.8, 4), exam(6, 0.8, 5)], NOW);
check("only levels above the earlier best are gained", regain.gained === 1);

const habit = momentumOf(Array.from({ length: 6 }, (_, i) => quest(i * 7 + 2)), NOW);
check("quests alone count for regularity but give no reliability", habit.weeks === 6 && habit.reliability === null && (habit.label === "Building" || habit.label === "Steady"));

check("activity after the window is ignored", momentumOf([{ ...exam(0, 1, 1), at: NOW + WEEK }], NOW).weeks === 0);
check("window is twelve weeks", WEEKS === 12 && momentumOf([exam(WEEKS * 7 + 1, 1, 1)], NOW).weeks === 0 && momentumOf([exam(WEEKS * 7 - 1, 1, 1)], NOW).weeks === 1);
check("score stays within 0..1", [none, steady, oldPass, burst, regain, habit].every((m) => m.score >= 0 && m.score <= 1));

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);

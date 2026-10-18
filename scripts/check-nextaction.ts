/** Checks the dashboard's "next step" order: npm run check:nextaction (pure; touches no data). */
import { nextAction, type NextInput } from "../lib/nextAction";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

const base: NextInput = {
  invites: [], updates: { count: 0, first: "", overdue: false }, required: [], races: [], focus: null, streak: 0, questsToday: 0, maxLevel: 20,
};
const focus = (over: Partial<NonNullable<NextInput["focus"]>> = {}) => ({ slug: "git", name: "Git", enrolled: true, passed: 2, done: new Set<string>(), ...over });
const kind = (o: Partial<NextInput>) => nextAction({ ...base, ...o }).kind;

check("a brand new person is told to start a race", kind({}) === "start");
check("an invitation beats everything", kind({ invites: [{ slug: "r1", title: "T", from: "Ana" }], required: [{ slug: "x", name: "X", overdue: true, daysLeft: -3, enrolled: true }] }) === "invite");
check("an overdue update beats an overdue subject", kind({ updates: { count: 1, first: "Policy", overdue: true }, required: [{ slug: "x", name: "X", overdue: true, daysLeft: -3, enrolled: true }] }) === "update");
check("an update that is not overdue does not interrupt", kind({ updates: { count: 1, first: "Policy", overdue: false }, focus: focus() }) === "quest");
check("an overdue subject comes before a race ending", kind({ required: [{ slug: "x", name: "X", overdue: true, daysLeft: -1, enrolled: true }], races: [{ slug: "r", title: "R", hoursLeft: 5 }] }) === "overdue");
check("a race ending within two days comes before a quest", kind({ races: [{ slug: "r", title: "R", hoursLeft: 30 }], focus: focus() }) === "race-ending");
check("a race with days left does not", kind({ races: [{ slug: "r", title: "R", hoursLeft: 100 }], focus: focus() }) === "quest");
check("a subject due this week comes before a quest", kind({ required: [{ slug: "x", name: "X", overdue: false, daysLeft: 5, enrolled: true }], focus: focus() }) === "due-soon");
check("a subject due in a month does not", kind({ required: [{ slug: "x", name: "X", overdue: false, daysLeft: 30, enrolled: true }], focus: focus() }) === "quest");

const q = nextAction({ ...base, focus: focus() });
check("the first quest is the drill, and its link goes straight there", q.kind === "quest" && q.href === "/tracks/git/drill");
check("the other quests are offered as smaller options", (q.also ?? []).length === 2);
const q2 = nextAction({ ...base, focus: focus({ done: new Set(["drill"]) }) });
check("with the drill done, the study guide for the next level is next", q2.href === "/tracks/git/learn/3");
const q3 = nextAction({ ...base, focus: focus({ done: new Set(["drill", "study"]) }) });
check("then the exam", q3.href === "/tracks/git#levels");
check("a streak at risk is named", /streak/.test(nextAction({ ...base, focus: focus(), streak: 4 }).why));
check("a streak already kept today is not nagged about", !/streak/.test(nextAction({ ...base, focus: focus(), streak: 4, questsToday: 1 }).why));

check("all quests done and a race on: go to the race", kind({ focus: focus({ done: new Set(["drill", "study", "exam"]) }), races: [{ slug: "r", title: "R", hoursLeft: 200 }], questsToday: 3 }) === "race");
check("all quests done and no race: celebrate and offer a friend race", kind({ focus: focus({ done: new Set(["drill", "study", "exam"]) }), questsToday: 3 }) === "done");
check("a required subject not started yet leads to starting it", kind({ focus: focus({ enrolled: false }) }) === "start-subject");
check("a subject at Titan is never offered as a quest", kind({ focus: focus({ passed: 20 }) }) === "start");
check("the exam link never goes past the top level", nextAction({ ...base, focus: focus({ passed: 19, done: new Set(["drill", "study"]) }) }).href === "/tracks/git#levels");
check("every answer has a title, a reason, a button and a link", [{}, { focus: focus() }, { invites: [{ slug: "r", title: "T", from: "A" }] }].every((o) => { const a = nextAction({ ...base, ...o }); return a.title && a.why && a.cta && a.href.startsWith("/"); }));

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

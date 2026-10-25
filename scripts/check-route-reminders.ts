/** Checks the weekly route email: npm run check:routemail (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows; sends nothing real). Needs SESSION_SECRET. Run db:push first. */
import { eq, inArray, like } from "drizzle-orm";
import { brands, db, emailLog, questions, routeAreaResults, routeAssessments, routePlans, routeTasks, tracks, users } from "../lib/db";
import type { RouteAnswers } from "../lib/db/schema";
import type { Mail } from "../lib/mail";
import { unsubToken, userOfUnsubToken } from "../lib/nudges";
import { TARGETS, answerCurrent, assessmentFor, resolveAreas, startAssessment, type Target } from "../lib/route";
import { createPlan } from "../lib/routePlan";
import { WEEK } from "../lib/roadmap";
import { assessmentOfUnsubToken, routeMail, routeUnsubToken, routeWindow, runRouteReminders, setReminders, unsubscribeRoute } from "../lib/routeReminders";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const T = (s: string) => new Date(s);

// the pure parts
check("the reminder is due on Wednesday morning", routeWindow(T("2026-10-21T09:00:00Z"))?.key === "2026-10-19");
check("...once a week: the key is the Monday that week started", routeWindow(T("2026-10-28T09:00:00Z"))?.key === "2026-10-26");
check("not before 08:00 or from 20:00", routeWindow(T("2026-10-21T07:59:00Z")) === null && routeWindow(T("2026-10-21T20:00:00Z")) === null);
check("not on Monday (the recap's day) or any other day", ["2026-10-19", "2026-10-20", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"].every((d) => routeWindow(T(`${d}T09:00:00Z`)) === null));
check("an unsubscribe token leads back to its plan", assessmentOfUnsubToken(routeUnsubToken(42)) === 42);
check("a changed signature, another plan's number, or junk is refused", assessmentOfUnsubToken(`42.${"A".repeat(22)}`) === null && assessmentOfUnsubToken(`43.${routeUnsubToken(42).split(".")[1]}`) === null && ["", "1", "x.y", "../.."].every((x) => assessmentOfUnsubToken(x) === null));
check("the recap's unsubscribe token cannot switch off the route email, nor the other way round", assessmentOfUnsubToken(unsubToken(42)) === null && userOfUnsubToken(routeUnsubToken(42)) === null);

const note = { name: "Poppy <b>Test</b>", academy: "gglearn", base: "https://x.test", unsubscribe: "https://x.test/unsubscribe/route/7.abc", jobTitle: "Administrative Officer, UK Civil Service", stepsDone: 3, stepsTotal: 13, status: "on-track" as const, weeksLate: 0, steps: [{ label: "Core office skills", due: "13 Nov 2026", kind: "learn" as const }, { label: "Write six STAR examples", due: "20 Nov 2026", kind: "action" as const }], finish: "25 Oct 2027" };
const m = routeMail("p@x.test", note);
check("the email says where she is and what to do this week", /3 of 13 steps done/.test(m.text) && /Core office skills \(by 13 Nov 2026\)/.test(m.text) && /Write six STAR examples/.test(m.text));
check("it links to the route and has a one-click unsubscribe in the body and the headers", m.text.includes("https://x.test/route") && m.text.includes(note.unsubscribe) && m.html.includes(note.unsubscribe) && m.headers?.["List-Unsubscribe"] === `<${note.unsubscribe}>` && m.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
check("it says why it was sent", /because you asked for a weekly reminder/.test(m.text));
check("a name that looks like HTML is escaped, and the greeting uses the first name", !m.html.includes("<b>Test") && m.text.startsWith("Hi Poppy,"));
const late = routeMail("p@x.test", { ...note, status: "behind", weeksLate: 3.2 });
check("when behind it says so kindly and suggests re-planning", /about 3 weeks behind/.test(late.text) && /re-plan from today/.test(late.text) && /re-plan/.test(late.subject));

// sending, against the database
const MAIL = "%@routemail.check", SLUG = "routemail-check";
function sweep() {
  const ids = db.select({ id: users.id }).from(users).where(like(users.email, MAIL)).all().map((r) => r.id);
  if (ids.length) {
    const aids = db.select({ id: routeAssessments.id }).from(routeAssessments).where(inArray(routeAssessments.userId, ids)).all().map((r) => r.id);
    if (aids.length) { db.delete(routePlans).where(inArray(routePlans.assessmentId, aids)).run(); db.delete(routeTasks).where(inArray(routeTasks.assessmentId, aids)).run(); db.delete(routeAreaResults).where(inArray(routeAreaResults.assessmentId, aids)).run(); }
    db.delete(emailLog).where(inArray(emailLog.userId, ids)).run();
    db.delete(routeAssessments).where(inArray(routeAssessments.userId, ids)).run();
    db.delete(users).where(inArray(users.id, ids)).run();
  }
  const ts = db.select({ id: tracks.id }).from(tracks).where(like(tracks.slug, `${SLUG}-%`)).all().map((t) => t.id);
  if (ts.length) { db.delete(questions).where(inArray(questions.trackId, ts)).run(); db.delete(tracks).where(inArray(tracks.id, ts)).run(); }
  db.delete(brands).where(eq(brands.slug, SLUG)).run();
}

async function main() {
  sweep();
  try {
    const brand = db.insert(brands).values({ slug: SLUG, name: "Route mail check", kind: "shared" }).returning().get();
    const t = db.insert(tracks).values({ brandId: brand.id, slug: `${SLUG}-one`, name: "one", kind: "process", audience: "staff" }).returning().get();
    for (let l = 1; l <= 4; l++) for (let i = 0; i < 2; i++) db.insert(questions).values({ trackId: t.id, level: l, type: "mcq", prompt: `L${l} Q${i}`, options: [{ key: "a", text: "right" }, { key: "b", text: "wrong" }], answer: "a" }).run();
    const target: Target = {
      slug: "routemail-check", title: "Check job", short: "Check job", summary: "",
      areas: [{ key: "one", label: "One", why: "", trackSlug: `${SLUG}-one`, target: 4, hoursPerLevel: 3, stage: 1, priority: 1 }],
      actions: [{ key: "setup", label: "Set up", detail: "", stage: 1, hours: 1, priority: 0 }],
    };
    TARGETS.push(target);
    const answers: RouteAnswers = { education: "none", yearsOut: 8, paidWork: "none", unpaid: [], digital: 3, writing: 3, workRights: "yes" };
    const t0 = 1_800_000_000; // a plan that started in 2027
    const mk = (n: string) => db.insert(users).values({ email: `${n}@routemail.check`, name: `${n} Test`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x", status: "active" }).returning().get();
    const planFor = (n: string, remind: boolean) => {
      const p = mk(n);
      const areas = resolveAreas(target, p);
      startAssessment(p, target, { horizonMonths: 12, hoursPerWeek: 5, answers });
      let g = 0;
      while (assessmentFor(p.id, target.slug)!.status === "in_progress" && g++ < 20) answerCurrent(assessmentFor(p.id, target.slug)!, areas, () => "b");
      const a = assessmentFor(p.id, target.slug)!;
      createPlan(p, target, a, t0);
      if (remind) setReminders(p.id, target.slug, true, t0);
      return { p, a };
    };
    const on = planFor("on", true), off = planFor("off", false), gone = planFor("gone", true);
    db.update(users).set({ status: "offboarded" }).where(eq(users.id, gone.p.id)).run();
    const only = [on.p.id, off.p.id, gone.p.id];
    const outbox: Mail[] = []; let failNext = false;
    const send = async (m: Mail) => { if (failNext) return { ok: false, error: "boom" }; outbox.push(m); return { ok: true }; };
    const wed = (wk: number, h = "09:00:00Z") => new Date(Date.parse("2027-01-13T00:00:00Z") + wk * WEEK * 1000 + (Number(h.slice(0, 2)) * 3600) * 1000); // a Wednesday in 2027, `wk` weeks on
    check("the check date is a Wednesday", wed(0).getUTCDay() === 3);
    const run = (now: Date, extra: { dry?: boolean; max?: number } = {}) => runRouteReminders({ now, base: "https://x.test", send, only, ...extra });

    check("the plan starts off with the reminder off", off.a.reminders === "off" && assessmentFor(off.p.id, target.slug)!.reminders === "off");
    check("turning it on records when", assessmentFor(on.p.id, target.slug)!.reminders === "on" && assessmentFor(on.p.id, target.slug)!.remindersAt === t0);

    let r = await run(new Date("2027-01-12T09:00:00Z"));
    check("on a Tuesday nothing is due", !r.due && r.sent.length === 0 && outbox.length === 0);
    r = await run(wed(0), { dry: true });
    check("a dry run lists who would get one and sends and records nothing", r.sent.length === 1 && outbox.length === 0 && db.select().from(emailLog).where(inArray(emailLog.userId, only)).all().length === 0);
    r = await run(wed(0));
    check("Wednesday: only the person who turned it on, and is still active, gets one", r.due && r.sent.length === 1 && r.sent[0].email === "on@routemail.check" && outbox.length === 1);
    check("...and it carries her plan's steps and her own unsubscribe link", /Set up|One/.test(outbox[0].text) && outbox[0].text.includes(`/unsubscribe/route/${routeUnsubToken(on.a.id)}`));
    check("...and none of her questionnaire answers", !/yearsOut|workRights|education|unsure/.test(outbox[0].text + outbox[0].html));
    r = await run(wed(0, "15:00:00Z"));
    check("running again the same day sends nothing", r.sent.length === 0 && outbox.length === 1);
    r = await run(wed(1));
    check("the next Wednesday sends the next one", r.sent.length === 1 && outbox.length === 2);

    // stopping
    check("the one-click unsubscribe turns it off", unsubscribeRoute(routeUnsubToken(on.a.id)) && assessmentFor(on.p.id, target.slug)!.reminders === "off");
    r = await run(wed(2));
    check("after that nothing more is sent", r.sent.length === 0 && outbox.length === 2);
    check("a bad token changes nothing and says so", !unsubscribeRoute("1.AAAAAAAAAAAAAAAAAAAAAA") && !unsubscribeRoute("junk"));
    check("the recap setting is not touched by stopping the route email", db.select({ s: users.emailNudges }).from(users).where(eq(users.id, on.p.id)).get()!.s === db.select({ s: users.emailNudges }).from(users).where(eq(users.id, off.p.id)).get()!.s);
    setReminders(on.p.id, target.slug, true);

    // what is worth saying
    r = await run(wed(3));
    check("turned back on, she gets the next one", r.sent.length === 1 && outbox.length === 3);
    check("someone far behind is told so and offered a re-plan", /behind/.test(outbox[2].text) && /re-plan/i.test(outbox[2].subject));
    db.update(routePlans).set({ endsOn: Math.floor(wed(4).getTime() / 1000) - 3600 }).where(eq(routePlans.assessmentId, on.a.id)).run();
    r = await run(wed(4));
    check("once the timeframe has ended no more are sent", r.sent.length === 0 && outbox.length === 3);

    // failure and cap
    db.delete(emailLog).where(inArray(emailLog.userId, only)).run();
    db.update(routePlans).set({ endsOn: Math.floor(wed(60).getTime() / 1000) }).where(eq(routePlans.assessmentId, on.a.id)).run();
    failNext = true; r = await run(wed(5));
    check("a failed send is reported and not recorded", r.failed.length === 1 && r.sent.length === 0 && db.select().from(emailLog).where(eq(emailLog.userId, on.p.id)).all().length === 0);
    failNext = false; r = await run(wed(5, "10:00:00Z"));
    check("...so the next run sends it", r.sent.length === 1 && r.failed.length === 0);
    const more = planFor("more", true); only.push(more.p.id);
    db.delete(emailLog).where(inArray(emailLog.userId, only)).run(); outbox.length = 0;
    r = await run(wed(6), { max: 1 });
    check("a run stops at its cap", r.sent.length === 1 && outbox.length === 1);
    TARGETS.pop();
  } finally {
    sweep();
  }
  check("the test's own rows are gone", db.select().from(users).where(like(users.email, MAIL)).all().length === 0);
  if (fails) { console.error(`${fails} check(s) failed`); process.exit(1); }
}
main();

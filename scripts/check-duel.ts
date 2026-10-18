/** Checks the live duel's server side: npm run check:duel (uses DATABASE_FILE or data/gglearn.db; adds and removes its own rows; drives the clock by hand). Run db:push first. */
import { and, eq, inArray, like } from "drizzle-orm";
import { dailyQuests, db, duelAnswers, duels, enrollments, questions, tracks, users } from "../lib/db";
import { cancelDuel, duelOf, fillWithBot, joinDuel, startDuel, stateFor, submitAnswer } from "../lib/duel";
import { DUEL_SIZE, LEAD_MS, QUESTION_MS, REVEAL_MS, botAfterMs, botPlan, pointsFor } from "../lib/duelRules";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const sweep = () => {
  const us = db.select({ id: users.id }).from(users).where(like(users.email, "%@duel.check")).all().map((r) => r.id);
  if (!us.length) return;
  const ds = db.select({ id: duels.id }).from(duels).where(inArray(duels.hostId, us)).all().map((r) => r.id);
  if (ds.length) { db.delete(duelAnswers).where(inArray(duelAnswers.duelId, ds)).run(); db.delete(duels).where(inArray(duels.id, ds)).run(); }
  db.delete(dailyQuests).where(inArray(dailyQuests.userId, us)).run(); db.delete(enrollments).where(inArray(enrollments.userId, us)).run(); db.delete(users).where(inArray(users.id, us)).run();
};
sweep();
const T0 = 5_000_000_000_000; // a made-up server clock, far from the real one
try {
  const track = db.select().from(tracks).where(eq(tracks.slug, "python-titan")).get()!;
  const mk = (n: string) => db.insert(users).values({ name: `${n} Tester`, email: `${n}@duel.check`, jobRole: "general", audience: "staff", guest: "yes", passwordHash: "x" }).returning().get();
  const host = mk("host"), guest = mk("guest"), stranger = mk("stranger");
  const U = (u: typeof host) => ({ id: u.id, name: u.name, audience: u.audience });
  const startAt = (code: string) => db.update(duels).set({ startedAt: T0 }).where(eq(duels.code, code)).run(); // so the clock is ours
  const OPEN0 = T0 + LEAD_MS;
  const rightKey = (id: number) => db.select({ a: questions.answer }).from(questions).where(eq(questions.id, id)).get()!.a!;
  const wrongKey = (id: number) => (db.select({ o: questions.options, a: questions.answer }).from(questions).where(eq(questions.id, id)).get()!.o ?? []).find((o) => o.key.toLowerCase() !== rightKey(id).toLowerCase())!.key;

  // ---- against the simulated rival ----
  const made = startDuel(U(host), track.id, "bot") as { code: string };
  check("starting against a rival makes a live duel with five questions", "code" in made && duelOf(made.code)?.status === "live" && duelOf(made.code)?.questionIds?.length === DUEL_SIZE);
  const code = made.code, d = duelOf(code)!, qids = d.questionIds!;
  startAt(code);
  check("the topic's own questions are used, at a level the host has passed (drills' rule)", qids.every((id) => { const q = db.select().from(questions).where(eq(questions.id, id)).get()!; return q.trackId === track.id && q.type === "mcq" && q.status === "active" && q.level <= 1; }));

  let st = stateFor(code, host.id, T0 + 1000)!;
  check("it starts with a countdown and no question yet", st.phase === "countdown" && !st.question && st.startsAt === OPEN0);
  check("the rival is labelled as simulated", st.opponent?.simulated === true && !!st.opponent.name);

  st = stateFor(code, host.id, OPEN0 + 100)!;
  check("question one opens with its text and options", st.phase === "question" && st.index === 0 && !!st.question?.prompt && (st.question?.options.length ?? 0) >= 2);
  const leaked = JSON.stringify(st);
  check("the right answer is not anywhere in what an open question sends", !("reveal" in st) && !/"correct"|"answer"/.test(leaked));
  check("nor what the rival chose", !st.reveal && st.progress.them[0] === 0);

  check("an answer to a question that is not open is refused", "error" in submitAnswer(code, host.id, 1, "a", OPEN0 + 200));
  check("an answer that is not one of the options is refused", "error" in submitAnswer(code, host.id, 0, "zzz", OPEN0 + 200));
  check("a stranger cannot answer or watch", "error" in submitAnswer(code, stranger.id, 0, "a", OPEN0 + 200) && stateFor(code, stranger.id, OPEN0 + 200) === null);
  check("an answer before the countdown ends is refused", "error" in submitAnswer(code, host.id, 0, "a", T0 + 100));
  const right0 = rightKey(qids[0]);
  check("a right answer is accepted", "ok" in submitAnswer(code, host.id, 0, right0, OPEN0 + 1000));
  check("answering the same question twice is refused", "error" in submitAnswer(code, host.id, 0, wrongKey(qids[0]), OPEN0 + 1500));
  st = stateFor(code, host.id, OPEN0 + 1200)!;
  check("your own answer is remembered, and the question stays open until the rival answers or time runs out", st.phase === "question" && st.mine?.answered === true && st.mine.choice === right0 && st.progress.you[0] === 1);

  const after = botAfterMs(duelOf(code)!.botSeed!), plan = botPlan(duelOf(code)!.botSeed!);
  const closeAt0 = OPEN0 + Math.max(1000, after[0]);
  check("it closes the moment the rival has answered too", stateFor(code, host.id, closeAt0 - 1)!.phase === "question" && stateFor(code, host.id, closeAt0)!.phase === "reveal");
  st = stateFor(code, host.id, closeAt0 + 50)!;
  check("the reveal shows the right answer and both choices and points", st.reveal?.correct === right0 && st.reveal.you.choice === right0 && st.reveal.you.points === pointsFor(true, 1000) && st.reveal.them.points === (plan[0].correct ? pointsFor(true, after[0]) : 0));
  check("progress and totals only count what has been shown", st.progress.you[0] === 2 && st.totals.you === pointsFor(true, 1000));

  // play the other four: answer everything right, one second after each question opens
  let t = closeAt0 + REVEAL_MS;
  for (let i = 1; i < DUEL_SIZE; i++) {
    check(`question ${i + 1} opens after the reveal`, stateFor(code, host.id, t + 10)!.index === i);
    submitAnswer(code, host.id, i, rightKey(qids[i]), t + 1000);
    t = t + Math.max(1000, after[i]) + REVEAL_MS;
  }
  st = stateFor(code, host.id, t + 10)!;
  check("after the last reveal the duel is done, with a result and every question listed", st.phase === "done" && st.final?.rows.length === DUEL_SIZE && !!st.final.outcome);
  const hostTotal = DUEL_SIZE * pointsFor(true, 1000);
  const botTotal = plan.reduce((s, p) => s + (p.correct && p.afterMs < QUESTION_MS ? pointsFor(true, p.afterMs) : 0), 0);
  check("the totals are exactly what the rules say", st.final?.you === hostTotal && st.final?.them === botTotal && st.final?.outcome === (hostTotal > botTotal ? "win" : hostTotal < botTotal ? "lose" : "draw"));
  check("the result is written once", duelOf(code)?.status === "done" && duelOf(code)?.hostPoints === hostTotal && duelOf(code)?.guestPoints === botTotal);
  check("finishing counts as the day's quick drill, so it keeps a streak", db.select().from(dailyQuests).where(and(eq(dailyQuests.userId, host.id), eq(dailyQuests.kind, "drill"))).all().length === 1);
  stateFor(code, host.id, t + 5000); stateFor(code, host.id, t + 9000);
  check("looking again changes nothing and does not pay the drill twice", db.select().from(dailyQuests).where(and(eq(dailyQuests.userId, host.id), eq(dailyQuests.kind, "drill"))).all().length === 1 && duelOf(code)?.hostPoints === hostTotal);
  check("a duel that is over takes no more answers", "error" in submitAnswer(code, host.id, 0, "a", t + 20));

  // ---- two people ----
  const m2 = startDuel(U(host), track.id, "friend") as { code: string };
  check("a friend duel waits for someone", "code" in m2 && duelOf(m2.code)?.status === "waiting" && stateFor(m2.code, host.id)?.phase === "waiting");
  check("clicking again gives the same waiting duel back", (startDuel(U(host), track.id, "friend") as { code: string }).code === m2.code);
  check("the host cannot join their own duel", "error" in joinDuel(m2.code, U(host)));
  check("someone not in it sees nothing", stateFor(m2.code, guest.id) === null);
  check("a friend who opens the link joins, and it goes live", "ok" in joinDuel(m2.code, U(guest)) && duelOf(m2.code)?.status === "live" && duelOf(m2.code)?.guestId === guest.id);
  check("a third person cannot take the seat", "error" in joinDuel(m2.code, U(stranger)));
  startAt(m2.code);
  const q2 = duelOf(m2.code)!.questionIds!;
  submitAnswer(m2.code, guest.id, 0, wrongKey(q2[0]), OPEN0 + 2000);
  let hs = stateFor(m2.code, host.id, OPEN0 + 2500)!, gs = stateFor(m2.code, guest.id, OPEN0 + 2500)!;
  check("the host is told the friend has answered, but not what they chose", hs.phase === "question" && hs.progress.them[0] === 1 && !hs.reveal && !JSON.stringify(hs).includes(wrongKey(q2[0]) + '","points'));
  check("the friend sees their own answer and that the host has not answered", gs.mine?.answered === true && gs.progress.them[0] === 0);
  submitAnswer(m2.code, host.id, 0, rightKey(q2[0]), OPEN0 + 4000);
  hs = stateFor(m2.code, host.id, OPEN0 + 4000)!; gs = stateFor(m2.code, guest.id, OPEN0 + 4000)!;
  check("both answered: the question closes at the later answer, for both", hs.phase === "reveal" && gs.phase === "reveal" && hs.reveal?.correct === rightKey(q2[0]));
  check("each sees the other's choice only now, from their own side", hs.reveal?.them.choice === wrongKey(q2[0]) && gs.reveal?.them.choice === rightKey(q2[0]) && hs.reveal?.you.points > 0 && gs.reveal?.you.points === 0);
  check("a friend's wrong answer scores nothing and the host's right one does", hs.totals.you === pointsFor(true, 4000) && hs.totals.them === 0);

  // the friend goes away: nothing more is answered by anyone, the schedule still finishes
  const fullEnd = OPEN0 + 4000 + REVEAL_MS + (DUEL_SIZE - 1) * (QUESTION_MS + REVEAL_MS);
  const fin = stateFor(m2.code, host.id, fullEnd + 10)!;
  check("a player who goes quiet does not stall the match", fin.phase === "done" && fin.final?.outcome === "win" && fin.final.them === 0);
  check("someone who answered fewer than three does not get the day's drill for it", db.select().from(dailyQuests).where(eq(dailyQuests.userId, guest.id)).all().length === 0);

  // ---- waiting, filling and cancelling ----
  const m3 = startDuel(U(guest), track.id, "friend") as { code: string };
  check("a waiting duel can be given a simulated rival instead", "ok" in fillWithBot(m3.code, U(guest)) && duelOf(m3.code)?.status === "live" && !!duelOf(m3.code)?.botSeed);
  check("only its host can do that", "error" in fillWithBot(m3.code, U(host)));
  const m4 = startDuel(U(stranger), track.id, "friend") as { code: string };
  cancelDuel(m4.code, U(host)); check("only the host can cancel", duelOf(m4.code)?.status === "waiting");
  cancelDuel(m4.code, U(stranger)); check("the host can cancel a waiting duel", stateFor(m4.code, stranger.id)?.phase === "canceled");
  const m5 = startDuel(U(stranger), track.id, "friend") as { code: string };
  db.update(duels).set({ createdAt: Math.floor(Date.now() / 1000) - 16 * 60 }).where(eq(duels.code, m5.code)).run();
  check("a duel nobody joins expires after 15 minutes", stateFor(m5.code, stranger.id)?.phase === "canceled" && "error" in joinDuel(m5.code, U(guest)));
  check("junk codes find nothing", ["", "x", "../../etc", "a".repeat(40)].every((c) => duelOf(c) === undefined));
} finally {
  sweep();
}
check("the test's own rows are gone", db.select().from(users).where(like(users.email, "%@duel.check")).all().length === 0);
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);

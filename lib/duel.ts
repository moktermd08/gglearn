import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, duelAnswers, duels, questions, tracks, users } from "@/lib/db";
import { allowed, hit } from "@/lib/rate-limit";
import { openTo } from "@/lib/paths";
import { drillMaxLevel } from "@/lib/drill";
import { enrol } from "@/lib/contests";
import { completeQuest } from "@/lib/stats";
import { shortName } from "@/lib/seasons";
import { topicLabel } from "@/lib/topicName";
import { DUEL_SIZE, QUESTION_MS, acceptsAnswer, botAfterMs, botNameFor, botPlan, phaseAt, pointsFor, resultOf, schedule, type AnswerTimes, type Phase } from "@/lib/duelRules";

/**
 * Live duels, server side. Everything a player is allowed to see is built here, so what the browser receives never contains the right answer to a
 * question that is still open, or what the other player chose before the answer is shown. The browser only asks for the state a few times a second.
 *
 * Questions come from the topic's stored multiple-choice questions, at levels each player has ALREADY passed (the same rule as a drill, so a duel never
 * shows anyone the questions of an exam they have not sat). The host of a duel is "a" in the schedule, the guest (a person or the simulated rival) is "b".
 */
/** A duel nobody has joined is dropped after this long. */
const WAIT_MS = 15 * 60 * 1000;

type Duel = typeof duels.$inferSelect;
type User = { id: number; name: string; audience: "staff" | "customer" };

const newCode = () => randomBytes(6).toString("base64url");
const trackName = (id: number) => topicLabel(db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, id)).get()?.n ?? "");
/** Is this duel still waiting for a second person? */
export const isOpenToJoin = (d: Duel, now = Date.now()) => d.status === "waiting" && now - d.createdAt * 1000 < WAIT_MS;
export const duelOf = (code: string): Duel | undefined => /^[A-Za-z0-9_-]{6,12}$/.test(code) ? db.select().from(duels).where(eq(duels.code, code)).get() : undefined;

/** Five stored multiple-choice questions at or below `maxLevel`, preferring the top two or three levels of that range. Null when the topic has too few. */
export function pickQuestions(trackId: number, maxLevel: number): number[] | null {
  const pool = (lo: number) => db.select({ id: questions.id }).from(questions)
    .where(and(eq(questions.trackId, trackId), eq(questions.status, "active"), eq(questions.type, "mcq"), lte(questions.level, maxLevel), sql`${questions.level} >= ${lo}`)).orderBy(sql`random()`).limit(DUEL_SIZE).all();
  let got = pool(Math.max(1, maxLevel - 2));
  if (got.length < DUEL_SIZE) got = pool(1);
  return got.length >= DUEL_SIZE ? got.map((r) => r.id) : null;
}

// ---- making, joining and starting ----

/** A person starts a duel on a topic: with a friend (waits for them to open the link) or straight away against a simulated rival. */
export function startDuel(host: User, trackId: number, mode: "friend" | "bot"): { code: string } | { error: string } {
  const track = db.select().from(tracks).where(eq(tracks.id, trackId)).get();
  if (!track || !openTo(host.audience, track.audience)) return { error: "Pick a topic from the list." };
  if (!allowed(`duel:${host.id}`, 20)) return { error: "You are starting duels too quickly. Try again in a few minutes." };
  const mine = drillMaxLevel(host.id, trackId);
  if (!pickQuestions(trackId, mine)) return { error: "This topic does not have enough multiple-choice questions for a duel yet." };
  // someone who clicks twice gets their waiting duel back rather than a second one
  const waiting = db.select().from(duels).where(and(eq(duels.hostId, host.id), eq(duels.trackId, trackId), eq(duels.status, "waiting"))).orderBy(sql`${duels.id} desc`).get();
  if (waiting && Date.now() - waiting.createdAt * 1000 < WAIT_MS && mode === "friend") return { code: waiting.code };
  hit(`duel:${host.id}`, 60 * 60 * 1000);
  enrol(db, host.id, trackId, "Live duel");
  const d = db.insert(duels).values({ code: newCode(), trackId, hostId: host.id }).returning().get();
  if (mode === "bot") launch(d, mine, null);
  return { code: d.code };
}

/** Begins the match: picks the questions and starts the countdown. `guestLevel` is null for a simulated rival, which plays at the host's level. */
function launch(d: Duel, hostLevel: number, guestLevel: number | null, guestId: number | null = null) {
  const ids = pickQuestions(d.trackId, Math.min(hostLevel, guestLevel ?? hostLevel));
  if (!ids) return false;
  // with no guest the opponent is a simulated rival, whose whole match comes from this seed
  return !!db.update(duels).set({ status: "live", questionIds: ids, startedAt: Date.now(), guestId, botSeed: guestId === null ? newCode() : null })
    .where(and(eq(duels.id, d.id), eq(duels.status, "waiting"), isNull(duels.guestId))).run().changes;
}

/** A second person opens the link and joins. Only while the duel is still waiting. */
export function joinDuel(code: string, guest: User): { ok: true } | { error: string } {
  const d = duelOf(code);
  if (!d || d.status !== "waiting" || Date.now() - d.createdAt * 1000 > WAIT_MS) return { error: "This duel is not waiting for anyone any more." };
  if (d.hostId === guest.id) return { error: "This is your own duel. Send the link to a friend." };
  const track = db.select().from(tracks).where(eq(tracks.id, d.trackId)).get();
  if (!track || !openTo(guest.audience, track.audience)) return { error: "This topic is not open to your account." };
  enrol(db, guest.id, d.trackId, "Live duel");
  const ok = launch(d, drillMaxLevel(d.hostId, d.trackId), drillMaxLevel(guest.id, d.trackId), guest.id);
  return ok ? { ok: true } : { error: "Someone else just joined, or the topic has too few questions." };
}

/** The host would rather not wait: a simulated rival takes the other seat. */
export function fillWithBot(code: string, host: User): { ok: true } | { error: string } {
  const d = duelOf(code);
  if (!d || d.hostId !== host.id || d.status !== "waiting") return { error: "This duel has already started." };
  return launch(d, drillMaxLevel(host.id, d.trackId), null) ? { ok: true } : { error: "Could not start the duel." };
}

export function cancelDuel(code: string, host: User) {
  const d = duelOf(code);
  if (d && d.hostId === host.id && d.status === "waiting") db.update(duels).set({ status: "canceled" }).where(eq(duels.id, d.id)).run();
}

// ---- what is in play ----

type Answer = typeof duelAnswers.$inferSelect;
const answersOf = (d: Duel) => db.select().from(duelAnswers).where(eq(duelAnswers.duelId, d.id)).orderBy(asc(duelAnswers.qIndex)).all();
const timesOf = (d: Duel, rows: Answer[]): AnswerTimes => {
  const t: AnswerTimes = Array.from({ length: DUEL_SIZE }, () => ({}));
  for (const r of rows) if (r.qIndex >= 0 && r.qIndex < DUEL_SIZE) t[r.qIndex][r.userId === d.hostId ? "a" : "b"] = r.answeredAt;
  return t;
};
const botAfterOf = (d: Duel) => (d.botSeed ? botAfterMs(d.botSeed) : null);

type Q = typeof questions.$inferSelect;
const questionRows = (ids: number[]): Q[] => { const rows = db.select().from(questions).where(inArray(questions.id, ids)).all(); return ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean); };
const publicQuestion = (q: Q) => ({ prompt: q.prompt, code: q.code, options: (q.options ?? []).map((o) => ({ key: o.key, text: o.text })) });

/** What the simulated rival chose and scored on question i: right, or a fixed wrong option. */
function botAnswer(d: Duel, q: Q, i: number) {
  const plan = botPlan(d.botSeed!)[i], opts = (q.options ?? []).map((o) => o.key);
  const right = (q.answer ?? "").toLowerCase();
  const wrong = opts.filter((k) => k.toLowerCase() !== right);
  const choice = plan.correct ? opts.find((k) => k.toLowerCase() === right) ?? opts[0] : wrong[i % Math.max(1, wrong.length)] ?? opts[0];
  const timedOut = plan.afterMs >= QUESTION_MS;
  return { choice, correct: plan.correct && !timedOut, afterMs: plan.afterMs, points: timedOut ? 0 : pointsFor(plan.correct, plan.afterMs), timedOut };
}

export type DuelState = {
  code: string; now: number; topic: string; trackId: number; vsRival: boolean; size: number;
  phase: "waiting" | "canceled" | "countdown" | "question" | "reveal" | "done";
  you: { name: string; host: boolean }; opponent: { name: string; simulated: boolean } | null;
  startsAt?: number; index?: number; openAt?: number; deadline?: number; nextAt?: number | null;
  question?: ReturnType<typeof publicQuestion>;
  mine?: { answered: boolean; choice: string | null };
  reveal?: { correct: string; you: { choice: string | null; points: number }; them: { choice: string | null; points: number } };
  progress: { you: number[]; them: number[] }; // per question: 0 not yet, 1 answered, 2 right, 3 wrong (right/wrong only once shown)
  totals: { you: number; them: number };
  final?: { outcome: "win" | "lose" | "draw"; you: number; them: number; rows: { prompt: string; correct: string; you: string | null; them: string | null; youPoints: number; themPoints: number }[] };
  shareUrl?: string;
};

/** The state one participant may see right now. Returns null for anyone who is not in the duel. */
export function stateFor(code: string, userId: number, now = Date.now()): DuelState | null {
  const d = duelOf(code);
  if (!d) return null;
  const isHost = d.hostId === userId, isGuest = d.guestId === userId;
  if (!isHost && !isGuest) return null;
  const me = db.select({ name: users.name }).from(users).where(eq(users.id, userId)).get();
  const otherId = isHost ? d.guestId : d.hostId;
  const other = otherId ? db.select({ name: users.name }).from(users).where(eq(users.id, otherId)).get() : null;
  const opponent = d.botSeed ? { name: botNameFor(d.botSeed), simulated: true } : other ? { name: shortName(other.name), simulated: false } : null;
  const base = { code: d.code, now, topic: trackName(d.trackId), trackId: d.trackId, vsRival: !!d.botSeed, size: DUEL_SIZE, you: { name: shortName(me?.name ?? "You"), host: isHost }, opponent, progress: { you: Array(DUEL_SIZE).fill(0), them: Array(DUEL_SIZE).fill(0) }, totals: { you: 0, them: 0 } };
  if (d.status === "canceled" || (d.status === "waiting" && now - d.createdAt * 1000 > WAIT_MS)) return { ...base, phase: "canceled" };
  if (d.status === "waiting" || !d.startedAt || !d.questionIds) return { ...base, phase: "waiting" };

  const rows = answersOf(d), times = timesOf(d, rows), botAfter = botAfterOf(d);
  const phase: Phase = phaseAt(d.startedAt, times, now, DUEL_SIZE, botAfter);
  const sched = schedule(d.startedAt, times, DUEL_SIZE, botAfter);
  const qs = questionRows(d.questionIds);
  const mineRows = new Map(rows.filter((r) => r.userId === userId).map((r) => [r.qIndex, r]));
  const theirRows = new Map(rows.filter((r) => r.userId !== userId).map((r) => [r.qIndex, r]));
  const theirs = (i: number) => d.botSeed ? botAnswer(d, qs[i], i) : theirRows.get(i) ? { choice: theirRows.get(i)!.choice, correct: theirRows.get(i)!.correct, points: theirRows.get(i)!.points, afterMs: theirRows.get(i)!.afterMs, timedOut: false } : null;
  const closed = (i: number) => phase.phase === "done" || (phase.phase !== "countdown" && (phase.phase === "reveal" ? i <= phase.index : i < phase.index));
  const answeredNow = (i: number, who: "you" | "them") => {
    if (who === "you") return mineRows.has(i);
    if (d.botSeed) { const a = botAnswer(d, qs[i], i); return !a.timedOut && now >= sched.opens[i] + a.afterMs; }
    return theirRows.has(i);
  };
  const progress = { you: Array(DUEL_SIZE).fill(0) as number[], them: Array(DUEL_SIZE).fill(0) as number[] };
  const totals = { you: 0, them: 0 };
  for (let i = 0; i < DUEL_SIZE; i++) {
    const mine = mineRows.get(i), th = theirs(i);
    if (closed(i)) {
      progress.you[i] = mine ? (mine.correct ? 2 : 3) : 3; progress.them[i] = th ? (th.correct ? 2 : 3) : 3;
      totals.you += mine?.points ?? 0; totals.them += th?.points ?? 0;
    } else { progress.you[i] = answeredNow(i, "you") ? 1 : 0; progress.them[i] = answeredNow(i, "them") ? 1 : 0; }
  }
  const out: DuelState = { ...base, phase: phase.phase === "done" ? "done" : phase.phase, progress, totals };

  if (phase.phase === "countdown") return { ...out, startsAt: phase.startsAt };
  if (phase.phase === "question") {
    const mine = mineRows.get(phase.index);
    return { ...out, index: phase.index, openAt: phase.openAt, deadline: phase.deadline, question: publicQuestion(qs[phase.index]), mine: { answered: !!mine, choice: mine?.choice ?? null } };
  }
  if (phase.phase === "reveal") {
    const mine = mineRows.get(phase.index), th = theirs(phase.index);
    return { ...out, index: phase.index, openAt: phase.openAt, nextAt: phase.nextAt, question: publicQuestion(qs[phase.index]),
      reveal: { correct: qs[phase.index].answer ?? "", you: { choice: mine?.choice ?? null, points: mine?.points ?? 0 }, them: { choice: th?.choice ?? null, points: th?.points ?? 0 } } };
  }
  // finished: write the result once, then show every question with both players' answers
  const result = settle(d, rows, qs, userId);
  return { ...out, final: { ...result, rows: qs.map((q, i) => { const m = mineRows.get(i), t = theirs(i); return { prompt: q.prompt, correct: q.answer ?? "", you: m?.choice ?? null, them: t?.choice ?? null, youPoints: m?.points ?? 0, themPoints: t?.points ?? 0 }; }) } };
}

/** Writes the final scores once and gives each person who really played the day's drill quest. Safe to call again: only the first call changes anything. */
function settle(d: Duel, rows: Answer[], qs: Q[], viewer: number) {
  const host = rows.filter((r) => r.userId === d.hostId).reduce((s, r) => s + r.points, 0);
  const guest = d.botSeed ? qs.reduce((s, q, i) => s + botAnswer(d, q, i).points, 0) : rows.filter((r) => r.userId !== d.hostId).reduce((s, r) => s + r.points, 0);
  if (d.status !== "done") {
    const fin = db.update(duels).set({ status: "done", finishedAt: Math.floor(Date.now() / 1000), hostPoints: host, guestPoints: guest }).where(and(eq(duels.id, d.id), eq(duels.status, "live"))).run();
    if (fin.changes) for (const id of [d.hostId, d.guestId]) {
      if (!id) continue;
      if (rows.filter((r) => r.userId === id).length >= 3) completeQuest(id, d.trackId, "drill"); // answered most of it: counts as the day's quick drill, so it keeps a streak
    }
  }
  const you = viewer === d.hostId ? host : guest, them = viewer === d.hostId ? guest : host;
  return resultOf(you, them);
}

// ---- answering ----

/** Takes one answer, if it arrives while that question is the open one and the person has not answered it. The clock is the server's. */
export function submitAnswer(code: string, userId: number, index: number, choice: string, now = Date.now()): { ok: true } | { error: string } {
  const d = duelOf(code);
  if (!d || d.status !== "live" || !d.startedAt || !d.questionIds) return { error: "This duel is not running." };
  if (d.hostId !== userId && d.guestId !== userId) return { error: "You are not in this duel." };
  if (!Number.isInteger(index) || index < 0 || index >= DUEL_SIZE || typeof choice !== "string" || choice.length > 10) return { error: "That answer was not understood." };
  const rows = answersOf(d), times = timesOf(d, rows), botAfter = botAfterOf(d);
  if (!acceptsAnswer(d.startedAt, times, now, index, DUEL_SIZE, botAfter)) return { error: "That question is closed." };
  const q = questionRows(d.questionIds)[index];
  if (!q || !(q.options ?? []).some((o) => o.key === choice)) return { error: "That is not one of the options." };
  const opened = schedule(d.startedAt, times, DUEL_SIZE, botAfter).opens[index], afterMs = Math.max(0, now - opened);
  const correct = (q.answer ?? "").toLowerCase() === choice.toLowerCase();
  const added = db.insert(duelAnswers).values({ duelId: d.id, userId, qIndex: index, choice, correct, afterMs, points: pointsFor(correct, afterMs), answeredAt: now }).onConflictDoNothing().run();
  return added.changes ? { ok: true } : { error: "You have already answered this one." };
}

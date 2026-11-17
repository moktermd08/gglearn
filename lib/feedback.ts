import { and, desc, eq, isNull } from "drizzle-orm";
import { answerNotes, answers, cvComments, db, questions, runs, tracks, users } from "@/lib/db";
import type { NoteKind } from "@/lib/questionNoteText";

/**
 * Everything said to or by one person, from every place feedback can be left, as one flat list that the /feedback page groups.
 * Two sources today: notes under exam answers (lib/questionNotes.ts) and comments on a CV (lib/cv/review.ts).
 * Read-only: acting on an item (got it, reply, done) still goes through each source's own actions.
 */
export type FeedbackStatus = "new" | "read" | "replied" | "open" | "done" | "dismissed";
export type FeedbackItem = {
  source: "exam" | "cv";
  id: number; // the note or comment id, in its own table
  kind: NoteKind;
  body: string;
  /** For "received": who wrote it. For "given": who it was left for. */
  person: string;
  createdAt: number;
  status: FeedbackStatus;
  reply: string;
  groupKey: string;
  groupTitle: string;
  groupSub: string;
  /** What it is about: the question, or the CV section. */
  about: string;
  href: string;
  /** exam only: whether the learner has pressed "Got it" / replied. */
  acked?: boolean;
  replied?: boolean;
  /** cv only */
  section?: string;
};

export type FeedbackGroup = { key: string; title: string; sub: string; source: "exam" | "cv"; items: FeedbackItem[]; newest: number; needsAttention: number };

const course = (name: string) => name.replace(/^\d+\.\s*/, "");
const SECTION_LABEL = (s: string) => (s === "assessed" ? "Assessed skills" : s.charAt(0).toUpperCase() + s.slice(1));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function examItems(side: "received" | "given", me: number): FeedbackItem[] {
  const mine = side === "received" ? eq(answerNotes.learnerId, me) : eq(answerNotes.authorId, me);
  const otherId = side === "received" ? answerNotes.authorId : answerNotes.learnerId;
  return db.select({ n: answerNotes, who: users.name, q: questions, r: runs, t: tracks }).from(answerNotes)
    .innerJoin(users, eq(users.id, otherId)).innerJoin(answers, eq(answers.id, answerNotes.answerId)).innerJoin(questions, eq(questions.id, answers.questionId))
    .innerJoin(runs, eq(runs.id, answerNotes.runId)).innerJoin(tracks, eq(tracks.id, runs.trackId))
    .where(and(mine, isNull(answerNotes.deletedAt))).orderBy(desc(answerNotes.id)).limit(300).all()
    .map(({ n, who, q, r, t }) => ({
      source: "exam" as const, id: n.id, kind: n.kind, body: n.body, person: who, createdAt: n.createdAt,
      status: n.repliedAt ? "replied" as const : n.ackAt ? "read" as const : "new" as const,
      reply: n.reply, groupKey: `exam:${r.id}`, groupTitle: course(t.name),
      groupSub: `Exam, level ${r.level} · ${new Date((r.finishedAt ?? r.startedAt) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      about: clip(q.prompt, 220),
      href: side === "received" ? `/run/${r.id}#q${n.answerId}` : `/admin/people/${n.learnerId}#q${n.answerId}`,
      acked: !!n.ackAt, replied: !!n.repliedAt,
    }));
}

function cvItems(side: "received" | "given", me: number): FeedbackItem[] {
  const mine = side === "received" ? eq(cvComments.userId, me) : eq(cvComments.reviewerId, me);
  const otherId = side === "received" ? cvComments.reviewerId : cvComments.userId;
  return db.select({ c: cvComments, who: users.name }).from(cvComments).innerJoin(users, eq(users.id, otherId))
    .where(and(mine, isNull(cvComments.deletedAt))).orderBy(desc(cvComments.id)).limit(300).all()
    .map(({ c, who }) => ({
      source: "cv" as const, id: c.id, kind: c.kind, body: c.body, person: who, createdAt: c.createdAt,
      status: c.status === "open" ? (c.repliedAt ? "replied" as const : "open" as const) : c.status,
      reply: c.reply, groupKey: side === "received" ? "cv" : `cv:${c.userId}`,
      groupTitle: side === "received" ? "Your CV" : `${who}'s CV`,
      groupSub: "CV draft", about: SECTION_LABEL(c.section),
      href: side === "received" ? `/profile/cv#feedback` : `/cv-review/${c.userId}`,
      section: c.section,
    }));
}

export const feedbackItems = (me: number, side: "received" | "given"): FeedbackItem[] =>
  [...examItems(side, me), ...cvItems(side, me)].sort((a, b) => b.createdAt - a.createdAt);

/** Does this item still wait for the person it was left for? (A new exam note, or an open CV comment.) */
export const needsAttention = (i: FeedbackItem) => i.status === "new" || i.status === "open";

export function groupFeedback(items: FeedbackItem[]): FeedbackGroup[] {
  const by = new Map<string, FeedbackGroup>();
  for (const i of items) {
    const g = by.get(i.groupKey) ?? { key: i.groupKey, title: i.groupTitle, sub: i.groupSub, source: i.source, items: [], newest: 0, needsAttention: 0 };
    g.items.push(i);
    g.newest = Math.max(g.newest, i.createdAt);
    if (needsAttention(i)) g.needsAttention += 1;
    by.set(i.groupKey, g);
  }
  return [...by.values()].sort((a, b) => b.needsAttention - a.needsAttention || b.newest - a.newest);
}

/** How many things wait for this person to read: the badge on the nav link. */
export const feedbackWaiting = (me: number) => feedbackItems(me, "received").filter(needsAttention).length;

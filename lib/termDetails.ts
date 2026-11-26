import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, termExamAnswers, termExams, termProgress, terms } from "@/lib/db";
import { allBanks } from "@/lib/terms";
import { listOf, type StudyCard } from "@/lib/termStudy";
import { studyState, type StudyState } from "@/lib/termsCore";

/** What a study card shows around a term: where it sits among its neighbours, what it is easy to mix up with, how well the person remembers it, and how they have done when tested. */
export type TermDetail = {
  bank: string;
  /** the terms of the same group, this one included, with how far the person has got with each */
  group: { id: number; term: string; tier: number; state: StudyState }[];
  /** look-alikes, with their meanings, so the difference can be seen side by side */
  compare: { id: number; term: string; meaning: string; tier: number }[];
  memory: { box: number; seen: number; lapses: number; dueInDays: number | null };
  /** the latest finished test answers for this term, oldest first */
  history: { right: boolean; at: number }[];
};
export type RichCard = StudyCard & { detail: TermDetail };

const MAX_COMPARE = 3, MAX_HISTORY = 8;

export function withDetails(userId: number, cards: StudyCard[], nowSec = Math.floor(Date.now() / 1000)): RichCard[] {
  if (!cards.length) return [];
  // only what this person may see: shared terms and their own
  const visible = db.select().from(terms).where(eq(terms.status, "active")).all().filter((t) => t.ownerUserId == null || t.ownerUserId === userId);
  const byId = new Map(visible.map((t) => [t.id, t]));
  const bankName = new Map(allBanks().map((b) => [b.id, b.name]));
  const progress = new Map(db.select().from(termProgress).where(eq(termProgress.userId, userId)).all().map((p) => [p.termId, p]));
  const answers = db.select({ termId: termExamAnswers.termId, right: termExamAnswers.right, at: termExams.finishedAt }).from(termExamAnswers)
    .innerJoin(termExams, eq(termExams.id, termExamAnswers.examId))
    .where(and(eq(termExams.userId, userId), isNotNull(termExams.finishedAt), inArray(termExamAnswers.termId, cards.map((c) => c.id)))).orderBy(asc(termExamAnswers.id)).all();
  const name = (s: string) => s.trim().toLowerCase();

  return cards.map((card) => {
    const row = byId.get(card.id);
    const same = visible.filter((t) => row && t.bankId === row.bankId && t.groupName === row.groupName);
    const bankMates = visible.filter((t) => row && t.bankId === row.bankId && t.id !== card.id);
    const wanted = new Set(card.similar.map(name));
    const named = [...wanted].map((n) => bankMates.find((t) => name(t.term) === n) ?? visible.find((t) => t.id !== card.id && name(t.term) === n)).filter((t) => t !== undefined);
    const namingUs = bankMates.filter((t) => listOf(t.similar).some((s) => name(s) === name(card.term)));
    const compare = [...new Map([...named, ...namingUs].map((t) => [t.id, t])).values()].slice(0, MAX_COMPARE);
    const p = progress.get(card.id);
    return {
      ...card,
      detail: {
        bank: row?.bankId != null ? (bankName.get(row.bankId) ?? "") : "My own terms",
        group: same.sort((a, b) => a.tier - b.tier || a.sortOrder - b.sortOrder || a.id - b.id).map((t) => ({ id: t.id, term: t.term, tier: t.tier, state: studyState(progress.get(t.id)?.box) })),
        compare: compare.map((t) => ({ id: t.id, term: t.term, meaning: t.meaning, tier: t.tier })),
        memory: { box: p?.box ?? 0, seen: p?.seen ?? 0, lapses: p?.lapses ?? 0, dueInDays: p ? Math.max(0, Math.ceil((p.dueAt - nowSec) / 86400)) : null },
        history: answers.filter((a) => a.termId === card.id).slice(-MAX_HISTORY).map((a) => ({ right: !!a.right, at: a.at! })),
      },
    };
  });
}

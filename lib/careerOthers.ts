import { and, eq, isNull } from "drizzle-orm";
import { answerNotes, answers, cvComments, cvEndorsements, db, promotions, runs, type users } from "@/lib/db";
import type { Diagnosis, FamilyFit } from "@/lib/careerDoctor";

type Person = typeof users.$inferSelect;

/**
 * What other people have said or decided about someone, kept apart from fit and momentum on purpose: those are what the person's own results show,
 * this is what a manager, mentor or reviewer did. Only structured, attributable signals are read, and no free text is interpreted:
 *  - praise left under an exam answer, which belongs to that exam's subject and so to a field;
 *  - a promotion a manager decided, which belongs to the field of that role;
 *  - references a manager or mentor wrote and the person approved, and praise on the CV, which belong to the person and not to one field.
 * Nothing is stored. Counts are of different people, so one reviewer leaving ten notes is still one voice.
 */
export const WINDOW_DAYS = 365, PERIOD_DAYS = 30;
const DAY = 86400;

export type Praise = { trackId: number; authorId: number; at: number };
export type Promotion = { role: string; at: number };
export type FamilyOthers = {
  /** praise notes in the last year */ notes: number;
  /** different people who left them */ people: number;
  /** distinct 30-day periods with any, so a burst on one day reads as one */ periods: number;
  lastPraiseAt: number | null;
  /** promotions into a role of this field, ever */ promotions: number;
  lastPromotionAt: number | null;
};
export type Others = { byFamily: Map<string, FamilyOthers>; references: { manager: number; mentor: number }; cvPraise: { comments: number; people: number } };

/** The family part, pure: which praise and which promotions belong to which field. A field owns the tracks its roles ask for, and its roles by key or name. */
export function rollup(fields: { family: string; tracks: Set<number>; roles: Set<string> }[], praise: Praise[], promos: Promotion[], at: number): Map<string, FamilyOthers> {
  const from = at - WINDOW_DAYS * DAY, out = new Map<string, FamilyOthers>();
  for (const f of fields) {
    const p = praise.filter((x) => f.tracks.has(x.trackId) && x.at >= from && x.at <= at);
    const pr = promos.filter((x) => f.roles.has(x.role.trim().toLowerCase()) && x.at <= at);
    out.set(f.family, {
      notes: p.length,
      people: new Set(p.map((x) => x.authorId)).size,
      periods: new Set(p.map((x) => Math.floor((at - x.at) / (PERIOD_DAYS * DAY)))).size,
      lastPraiseAt: p.reduce<number | null>((m, x) => (m === null || x.at > m ? x.at : m), null),
      promotions: pr.length,
      lastPromotionAt: pr.reduce<number | null>((m, x) => (m === null || x.at > m ? x.at : m), null),
    });
  }
  return out;
}

const fieldOf = (f: FamilyFit) => ({
  family: f.family,
  tracks: new Set(f.roles.flatMap((r) => r.areas.map((a) => a.trackId))),
  roles: new Set(f.roles.flatMap((r) => [r.role.toLowerCase(), r.name.toLowerCase()])),
});

/** Everything others have said about this person, by field, plus what belongs to no single field. Reads only the person's own records. */
export function othersFor(person: Person, d: Diagnosis, at = Math.floor(Date.now() / 1000)): Others {
  const praise: Praise[] = db.select({ trackId: runs.trackId, authorId: answerNotes.authorId, at: answerNotes.createdAt }).from(answerNotes)
    .innerJoin(answers, eq(answers.id, answerNotes.answerId)).innerJoin(runs, eq(runs.id, answerNotes.runId))
    .where(and(eq(answerNotes.learnerId, person.id), eq(answerNotes.kind, "praise"), isNull(answerNotes.deletedAt))).all();
  const promos: Promotion[] = db.select({ role: promotions.jobRole, at: promotions.createdAt }).from(promotions).where(eq(promotions.userId, person.id)).all();
  const refs = db.select({ r: cvEndorsements.relationship }).from(cvEndorsements).where(and(eq(cvEndorsements.userId, person.id), eq(cvEndorsements.status, "approved"))).all();
  const cv = db.select({ who: cvComments.reviewerId }).from(cvComments).where(and(eq(cvComments.userId, person.id), eq(cvComments.kind, "praise"), isNull(cvComments.deletedAt))).all();
  return {
    byFamily: rollup(d.families.map(fieldOf), praise, promos, at),
    references: { manager: refs.filter((x) => x.r === "manager").length, mentor: refs.filter((x) => x.r === "mentor").length },
    cvPraise: { comments: cv.length, people: new Set(cv.map((x) => x.who)).size },
  };
}

export const hasOthers = (o: FamilyOthers) => o.notes > 0 || o.promotions > 0;

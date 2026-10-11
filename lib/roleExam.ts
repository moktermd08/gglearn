import { and, between, eq, sql } from "drizzle-orm";
import { answers, db, questions, roleExamAnswers, roleExams, runs, users } from "@/lib/db";
import { DOMAIN_KEYS, apportion, domainOf, type Domain, type Mix } from "@/lib/blueprint";
import { careerFor } from "@/lib/careers";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { drawDynamic } from "@/lib/dynamic/store";
import { grade } from "@/lib/grading";
import { PASS_MARK } from "@/lib/levels";
import { LEVEL_SPREAD, ROLE_EXAM_MIN, ROLE_EXAM_SIZE, planDomains } from "@/lib/roleCheck";

export { ROLE_EXAM_MIN, ROLE_EXAM_SIZE };

type Person = typeof users.$inferSelect;
type CatalogTrack = ReturnType<typeof catalog>[number];

const FRESH_SHARE = 0.7;

export type Source = { track: CatalogTrack; level: number; domain: Domain };
export type RoleExamPlan = {
  role: string;
  /** position of the target level in the ladder (1-based): what the question mix is computed from */
  rung: number;
  /** the target level's own number: what a role check is stored and matched by, so editing the ladder cannot shift it */
  level: number;
  rungs: number;
  title: string;
  /** what the role's blueprint asks for at this rung, out of ROLE_EXAM_SIZE */
  wanted: Mix;
  /** what can actually be drawn: a domain with no examinable track gives its share to the others */
  planned: Mix;
  sources: Source[];
};

/**
 * What a person's role check would cover: the rung they are working towards (or their current one at the top of the ladder),
 * every track the ladder asks for up to that rung that they can see and take, and the number of questions per domain.
 */
export function roleExamPlan(person: Person, cat = catalog()): RoleExamPlan | null {
  const c = careerFor(person, cat);
  if (!c) return null;
  const target = c.next ?? c.current;
  const rung = c.ladder.findIndex((r) => r.level === target.level) + 1;
  const scopes = scopesOf(person.id);

  const need = new Map<number, Source>(); // highest level the ladder asks of each track so far
  for (const r of c.ladder) {
    if (r.level > target.level) break;
    for (const s of r.steps) {
      if (!s.countable || !inScope(s.track, person.audience, scopes)) continue;
      const cur = need.get(s.track.id);
      if (!cur || s.need > cur.level) need.set(s.track.id, { track: s.track, level: s.need, domain: domainOf(s.track.slug, s.track.kind) });
    }
  }
  const sources = [...need.values()];
  if (!sources.length) return null;

  const { wanted, planned } = planDomains(c.role, rung, c.ladder.length, sources.map((s) => ({ trackId: s.track.id, slug: s.track.slug, domain: s.domain, level: s.level })));
  return { role: c.role, rung, level: target.level, rungs: c.ladder.length, title: target.title, wanted, planned, sources };
}

/** `k` question ids from one track around one level: mostly freshly generated where the track has generators, the rest stored. */
function drawFrom(userId: number, s: Source, k: number, taken: Set<number>): number[] {
  if (k <= 0) return [];
  const fresh = drawDynamic(userId, s.track, s.level, Math.ceil(k * FRESH_SHARE)).filter((id) => !taken.has(id));
  const stored = db.select({ id: questions.id }).from(questions)
    .where(and(eq(questions.trackId, s.track.id), eq(questions.status, "active"), between(questions.level, Math.max(1, s.level - LEVEL_SPREAD), s.level)))
    .orderBy(sql`
      (select count(*) from ${answers} a join ${runs} r on r.id = a.run_id
        where a.question_id = ${questions.id} and r.user_id = ${userId} and a.score >= 0.8) asc, random()`)
    .limit(k + taken.size + fresh.length).all().map((q) => q.id).filter((id) => !taken.has(id) && !fresh.includes(id));
  const out = [...fresh, ...stored].slice(0, k);
  if (out.length < k) out.push(...drawDynamic(userId, s.track, s.level, k - out.length).filter((id) => !taken.has(id) && !out.includes(id)));
  return out.slice(0, k);
}

/** Draws the questions for a plan, domain by domain, splitting each domain's share evenly over its tracks. */
export function drawRoleExam(userId: number, plan: RoleExamPlan): { id: number; domain: Domain }[] {
  const taken = new Set<number>(), out: { id: number; domain: Domain }[] = [];
  for (const d of DOMAIN_KEYS) {
    const src = plan.sources.filter((s) => s.domain === d);
    if (!src.length || !plan.planned[d]) continue;
    const share = apportion(plan.planned[d], src.map(() => 1));
    let short = 0;
    src.forEach((s, i) => {
      const ids = drawFrom(userId, s, share[i] + short, taken);
      short = share[i] + short - ids.length; // what this track could not give, the next one tries to
      for (const id of ids) { taken.add(id); out.push({ id, domain: d }); }
    });
    // a shortfall only carries forward, so a short last track leaves a gap: let every track in the domain try again for what is missing
    let missing = plan.planned[d] - out.filter((x) => x.domain === d).length;
    for (const s of src) {
      if (missing <= 0) break;
      for (const id of drawFrom(userId, s, missing, taken)) { taken.add(id); out.push({ id, domain: d }); missing--; }
    }
  }
  return out;
}

/** Creates a role check and its questions. Null when there is nothing fair to ask. */
export function createRoleExam(person: Person): number | null {
  const plan = roleExamPlan(person);
  if (!plan) return null;
  const drawn = drawRoleExam(person.id, plan);
  if (drawn.length < ROLE_EXAM_MIN) return null;
  const actual = Object.fromEntries(DOMAIN_KEYS.map((d) => [d, drawn.filter((x) => x.domain === d).length]));
  const exam = db.insert(roleExams).values({ userId: person.id, role: plan.role, rung: plan.level, plan: JSON.stringify(actual) }).returning().get();
  db.insert(roleExamAnswers).values(drawn.sort(() => Math.random() - 0.5).map((x) => ({ examId: exam.id, questionId: x.id, domain: x.domain }))).run();
  return exam.id;
}

export type DomainResult = { domain: Domain; asked: number; score: number };

/** Marks the exam from posted answers (`q<id>`), stores per-question scores and the overall result. False if it was already finished. */
export async function gradeRoleExam(examId: number, answerFor: (questionId: number) => string): Promise<boolean> {
  const rows = db.select({ a: roleExamAnswers, q: questions }).from(roleExamAnswers)
    .innerJoin(questions, eq(questions.id, roleExamAnswers.questionId)).where(eq(roleExamAnswers.examId, examId)).all();
  let earned = 0, possible = 0;
  for (const { a, q } of rows) {
    const response = answerFor(q.id).slice(0, 4000);
    const g = await grade(q, response);
    db.update(roleExamAnswers).set({ response, score: g.score, feedback: g.feedback }).where(eq(roleExamAnswers.id, a.id)).run();
    earned += g.score * q.weight;
    possible += q.weight;
  }
  const score = possible ? earned / possible : 0;
  const done = db.update(roleExams).set({ score, passed: score >= PASS_MARK, finishedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(roleExams.id, examId), sql`${roleExams.finishedAt} is null`)).run();
  return done.changes > 0;
}

/** Score per domain, weighted by question weight, for a finished exam. */
export function domainResults(examId: number): DomainResult[] {
  const rows = db.select({ a: roleExamAnswers, w: questions.weight }).from(roleExamAnswers)
    .innerJoin(questions, eq(questions.id, roleExamAnswers.questionId)).where(eq(roleExamAnswers.examId, examId)).all();
  return DOMAIN_KEYS.flatMap((domain) => {
    const mine = rows.filter((r) => r.a.domain === domain), w = mine.reduce((a, r) => a + r.w, 0);
    return mine.length ? [{ domain, asked: mine.length, score: w ? mine.reduce((a, r) => a + r.a.score * r.w, 0) / w : 0 }] : [];
  });
}

/** The person's unfinished role check that still matches where they are (same role, same target level), if any. An older one is left behind. */
export function openRoleExam(userId: number, plan: Pick<RoleExamPlan, "role" | "level">) {
  return db.select().from(roleExams)
    .where(and(eq(roleExams.userId, userId), eq(roleExams.role, plan.role), eq(roleExams.rung, plan.level), sql`${roleExams.finishedAt} is null`))
    .orderBy(sql`${roleExams.id} desc`).get();
}

export const latestFinishedRoleExam = (userId: number) =>
  db.select().from(roleExams).where(and(eq(roleExams.userId, userId), sql`${roleExams.finishedAt} is not null`)).orderBy(sql`${roleExams.id} desc`).get();

export const latestRoleExam = (userId: number) =>
  db.select().from(roleExams).where(eq(roleExams.userId, userId)).orderBy(sql`${roleExams.id} desc`).get();

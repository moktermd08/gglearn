import { and, asc, eq, isNotNull } from "drizzle-orm";
import { careerGoals, db, termExams, users } from "@/lib/db";
import { canReach } from "@/lib/journey";
import { goalNeed } from "@/lib/terms";
import { termUrl } from "@/lib/termUrls";
import { TERM_PASS, KNOWN_BOX, rankName } from "@/lib/termsCore";
import { myStudyRoles, placementStages, progressFor, roleLabel, roleList, saveStudyRole, EVERYONE, type RoleList } from "@/lib/termStudy";

/**
 * The path a person walks: choose a role and a level to aim at, find where they stand one rank at a time, then study what they do not know and sit the next rank, until they
 * reach the level they aim at. This file holds the rules for where someone is on that path and what to do next; the pages only show it.
 */

export type StageResult = { rank: number; state: "passed" | "failed" | "todo"; score: number | null; examId: number | null };
export type Placement = {
  stages: StageResult[];
  /** the highest rank passed in an unbroken run from the first */
  placed: number;
  /** the next rank to be asked, or null when the climb has stopped or finished */
  next: number | null;
  /** the climb stopped at a failed rank, or passed every rank */
  done: boolean;
  started: boolean;
};

/** Where someone stands on a list. Each rank is asked on its own (ten terms, asked as deeply as that rank); passing opens the next, failing stops the climb at the last one passed. The latest try at a rank counts. */
export function placementState(userId: number, list: RoleList): Placement {
  const exams = db.select().from(termExams)
    .where(and(eq(termExams.userId, userId), eq(termExams.kind, "placement"), eq(termExams.role, list.role), eq(termExams.level, list.level), isNotNull(termExams.finishedAt)))
    .orderBy(asc(termExams.id)).all();
  const latest = new Map<number, (typeof exams)[number]>();
  for (const e of exams) latest.set(e.claimedTier, e);
  const stages: StageResult[] = placementStages(list).map((rank) => {
    const e = latest.get(rank);
    return { rank, state: !e ? "todo" : (e.score ?? 0) >= TERM_PASS ? "passed" : "failed", score: e?.score ?? null, examId: e?.id ?? null };
  });
  let placed = 0, next: number | null = null, done = false;
  for (const s of stages) {
    if (s.state === "passed") { placed = s.rank; continue; }
    if (s.state === "failed") { done = true; break; }
    next = s.rank;
    break;
  }
  if (next == null && !done) done = true; // every rank passed
  return { stages, placed, next, done, started: exams.length > 0 };
}

export type Step =
  | { kind: "start" }
  | ({ kind: "place" | "continue" | "climb" | "there" } & StepBody);
export type StepBody = {
  role: string; roleLabel: string; level: number; title: string;
  /** the highest rank passed so far, and the rank the goal (or the whole list) asks for */
  placed: number; target: number;
  /** the rank to ask next, when there is one */
  stage: number | null;
  /** terms at that rank still to be learned */
  toLearn: number;
  studyHref: string;
  listHref: string;
  placement: Placement;
  /** the target is the person's own career goal, not just the top of the list */
  hasGoal: boolean;
};

const goalRoleList = (userId: number) => {
  const g = goalNeed(userId);
  return g ? roleList(g.role, g.level) : null;
};

/**
 * What this person should do next, from where they stand. The same answer is shown on the Terms page, the dashboard, the goal page and after a check.
 * `about` names the list in hand (the one a check was on), so a result talks about that list and not about another one the person is also learning.
 */
export function nextStep(userId: number, about?: { role: string; level: number }): Step {
  const goal = goalNeed(userId);
  const chosen = myStudyRoles(userId);
  const pick = chosen.find((r) => goal && r.role === goal.role) ?? chosen[chosen.length - 1];
  const list = (about && roleList(about.role, about.level)) || (pick ? roleList(pick.role, pick.level) : goalRoleList(userId));
  if (!list) return { kind: "start" };
  const placement = placementState(userId, list);
  const target = goal && goal.role === list.role ? Math.min(goal.rank, list.ceiling) : list.ceiling;
  const stage = placement.next ?? placementStages(list).find((r) => r > placement.placed) ?? null;
  const prog = progressFor(userId, list.terms.map((t) => t.id));
  const toLearn = stage == null ? 0 : list.terms.filter((t) => t.tier === stage && (prog.get(t.id)?.box ?? 0) < KNOWN_BOX).length;
  const body: StepBody = {
    role: list.role, roleLabel: roleLabel(list.role), level: list.level, title: list.title, placed: placement.placed, target, stage, toLearn,
    studyHref: termUrl("study", list.role, list.level), listHref: termUrl("role", list.role, list.level), placement, hasGoal: !!goal && goal.role === list.role,
  };
  if (!placement.started) return { kind: "place", ...body };
  if (placement.placed >= target || stage == null) return { kind: "there", ...body };
  if (!placement.done) return { kind: "continue", ...body };
  return { kind: "climb", ...body };
}

export const stepRank = (n: number | null) => (n ? rankName(n) : "the basics");

/**
 * How the start screen's choices become a saved role and an optional goal. Any role can be learned; a career goal is only set when the person has none and their
 * career path leads to that role and level (the same rule the goal page uses), because a goal the path cannot reach breaks the goal page.
 */
export function beginJourney(person: typeof users.$inferSelect, role: string, level: number, setGoal: boolean): { error: string } | { ok: true } {
  const userId = person.id;
  const r = saveStudyRole(userId, role, level);
  if ("error" in r) return r;
  const key = role.trim().toLowerCase();
  if (setGoal && key !== EVERYONE && canReach(person, key, level) && !db.select({ id: careerGoals.id }).from(careerGoals).where(eq(careerGoals.userId, userId)).get()) {
    db.insert(careerGoals).values({ userId, targetRole: key, targetLevel: level, targetDate: Math.floor(Date.now() / 1000) + 365 * 86400 }).run();
  }
  return { ok: true };
}

import { type users } from "@/lib/db";
import { careerFor, ladderFor } from "@/lib/careers";
import { pathFor, roleLabel } from "@/lib/journey";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { levelsEarned } from "@/lib/progress";
import { type Target, type TargetArea, type TargetStage, targetBySlug } from "@/lib/route";
import { type Standing, type RungEvidence, careerSlug, parseCareerSlug, standing, verifiedLevel } from "@/lib/standing";

type Person = typeof users.$inferSelect;

/**
 * A route target for a career goal: every track the person still has to pass on the way from their level to `role` at `level`,
 * with the level the highest rung on the way asks of it. Stages are the rungs, so the dated plan climbs the ladder in order.
 * This lets the route check, the plan and the tasks work for any goal on a ladder, not only the listed jobs.
 */
export function careerTarget(person: Person, role: string, level: number, cat = catalog()): Target | null {
  const nodes = pathFor(person, role, level, cat);
  if (!nodes || nodes.length < 2) return null;
  const scopes = scopesOf(person.id);
  const areas = new Map<number, TargetArea>();
  const stages: TargetStage[] = [];
  let last: { title: string; summary: string } | null = null;
  nodes.slice(1).forEach((n, i) => {
    const rung = ladderFor(n.role, cat).find((r) => r.level === n.level);
    if (!rung) return;
    last = rung;
    stages.push({ n: i + 1, label: rung.title, blurb: rung.summary });
    for (const s of rung.steps) {
      // a step whose questions do not reach the level yet cannot be passed, and a company's own tracks only count for the people who can see them
      if (!s.countable || !inScope(s.track, person.audience, scopes)) continue;
      const have = areas.get(s.track.id);
      if (have) { have.target = Math.max(have.target, s.need); continue; }
      areas.set(s.track.id, { key: s.track.slug, label: s.track.name, why: `Needed for ${rung.title}.`, trackSlug: s.track.slug, target: s.need, stage: i + 1, priority: areas.size + 1 });
    }
  });
  if (!last || !areas.size) return null;
  const { title, summary } = last as { title: string; summary: string };
  return { slug: careerSlug(role, level), title: title.toLowerCase().includes(roleLabel(role).toLowerCase()) ? title : `${title}, ${roleLabel(role)}`, short: title, summary, areas: [...areas.values()], stages };
}

/** A listed job by its slug, or a career goal named by role and level. */
export function targetFor(slug: string, person: Person): Target | null {
  const listed = targetBySlug(slug);
  if (listed) return listed;
  const c = parseCareerSlug(slug);
  return c ? careerTarget(person, c.role, c.level) : null;
}

export type CareerStanding = Standing & { role: string; titles: Map<number, string> };

/** The title a manager gave (or the bottom rung) next to what real exams prove, for this person's own ladder. Null when they have no ladder. */
export function standingFor(person: Person, cat = catalog()): CareerStanding | null {
  const c = careerFor(person, cat);
  if (!c) return null;
  const scopes = scopesOf(person.id);
  const rungs: RungEvidence[] = c.ladder.map((r) => {
    const steps = r.steps.filter((s) => s.countable && inScope(s.track, person.audience, scopes));
    return { level: r.level, counted: steps.length, met: steps.filter((s) => levelsEarned(person.id, s.track.id) >= s.need).length }; // exams only: a placement says where to start, not what is proven
  });
  const s = standing(c.ladder.map((r) => r.level), c.history[0]?.level ?? null, verifiedLevel(rungs));
  return { ...s, role: c.role, titles: new Map(c.ladder.map((r) => [r.level, r.title])) };
}

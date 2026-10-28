import { type users } from "@/lib/db";
import { careerFor } from "@/lib/careers";
import { catalog, inScope, scopesOf } from "@/lib/paths";
import { levelsEarned } from "@/lib/progress";
import { type Standing, type RungEvidence, standing, verifiedLevel } from "@/lib/standing";

type Person = typeof users.$inferSelect;

export type CareerStanding = Standing & { role: string; titles: Map<number, string> };

/** The title a manager gave (or the bottom rung) next to what real exams prove, for this person's own ladder. Null when they have no ladder. Pass `c` when the career is already loaded. */
export function standingFor(person: Person, cat = catalog(), c = careerFor(person, cat)): CareerStanding | null {
  if (!c) return null;
  const scopes = scopesOf(person.id);
  const rungs: RungEvidence[] = c.ladder.map((r) => {
    const steps = r.steps.filter((s) => s.countable && inScope(s.track, person.audience, scopes));
    return { level: r.level, counted: steps.length, met: steps.filter((s) => levelsEarned(person.id, s.track.id) >= s.need).length }; // exams only: a placement says where to start, not what is proven
  });
  const s = standing(c.ladder.map((r) => r.level), c.history[0]?.level ?? null, verifiedLevel(rungs));
  return { ...s, role: c.role, titles: new Map(c.ladder.map((r) => [r.level, r.title])) };
}

import { and, desc, eq, inArray } from "drizzle-orm";
import { careerLevels, careerRequirements, db, promotions, users } from "@/lib/db";
import { levelsEarned } from "@/lib/progress";
import { catalog, inScope, requirementsFor, scopesOf } from "@/lib/paths";
import { domainOf } from "@/lib/blueprint";
import { roleCheckDrawable, roleCheckValidUntil, roleExamsAvailable, type CheckSource } from "@/lib/roleCheck";

type Person = typeof users.$inferSelect;
type CatalogTrack = ReturnType<typeof catalog>[number];

export type Step = {
  reqId: number;
  track: CatalogTrack;
  need: number;
  passed: number;
  met: boolean;
  /** false while the track's questions do not reach the needed level yet; such a step cannot be passed, so it never blocks */
  countable: boolean;
};

export type Rung = {
  id: number; level: number; title: string; summary: string;
  /** what the level looks like in the framework's three measures (content/careers/framework.json); blank until written */
  knowledge: string; delivery: string; leadership: string;
  steps: Step[];
};

export type Career = {
  role: string;
  ladder: Rung[];
  current: Rung;
  next: Rung | null;
  /** how many of the next level's countable steps are met */
  done: number;
  total: number;
  /** every countable step is met, there is at least one, mandatory learning is not overdue and a role check is passed where one can be taken */
  ready: boolean;
  /** why a person with all steps met is still held back */
  hold: "overdue" | "nothing-to-measure" | "role-check" | null;
  /** the role check promotion asks for: needed when one can be drawn for the next level; validUntil is when a passing one stops counting */
  check: { needed: boolean; validUntil: number | null } | null;
  history: { level: number; title: string; at: number; overridden: boolean }[];
};

const now = () => Math.floor(Date.now() / 1000);

export const roleKey = (jobRole: string) => jobRole.trim().toLowerCase();

export const rolesWithLadders = () => [...new Set(db.select({ r: careerLevels.jobRole }).from(careerLevels).all().map((r) => r.r))].sort();

/** A role's ladder with each level's steps resolved to tracks. `catalogRows` can be shared across many people. */
export function ladderFor(role: string, catalogRows = catalog()): Rung[] {
  const levels = db.select().from(careerLevels).where(eq(careerLevels.jobRole, role)).orderBy(careerLevels.level).all();
  if (!levels.length) return [];
  const reqs = db.select().from(careerRequirements).where(inArray(careerRequirements.careerLevelId, levels.map((l) => l.id))).all();
  const byId = new Map(catalogRows.map((t) => [t.id, t]));
  return levels.map((l) => ({
    id: l.id, level: l.level, title: l.title, summary: l.summary, knowledge: l.knowledge, delivery: l.delivery, leadership: l.leadership,
    steps: reqs.filter((r) => r.careerLevelId === l.id).flatMap((r) => {
      const track = byId.get(r.trackId);
      return track ? [{ reqId: r.id, track, need: r.requiredLevel, passed: 0, met: false, countable: track.reach >= r.requiredLevel }] : [];
    }),
  }));
}

/** Promotion needs a recent passing role check aimed at the next level, unless no fair check can be drawn from the path (then it cannot block). */
function roleCheckFor(person: Person, role: string, ladder: Rung[], nextLevel: number, scopes: ReturnType<typeof scopesOf>): NonNullable<Career["check"]> {
  if (!roleExamsAvailable()) return { needed: false, validUntil: null }; // tables not pushed yet: nobody can take a check, so none is asked for
  const tracks = new Map<number, CheckSource>();
  for (const r of ladder) {
    if (r.level > nextLevel) break;
    for (const s of r.steps) {
      if (!s.countable || !inScope(s.track, person.audience, scopes)) continue;
      const t = tracks.get(s.track.id);
      if (!t || s.need > t.level) tracks.set(s.track.id, { trackId: s.track.id, slug: s.track.slug, domain: domainOf(s.track.slug, s.track.kind), level: s.need });
    }
  }
  const rungNo = ladder.findIndex((r) => r.level === nextLevel) + 1;
  return { needed: roleCheckDrawable(role, rungNo, ladder.length, [...tracks.values()]), validUntil: roleCheckValidUntil(person.id, role, nextLevel, now()) };
}

/** Where this person stands on their role's ladder. Null when their role has no ladder or they are not staff. */
export function careerFor(person: Person, catalogRows = catalog()): Career | null {
  if (person.audience !== "staff") return null;
  const role = roleKey(person.jobRole);
  const ladder = ladderFor(role, catalogRows);
  if (!ladder.length) return null;

  const history = db.select().from(promotions).where(and(eq(promotions.userId, person.id), eq(promotions.jobRole, role))).orderBy(desc(promotions.createdAt), desc(promotions.id)).all();
  const levelNow = history[0]?.level ?? ladder[0].level;
  const current = ladder.find((r) => r.level === levelNow) ?? ladder[0];
  const nextRung = ladder.find((r) => r.level > current.level) ?? null;
  const next = nextRung && {
    ...nextRung,
    steps: nextRung.steps.map((s) => {
      const passed = levelsEarned(person.id, s.track.id); // promotions need real exams, not a placement
      return { ...s, passed, met: passed >= s.need };
    }),
  };

  const counted = next?.steps.filter((s) => s.countable) ?? [];
  const done = counted.filter((s) => s.met).length;
  const allMet = !!next && counted.length > 0 && done === counted.length;
  const scopes = scopesOf(person.id);
  const overdue = allMet && requirementsFor(person, scopes, catalogRows).some((r) => r.overdue);
  const check = next ? roleCheckFor(person, role, ladder, next.level, scopes) : null;
  const checkOk = !check?.needed || check.validUntil !== null;
  return {
    role, ladder, current, next, done, total: counted.length, check,
    ready: allMet && !overdue && checkOk,
    hold: !next ? null : counted.length === 0 ? "nothing-to-measure" : overdue ? "overdue" : allMet && !checkOk ? "role-check" : null,
    history: history.map((h) => ({ level: h.level, title: ladder.find((r) => r.level === h.level)?.title ?? `Level ${h.level}`, at: h.createdAt, overridden: !!h.overridden })),
  };
}

/** The tracks a person still needs for their next level, so the dashboard can offer to start them. */
export const openSteps = (c: Career) => c.next?.steps.filter((s) => s.countable && !s.met) ?? [];

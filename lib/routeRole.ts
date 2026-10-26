import { eq } from "drizzle-orm";
import { db, routeAssessments } from "@/lib/db";
import { ladderFor, rolesWithLadders } from "@/lib/careers";
import { loadRoles } from "@/lib/lifecycle/roles";
import type { Target, TargetAction, TargetArea, TargetStage } from "@/lib/route";

/**
 * A route to any rung of any career ladder, made on the fly from the ladder itself (content/careers/roles, or what an admin edited at
 * /admin/careers). Nobody writes a file: the slug says which role and which level, so "role--grade-6--6" is the route to the sixth level
 * of the Civil Service grades. Each track the ladder asks for up to that rung becomes an area, aimed at the highest level any rung needs.
 */
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const roleRouteSlug = (role: string, level: number) => `role--${slugify(role)}--${level}`;
const SLUG = /^role--([a-z0-9-]+)--(\d{1,2})$/;

export const isRoleRoute = (slug: string) => SLUG.test(slug);

/** The role a route slug names, as stored on the ladder, or null when no ladder has that name. */
const roleOf = (slugPart: string) => rolesWithLadders().find((r) => slugify(r) === slugPart) ?? null;

/** The roles that can be aimed at, with their family and the name people know them by. */
export function routeRoles(): { role: string; name: string; family: string; blurb: string; aliases: string[] }[] {
  const info = new Map(loadRoles().map((r) => [r.key, r]));
  return rolesWithLadders().map((role) => {
    const i = info.get(role);
    return { role, name: i?.name ?? role.replace(/\b\w/g, (c) => c.toUpperCase()), family: i?.family ?? "Other", blurb: i?.blurb ?? "", aliases: i?.aliases ?? [] };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** The rungs of a role a person can aim for: every one above the first, which is where people start. */
export function routeRungs(role: string) {
  return ladderFor(role).filter((r, i) => i > 0).map((r) => ({ level: r.level, title: r.title, summary: r.summary, steps: r.steps.length }));
}

export function roleTarget(slug: string): Target | null {
  const m = SLUG.exec(slug);
  const role = m && roleOf(m[1]);
  if (!m || !role) return null;
  const level = Number(m[2]);
  const ladder = ladderFor(role);
  const goal = ladder.find((r, i) => i > 0 && r.level === level);
  if (!goal) return null;
  const name = routeRoles().find((r) => r.role === role)?.name ?? role;

  // each track once, aimed at the highest level any rung up to the goal asks for, and staged by the first rung that needs it
  const rungs = ladder.filter((r, i) => i > 0 && r.level <= level);
  const seen = new Map<string, { track: (typeof rungs)[number]["steps"][number]["track"]; need: number; stage: number; order: number }>();
  rungs.forEach((r, i) => r.steps.forEach((s, j) => {
    const have = seen.get(s.track.slug);
    if (have) have.need = Math.max(have.need, s.need);
    else seen.set(s.track.slug, { track: s.track, need: s.need, stage: i + 1, order: i * 100 + j });
  }));
  const areas: TargetArea[] = [...seen.entries()].sort((a, b) => a[1].order - b[1].order).map(([trackSlug, v]) => ({
    key: trackSlug, label: v.track.name, why: `Asked for on the way to ${rungs[v.stage - 1].title}.`, trackSlug, target: v.need, hoursPerLevel: 4, stage: v.stage, priority: v.order + 1,
  }));
  if (!areas.length) return null;

  const stages: TargetStage[] = rungs.map((r, i) => ({ n: i + 1, label: `Reach ${r.title}`, blurb: r.summary || `What ${r.title} asks for.` }));
  const last = stages.length;
  const actions: TargetAction[] = [
    { key: "role-profile", label: `Read what ${goal.title} looks like`, detail: [goal.knowledge, goal.delivery, goal.leadership].filter(Boolean).join(" ") || `Find a job description for ${goal.title} and note what it asks that you do not yet do.`, stage: 1, hours: 1.5, priority: 0 },
    { key: "talk", label: "Talk to your manager or a mentor about the move", detail: "Ask what evidence they would want to see, and which tasks would let you show it before you are in the role.", stage: 1, hours: 1, priority: 0.5 },
    { key: "evidence", label: `Write down examples of ${goal.title}-level work`, detail: "For each, say the situation, what you did, and the result, with numbers where you can. Six good examples carry an application or a promotion conversation.", stage: last, hours: 4, priority: 1 },
  ];
  return {
    slug, kind: "promotion", title: `${goal.title}, on the ${name} ladder`, short: goal.title,
    summary: goal.summary || `The route to ${goal.title}: the learning each level asks for, in order, with dates.`,
    areas, stages, actions,
    apply: { label: `Aim for ${goal.title}`, detail: "When the plan is done, ask for the level check or the promotion conversation your company uses. You can start before the end date once your examples are written." },
  };
}

/** The role routes this person has started, oldest first. */
export const startedRoleTargets = (userId: number): Target[] =>
  db.select({ slug: routeAssessments.targetSlug }).from(routeAssessments).where(eq(routeAssessments.userId, userId)).all()
    .filter((r) => isRoleRoute(r.slug)).flatMap((r) => roleTarget(r.slug) ?? []);

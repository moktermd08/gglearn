import { ladderFor } from "@/lib/careers";
import { matchesRoles } from "@/lib/roleFamily";
import { DOMAIN_KEYS, apportion, domainOf, mixFor, pillarStance } from "@/lib/blueprint";
import { catalog, inScope, openTo, type Scope } from "@/lib/paths";

type CatalogTrack = ReturnType<typeof catalog>[number];
type Who = { jobRole: string; audience: "staff" | "customer" };

export const STARTER_SIZE = 6;

const rolesOf = (t: { roles: string }) => t.roles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);

/**
 * A new joiner's starter plan: up to `size` tracks they can take now, spread over the seven domains in the proportions of their
 * role's first rung (content/blueprints/roles.json), and within each domain the tracks their role's pillars rank highest
 * (content/blueprints/pillars.json). `skip` holds tracks already required, which they get anyway.
 */
export function starterPlan(person: Who, scopes: Scope[], skip: Set<number>, size = STARTER_SIZE, cat: CatalogTrack[] = catalog()): CatalogTrack[] {
  if (person.audience !== "staff" || size <= 0) return [];
  const role = person.jobRole.trim().toLowerCase();
  const rank = (t: CatalogTrack) => ({ required: 4, recommended: 2, optional: 0 })[pillarStance(role, t.pillar)] + (matchesRoles(rolesOf(t), role) && rolesOf(t).length ? 1 : 0);
  const open = cat.filter((t) => !skip.has(t.id) && t.reach >= 1 && openTo(person.audience, t.audience) && inScope(t, person.audience, scopes))
    .sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
  const rungs = ladderFor(role, cat).length || 2;
  const share = apportion(size, DOMAIN_KEYS.map((d) => mixFor(role, 1, rungs)[d]));
  const picked: CatalogTrack[] = [];
  DOMAIN_KEYS.forEach((d, i) => {
    picked.push(...open.filter((t) => domainOf(t.slug, t.kind) === d && rank(t) > 0).slice(0, share[i]));
  });
  // a domain with too few suitable tracks leaves its share unused: give it to the best of what is left
  for (const t of open) {
    if (picked.length >= size) break;
    if (!picked.includes(t) && rank(t) > 0) picked.push(t);
  }
  return picked.slice(0, size);
}

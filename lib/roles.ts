import { eq } from "drizzle-orm";
import { db, careerLevels } from "@/lib/db";
import { catalog } from "@/lib/paths";

type CatalogRows = ReturnType<typeof catalog>;
export type RoleCoverage = {
  /** role tracks a person in this role can actually be held to (they have enough questions) */
  required: number;
  /** role tracks that exist but are still waiting for questions */
  planned: number;
  ladder: boolean;
};

export const roleKey = (jobRole: string) => jobRole.trim().toLowerCase();
const rolesOf = (t: { roles: string }) => t.roles.split(",").map(roleKey).filter(Boolean);

/** What the academy has ready for one job role. Roles are matched exactly (lower case), so this is how an admin sees a mismatch. */
export function coverageFor(jobRole: string, cat: CatalogRows = catalog()): RoleCoverage {
  const role = roleKey(jobRole);
  const mine = cat.filter((t) => t.tier === "role" && t.audience !== "customer" && rolesOf(t).includes(role));
  return {
    required: mine.filter((t) => t.reach >= t.requiredLevel).length,
    planned: mine.filter((t) => t.reach < t.requiredLevel).length,
    ladder: !!db.select({ id: careerLevels.id }).from(careerLevels).where(eq(careerLevels.jobRole, role)).get(),
  };
}

/** A role with nothing enforceable and no ladder: the person gets only company-wide learning. */
export const hasNoRolePath = (c: RoleCoverage) => c.required === 0 && !c.ladder;

/** Roles the academy has something for, to offer as the choices when someone is invited or changes role. */
export function knownRoles(cat: CatalogRows = catalog()): string[] {
  const set = new Set<string>();
  for (const t of cat) if (t.tier === "role" && t.audience !== "customer") for (const r of rolesOf(t)) set.add(r);
  for (const l of db.select().from(careerLevels).all()) set.add(l.jobRole);
  return [...set].sort();
}

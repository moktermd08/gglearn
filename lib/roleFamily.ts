import fs from "node:fs";
import path from "node:path";

/**
 * The seven role families the onboarding framework uses to say who must learn what. A job role belongs to exactly one.
 * The careers files (content/careers/role-meta.json) group roles into twelve broader families; those are mapped onto these seven,
 * with a few roles moved where the work is different (delivery, operations). A role the careers files do not know belongs to none,
 * and so is held only to what is required of everyone.
 */
export const FAMILIES = [
  { code: "ENG", label: "Engineering and architecture", roles: "developer, architect, data engineer, QA, DevOps" },
  { code: "PDS", label: "Product, design and research", roles: "product owner, analyst, designer, researcher" },
  { code: "DEL", label: "Delivery and project", roles: "delivery or project manager, scrum master, PMO" },
  { code: "OPS", label: "Operations and support", roles: "service desk, support, service owner, platform operations" },
  { code: "COM", label: "Commercial", roles: "sales, marketing, PR, customer success" },
  { code: "CORP", label: "Corporate functions", roles: "finance, HR, legal, procurement, admin" },
  { code: "LEAD", label: "Leadership", roles: "heads of, directors, executives" },
] as const;
export type Family = (typeof FAMILIES)[number]["code"];
export const isFamily = (v: string): v is Family => FAMILIES.some((f) => f.code === v);
export const familyLabel = (code: Family) => FAMILIES.find((f) => f.code === code)!.label;

const FROM_META: Record<string, Family> = {
  "Engineering": "ENG", "Data & AI": "ENG", "IT & Infrastructure": "OPS", "Design & Content": "PDS", "Product & Delivery": "PDS",
  "Marketing, Sales & Customers": "COM", "Finance": "CORP", "People": "CORP", "Operations & Admin": "CORP", "Legal & Public Sector": "CORP",
  "Security, Risk & Compliance": "CORP", "Leadership": "LEAD",
};
const MOVED: Record<string, Family> = {
  "delivery manager": "DEL", "project manager": "DEL", "scrum master": "DEL", "programme manager": "DEL", "pmo analyst": "DEL", "release manager": "DEL",
  "customer support agent": "OPS", "service owner": "OPS", "operations manager": "OPS", "security": "OPS", "security analyst": "OPS", "business continuity manager": "OPS",
  "executive assistant": "CORP",
};

let meta: Record<string, { family: string }> | null = null;
function loadMeta() {
  if (meta) return meta;
  try { meta = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "careers", "role-meta.json"), "utf8")); } catch { meta = {}; }
  return meta!;
}

/** The family a job role belongs to, or null when the academy does not know the role. */
export function familyOf(jobRole: string): Family | null {
  const role = jobRole.trim().toLowerCase();
  return MOVED[role] ?? FROM_META[loadMeta()[role]?.family ?? ""] ?? null;
}

/** Every job role the academy knows in these families, for showing who a requirement reaches. */
export const rolesIn = (families: Family[]) => Object.keys(loadMeta()).filter((r) => { const f = familyOf(r); return !!f && families.includes(f); }).sort();

/** A track's `roles` can name a family instead of listing job roles ("family:eng"), so a role added later is covered without re-publishing. */
export const familyToken = (code: Family) => `family:${code.toLowerCase()}`;
export const isFamilyToken = (r: string) => r.startsWith("family:");
/** Does a track's role list (already lower-cased) name this job role, directly or through its family? An empty list names everyone. */
export function matchesRoles(roles: string[], jobRole: string): boolean {
  if (!roles.length) return true;
  const fam = familyOf(jobRole);
  return roles.includes(jobRole.trim().toLowerCase()) || (!!fam && roles.includes(familyToken(fam)));
}

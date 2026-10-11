import fs from "node:fs";
import path from "node:path";

/**
 * Question-mix blueprints. A role's exam and study plan are spread over seven domains (technology, tool, process, product,
 * service, brand, leadership); a CTO and a full stack developer get different shares, and the shares drift as people climb
 * their ladder. Data lives in content/blueprints; this module only reads and computes.
 */
export const DOMAIN_KEYS = ["technology", "tool", "process", "product", "service", "brand", "leadership"] as const;
export type Domain = (typeof DOMAIN_KEYS)[number];
export type Mix = Record<Domain, number>;

type RolesFile = { domains: Domain[]; roles: Record<string, { start: number[]; top: number[] }> };
type DomainsFile = { domains: Record<Domain, string>; kindDefault: Record<string, Domain>; tracks: Record<string, Domain> };

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "blueprints", f), "utf8")) as T;
let cache: { roles: RolesFile; domains: DomainsFile } | null = null;
const load = () => (cache ??= { roles: read<RolesFile>("roles.json"), domains: read<DomainsFile>("domains.json") });

export const domainLabel = (d: Domain) => load().domains.domains[d];
export const blueprintRoles = () => Object.keys(load().roles.roles).sort();

/** The domain a track is examined under: an explicit override, else the default for its kind. */
export function domainOf(slug: string, kind: string): Domain {
  const { tracks, kindDefault } = load().domains;
  return tracks[slug] ?? kindDefault[kind] ?? "technology";
}

/** Splits `total` whole units over `weights` in proportion (largest remainder), so the parts always add up to `total`. */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left-- <= 0) break; out[i]++; }
  return out;
}

const toMix = (v: number[]): Mix => Object.fromEntries(DOMAIN_KEYS.map((d, i) => [d, v[i]])) as Mix;

/** Percent mix (sums to 100) for rung `rung` (1-based) of a role with `rungs` rungs. Unknown roles get the generic manager mix. */
export function mixFor(role: string, rung: number, rungs: number): Mix {
  const { roles } = load().roles;
  const b = roles[role.trim().toLowerCase()] ?? roles["manager"];
  const t = rungs <= 1 ? 0 : Math.min(1, Math.max(0, (rung - 1) / (rungs - 1)));
  return toMix(apportion(100, b.start.map((s, i) => s + (b.top[i] - s) * t)));
}

/** How many of `n` exam questions each domain gets for this role and rung. */
export function examPlan(role: string, rung: number, rungs: number, n: number): Mix {
  const m = mixFor(role, rung, rungs);
  return toMix(apportion(n, DOMAIN_KEYS.map((d) => m[d])));
}

export type Stance = "required" | "recommended" | "optional";
type Stances = { required: string[]; recommended: string[] };
type MatrixFile = { everyone: Stances; roles: Record<string, Stances> };

let matrixCache: MatrixFile | null = null;
const matrix = () => (matrixCache ??= read<MatrixFile>("pillars.json"));

/** What a role is asked to do about one pillar: the strongest of the company-wide stance and the role's own. */
export function pillarStance(role: string, pillar: string | null | undefined): Stance {
  if (!pillar) return "optional";
  const m = matrix(), own = m.roles[role.trim().toLowerCase()];
  if (m.everyone.required.includes(pillar) || own?.required.includes(pillar)) return "required";
  if (m.everyone.recommended.includes(pillar) || own?.recommended.includes(pillar)) return "recommended";
  return "optional";
}

/** Every pillar a role is required or advised to learn, for admin views. */
export function pillarsFor(role: string): { required: string[]; recommended: string[] } {
  const m = matrix(), own = m.roles[role.trim().toLowerCase()];
  const required = [...new Set([...m.everyone.required, ...(own?.required ?? [])])];
  const recommended = [...new Set([...m.everyone.recommended, ...(own?.recommended ?? [])])].filter((p) => !required.includes(p));
  return { required, recommended };
}

/** Problems in the data files: mixes that do not sum to 100, wrong length, unknown domains, bad matrix entries. Empty means valid. */
export function validateBlueprints(): string[] {
  const { roles, domains } = load();
  const bad: string[] = [];
  const pillarSlugs = new Set((JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "structure", "pillars.json"), "utf8")) as { slug: string }[]).map((p) => p.slug));
  const m = matrix();
  const checkPillars = (who: string, s: Stances) => {
    for (const p of [...s.required, ...s.recommended]) if (!pillarSlugs.has(p)) bad.push(`pillars.json: ${who} -> unknown pillar ${p}`);
    for (const p of s.required) if (s.recommended.includes(p)) bad.push(`pillars.json: ${who} lists ${p} as both required and recommended`);
  };
  checkPillars("everyone", m.everyone);
  for (const [r, s] of Object.entries(m.roles)) {
    if (!roles.roles[r]) bad.push(`pillars.json: ${r} has no question-mix blueprint in roles.json`);
    checkPillars(r, s);
  }
  for (const r of Object.keys(roles.roles)) if (!m.roles[r]) bad.push(`pillars.json: ${r} has no pillar entry`);
  if (roles.domains.join() !== DOMAIN_KEYS.join()) bad.push(`roles.json domains must be ${DOMAIN_KEYS.join(", ")}`);
  for (const [r, b] of Object.entries(roles.roles)) {
    for (const k of ["start", "top"] as const) {
      if (b[k].length !== DOMAIN_KEYS.length) bad.push(`${r}.${k}: needs ${DOMAIN_KEYS.length} numbers`);
      else if (b[k].reduce((a, c) => a + c, 0) !== 100) bad.push(`${r}.${k}: sums to ${b[k].reduce((a, c) => a + c, 0)}, not 100`);
      if (b[k].some((x) => !Number.isInteger(x) || x < 0)) bad.push(`${r}.${k}: whole numbers 0 or more only`);
    }
  }
  for (const [s, d] of Object.entries(domains.tracks)) if (!DOMAIN_KEYS.includes(d)) bad.push(`domains.json: ${s} -> unknown domain ${d}`);
  return bad;
}

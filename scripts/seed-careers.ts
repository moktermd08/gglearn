/**
 * Starter promotion ladders for the roles the academy already knows. Only roles that have no ladder yet are seeded,
 * so edits made in the app are never overwritten. Requirements point at existing tracks by slug; a step on a track whose
 * questions do not reach that level yet is kept and shown as "coming soon" until they do.
 *   npm run seed:careers
 *   npm run seed:careers -- --add-steps   also add the steps listed in NEW_STEPS to ladders that already exist
 *                                        (only steps that are missing; a step already there, at any level, is left alone)
 */
import { and, eq } from "drizzle-orm";
import { careerLevels, careerRequirements, db, tracks } from "../lib/db";
import { catalog } from "../lib/paths";

type Step = [slug: string, level: number];
type Rung = { title: string; summary: string; steps: Step[] };

/** Steps added after the first release. Part of LADDERS for fresh installs, and added to existing ladders with --add-steps. */
const NEW_STEPS: { role: string; rung: string; slug: string; level: number }[] = [
  { role: "sales", rung: "Sales Executive", slug: "guru-graphics-sales", level: 5 },
  { role: "sales", rung: "Sales Executive", slug: "lead-generation-titan", level: 5 },
  { role: "sales", rung: "Senior Sales Executive", slug: "lead-generation-titan", level: 8 },
  { role: "sales", rung: "Head of Sales", slug: "lead-generation-titan", level: 10 },
];

const LADDERS: Record<string, Rung[]> = {
  developer: [
    { title: "Junior Developer", summary: "Learning the company's stack and ways of working.", steps: [] },
    { title: "Developer", summary: "Ships features independently and safely.", steps: [
      ["governance-compliance", 5], ["sdlc-security", 5], ["sdlc-testing", 5], ["sdlc-backend", 5], ["git-titan", 8], ["javascript-titan", 8]] },
    { title: "Senior Developer", summary: "Owns designs, reviews others' work and raises the standard.", steps: [
      ["sdlc-architecture", 8], ["sdlc-database", 8], ["sdlc-devops", 8], ["security-operations", 8], ["ai-llm-practice", 5], ["git-titan", 12], ["javascript-titan", 12], ["llm-prompting-titan", 8]] },
    { title: "Lead Developer", summary: "Leads a team's delivery and the technical direction.", steps: [
      ["sdlc-architecture", 10], ["servers-infrastructure", 8], ["delivery-management", 8], ["people-operations", 8], ["javascript-titan", 16]] },
  ],
  designer: [
    { title: "Junior Designer", summary: "Learning the brand, the design system and the tools.", steps: [] },
    { title: "Designer", summary: "Delivers designs end to end with light review.", steps: [
      ["governance-compliance", 5], ["guru-brand-identity", 5], ["guru-design-system", 5], ["guru-design-tools", 5], ["html-titan", 5], ["css-titan", 5]] },
    { title: "Senior Designer", summary: "Sets direction for a project and mentors others.", steps: [
      ["guru-brand-identity", 8], ["guru-design-system", 8], ["css-titan", 8], ["image-diffusion-titan", 8], ["image-midjourney-titan", 8], ["llm-prompting-titan", 8]] },
    { title: "Design Lead", summary: "Owns the design practice and its quality.", steps: [
      ["guru-design-system", 10], ["delivery-management", 8], ["people-operations", 8]] },
  ],
  sales: [
    { title: "Sales Associate", summary: "Learning the products, the pitch and the process.", steps: [] },
    { title: "Sales Executive", summary: "Runs deals from first call to close.", steps: [
      ["governance-compliance", 5], ["gglink-sales-support", 5], ["moksy-product", 5], ["ggsocial-product", 5], ["ggmoney-product", 5], ["llm-fundamentals-titan", 5], ["guru-graphics-sales", 5], ["lead-generation-titan", 5]] },
    { title: "Senior Sales Executive", summary: "Wins larger accounts and coaches the team.", steps: [
      ["gglink-sales-support", 8], ["payments-billing", 5], ["communications-email", 5], ["data-analytics", 8], ["llm-prompting-titan", 8], ["lead-generation-titan", 8]] },
    { title: "Head of Sales", summary: "Owns pipeline, pricing and the sales team.", steps: [
      ["delivery-management", 8], ["people-operations", 8], ["data-analytics", 10], ["payments-billing", 8], ["lead-generation-titan", 10]] },
  ],
  manager: [
    { title: "Manager", summary: "Leads a team and its delivery.", steps: [] },
    { title: "Senior Manager", summary: "Leads several teams and owns outcomes.", steps: [
      ["governance-compliance", 8], ["delivery-management", 8], ["people-operations", 8], ["sdlc-discovery", 8], ["sdlc-requirements", 8]] },
    { title: "Head of Department", summary: "Sets direction and standards for a whole function.", steps: [
      ["delivery-management", 10], ["people-operations", 10], ["payments-billing", 8], ["data-analytics", 8], ["llm-fundamentals-titan", 8]] },
  ],
};

const cat = new Map(catalog().map((t) => [t.slug, t]));
const have = new Set(db.select({ r: careerLevels.jobRole }).from(careerLevels).all().map((r) => r.r));
let roles = 0, levels = 0, steps = 0, soon = 0;

for (const [role, rungs] of Object.entries(LADDERS)) {
  if (have.has(role)) continue;
  roles++;
  rungs.forEach((r, i) => {
    const row = db.insert(careerLevels).values({ jobRole: role, level: i + 1, title: r.title, summary: r.summary }).returning().get();
    levels++;
    for (const [slug, level] of r.steps) {
      const t = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
      if (!t) { console.warn(`  skipped ${role}/${r.title}: no track "${slug}"`); continue; }
      db.insert(careerRequirements).values({ careerLevelId: row.id, trackId: t.id, requiredLevel: level }).onConflictDoNothing().run();
      steps++;
      if ((cat.get(slug)?.reach ?? 0) < level) { soon++; console.log(`  coming soon: ${role}/${r.title}: ${slug} level ${level} (questions reach ${cat.get(slug)?.reach ?? 0})`); }
    }
  });
}
if (process.argv.includes("--add-steps")) {
  let added = 0;
  for (const n of NEW_STEPS) {
    const lvl = db.select().from(careerLevels).where(eq(careerLevels.jobRole, n.role)).all().find((l) => l.title === n.rung);
    const t = db.select().from(tracks).where(eq(tracks.slug, n.slug)).get();
    if (!lvl) { console.warn(`  skipped ${n.role}/${n.rung}: no such level`); continue; }
    if (!t) { console.warn(`  skipped ${n.role}/${n.rung}: no track "${n.slug}" (seed or import it first)`); continue; }
    if (db.select().from(careerRequirements).where(and(eq(careerRequirements.careerLevelId, lvl.id), eq(careerRequirements.trackId, t.id))).get()) continue;
    db.insert(careerRequirements).values({ careerLevelId: lvl.id, trackId: t.id, requiredLevel: n.level }).run();
    added++;
    const reach = cat.get(n.slug)?.reach ?? 0;
    console.log(`  added ${n.role}/${n.rung}: ${n.slug} level ${n.level}${reach < n.level ? ` (coming soon: questions reach ${reach})` : ""}`);
  }
  console.log(`new steps added to existing ladders: ${added}`);
}
console.log(`careers seeded: ${roles} roles, ${levels} levels, ${steps} steps (${soon} not passable yet)`);

/**
 * Career ladders for every role, read from content/careers (see content/careers/_template.json for the format every company follows).
 *   content/careers/framework.json   the shared framework: levels IC1 to IC6 and the three measures
 *   content/careers/roles/*.json     one ladder per job role: rungs (title, summary, the three measures, steps) and bridges to other roles
 *   content/careers/overlays/*.json  steps one company adds to the shared ladders for its own tracks
 *
 * Nothing an admin has edited in the app is overwritten. A role that already has a ladder keeps its levels and steps; its blank
 * knowledge/delivery/leadership wording is filled in. Steps point at tracks by slug; a step on a track whose questions do not
 * reach that level yet is kept and shown as "coming soon" until they do.
 *   npm run seed:careers
 *   npm run seed:careers -- --add-steps   also add steps that are missing from ladders that already exist (a step already on that
 *                                        level is left alone; nothing is changed or removed). Seed or import the tracks first.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { careerBridges, careerLevels, careerRequirements, db, tracks } from "../lib/db";
import { catalog } from "../lib/paths";

type Step = [slug: string, level: number];
type Rung = { title: string; summary: string; knowledge?: string; delivery?: string; leadership?: string; steps: Step[] };
type Role = { role: string; name?: string; bridges?: { from: string; fromLevel: number; toLevel?: number }[]; rungs: Rung[] };
type Overlay = { company: string; steps: { role: string; rung: number; slug: string; level: number }[] };

const dir = path.join(process.cwd(), "content", "careers");
const readAll = <T>(sub: string): { file: string; data: T }[] =>
  fs.existsSync(path.join(dir, sub))
    ? fs.readdirSync(path.join(dir, sub)).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(dir, sub, f), "utf8")) as T }))
    : [];

const roles = readAll<Role>("roles"), overlays = readAll<Overlay>("overlays");
const problems: string[] = [];
for (const { file, data: r } of roles) {
  if (r.role !== r.role.trim().toLowerCase()) problems.push(`${file}: role must be lower case`);
  if (!r.rungs?.length) problems.push(`${file}: no rungs`);
  else if (r.rungs[0].steps.length) problems.push(`${file}: rung 1 is the starting point and cannot have steps`);
  if (r.rungs?.length > 10) problems.push(`${file}: at most 10 rungs`);
  for (const [i, u] of (r.rungs ?? []).entries()) if (!u.title || !u.summary || !u.knowledge || !u.delivery || !u.leadership) problems.push(`${file}: rung ${i + 1} needs title, summary, knowledge, delivery and leadership`);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const cat = new Map(catalog().map((t) => [t.slug, t]));
const addSteps = process.argv.includes("--add-steps");
const have = new Set(db.select({ r: careerLevels.jobRole }).from(careerLevels).all().map((r) => r.r));
let nRoles = 0, nLevels = 0, nSteps = 0, soon = 0, filled = 0, bridges = 0, added = 0;

function putStep(levelId: number, label: string, slug: string, level: number, existing: boolean) {
  const t = db.select().from(tracks).where(eq(tracks.slug, slug)).get();
  if (!t) { console.warn(`  skipped ${label}: no track "${slug}" (seed or import it first)`); return false; }
  const reach = cat.get(slug)?.reach ?? 0;
  if (existing) {
    if (db.select().from(careerRequirements).where(and(eq(careerRequirements.careerLevelId, levelId), eq(careerRequirements.trackId, t.id))).get()) return false;
    db.insert(careerRequirements).values({ careerLevelId: levelId, trackId: t.id, requiredLevel: level }).run();
    added++;
    console.log(`  added ${label}: ${slug} level ${level}${reach < level ? ` (coming soon: questions reach ${reach})` : ""}`);
  } else {
    db.insert(careerRequirements).values({ careerLevelId: levelId, trackId: t.id, requiredLevel: level }).onConflictDoNothing().run();
    nSteps++;
    if (reach < level) { soon++; console.log(`  coming soon: ${label}: ${slug} level ${level} (questions reach ${reach})`); }
  }
  return true;
}

const levelRow = (role: string, level: number) => db.select().from(careerLevels).where(and(eq(careerLevels.jobRole, role), eq(careerLevels.level, level))).get();

for (const { data: r } of roles) {
  if (!have.has(r.role)) {
    nRoles++;
    r.rungs.forEach((u, i) => {
      const row = db.insert(careerLevels).values({ jobRole: r.role, level: i + 1, title: u.title, summary: u.summary, knowledge: u.knowledge ?? "", delivery: u.delivery ?? "", leadership: u.leadership ?? "" }).returning().get();
      nLevels++;
      for (const [slug, level] of u.steps) putStep(row.id, `${r.role}/${u.title}`, slug, level, false);
    });
  } else {
    // an existing ladder is the admin's now: only blank wording is filled in, so edits are never lost
    r.rungs.forEach((u, i) => {
      const row = levelRow(r.role, i + 1);
      if (!row || row.title !== u.title) return;
      const set: Partial<typeof row> = {};
      for (const k of ["knowledge", "delivery", "leadership"] as const) if (!row[k] && u[k]) set[k] = u[k];
      if (Object.keys(set).length) { db.update(careerLevels).set(set).where(eq(careerLevels.id, row.id)).run(); filled++; }
      if (addSteps) for (const [slug, level] of u.steps) putStep(row.id, `${r.role}/${u.title}`, slug, level, true);
    });
  }
  for (const b of r.bridges ?? []) {
    if (!roles.some((x) => x.data.role === b.from)) { console.warn(`  skipped bridge ${b.from} -> ${r.role}: no ladder file for "${b.from}"`); continue; }
    const res = db.insert(careerBridges).values({ fromRole: b.from, fromLevel: b.fromLevel, toRole: r.role, toLevel: b.toLevel ?? 1 }).onConflictDoNothing().run();
    bridges += res.changes;
  }
}

for (const { file, data: o } of overlays) {
  for (const s of o.steps) {
    const row = levelRow(s.role, s.rung);
    if (!row) { console.warn(`  skipped ${file}: ${s.role} has no rung ${s.rung}`); continue; }
    if (s.rung === 1) { console.warn(`  skipped ${file}: rung 1 is the starting point`); continue; }
    // a company's steps go onto a ladder created in this run too, but onto an existing one only with --add-steps
    if (have.has(s.role) && !addSteps) continue;
    putStep(row.id, `${o.company}: ${s.role}/${row.title}`, s.slug, s.level, have.has(s.role));
  }
}

console.log(`careers seeded: ${nRoles} new roles, ${nLevels} levels, ${nSteps} steps (${soon} not passable yet); ${filled} rungs got wording; ${bridges} bridges; ${added} steps added to existing ladders`);

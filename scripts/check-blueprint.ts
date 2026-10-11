/**
 * Checks the question-mix blueprints against the real ladders and the real question banks.
 *   npm run check:blueprint                 summary: blueprint validity, per-role drift, bank depth gaps
 *   npm run check:blueprint -- --role cto   one role, rung by rung
 *   npm run check:blueprint -- --list       also list every track below the depth floor
 *   npm run check:blueprint -- --depth      with --role, include the (slow) depth measurement
 * Depth floor per track: 1000 distinct questions in all (stored active + dynamic-family capacity) and 50 on every level.
 * Drift = largest gap, in percentage points, between a rung's blueprint mix and the mix of levels its ladder asks for so far.
 */
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, questions, tracks } from "@/lib/db";
import { distinctPrompts, familiesFor } from "@/lib/dynamic/engine";
import { MAX_LEVEL } from "@/lib/levels";
import { DOMAIN_KEYS, domainOf, mixFor, validateBlueprints, blueprintRoles, type Domain } from "@/lib/blueprint";

const FLOOR_TOTAL = 1000, FLOOR_LEVEL = 50;
const argv = process.argv.slice(2);
const roleArg = argv.includes("--role") ? argv[argv.indexOf("--role") + 1] : undefined;
const wantDepth = !roleArg || argv.includes("--depth"); // measuring dynamic capacity takes a couple of minutes, so a single-role check skips it

const bad = validateBlueprints();
if (bad.length) { console.error("Blueprint data is invalid:\n" + bad.join("\n")); process.exit(1); }

const stored = new Map<string, number>();
for (const r of db.select({ t: questions.trackId, l: questions.level, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "active")).groupBy(questions.trackId, questions.level).all()) stored.set(`${r.t}:${r.l}`, r.n);
const all = db.select().from(tracks).all();
const bySlug = new Map(all.map((t) => [t.slug, t]));
const depth = new Map<string, { total: number; min: number }>();
function depthOf(slug: string) {
  const hit = depth.get(slug);
  if (hit) return hit;
  const t = bySlug.get(slug);
  if (!t) return undefined;
  let total = 0, min = Infinity;
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const dyn = familiesFor(slug, l).reduce((s, f) => s + distinctPrompts(f, l, 300), 0);
    const n = (stored.get(`${t.id}:${l}`) ?? 0) + dyn;
    total += n; min = Math.min(min, n);
  }
  const d = { total, min };
  depth.set(slug, d);
  return d;
}
const deep = (slug: string) => { const d = depthOf(slug); return !!d && d.total >= FLOOR_TOTAL && d.min >= FLOOR_LEVEL; };

type Role = { role: string; rungs: { title: string; steps: [string, number][] }[] };
const dir = path.join(process.cwd(), "content", "careers", "roles");
const ladders = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Role);

const pct = (x: number) => String(Math.round(x)).padStart(3);
const dom = (slug: string): Domain => domainOf(slug, bySlug.get(slug)?.kind ?? "technology");
let worst = 0;
const noBlueprint: string[] = [], missingTracks = new Set<string>(), shallowUsed = new Set<string>();

for (const l of ladders) {
  if (roleArg && l.role !== roleArg) continue;
  if (!blueprintRoles().includes(l.role)) { noBlueprint.push(l.role); continue; }
  const have = new Map<string, number>(); // slug -> highest level asked so far
  const lines: string[] = [];
  let roleWorst = 0;
  l.rungs.forEach((rung, i) => {
    for (const [slug, lv] of rung.steps) {
      have.set(slug, Math.max(have.get(slug) ?? 0, lv));
      if (!bySlug.has(slug)) missingTracks.add(`${l.role}: ${slug}`);
      else if (wantDepth && !deep(slug)) shallowUsed.add(slug);
    }
    if (i === 0) return;
    const got = Object.fromEntries(DOMAIN_KEYS.map((d) => [d, 0])) as Record<Domain, number>;
    for (const [slug, lv] of have) got[dom(slug)] += lv;
    const sum = DOMAIN_KEYS.reduce((a, d) => a + got[d], 0) || 1;
    const want = mixFor(l.role, i + 1, l.rungs.length);
    const gap = Math.max(...DOMAIN_KEYS.map((d) => Math.abs((got[d] / sum) * 100 - want[d])));
    roleWorst = Math.max(roleWorst, gap);
    lines.push(`  rung ${i + 1} ${rung.title.padEnd(28)} want ${DOMAIN_KEYS.map((d) => pct(want[d])).join(" ")} | ladder ${DOMAIN_KEYS.map((d) => pct((got[d] / sum) * 100)).join(" ")} | gap ${gap.toFixed(0)}pp`);
  });
  worst = Math.max(worst, roleWorst);
  console.log(`${roleWorst < 15 ? "✓" : "✗"} ${l.role} (max gap ${roleWorst.toFixed(0)}pp)`);
  if (roleArg || roleWorst >= 15) console.log(`  domains: ${DOMAIN_KEYS.join(" ")}\n${lines.join("\n")}`);
}

console.log(`\nRoles with a ladder but no blueprint: ${noBlueprint.join(", ") || "none"}`);
console.log(`Steps pointing at tracks that do not exist: ${[...missingTracks].join("; ") || "none"}`);
console.log(`Worst drift anywhere: ${worst.toFixed(0)}pp`);

if (wantDepth) {
  const rows = all.map((t) => ({ t, d: depthOf(t.slug)! })).filter((x) => x.d);
  const short = rows.filter((x) => !(x.d.total >= FLOOR_TOTAL && x.d.min >= FLOOR_LEVEL));
  console.log(`\nBank depth: ${rows.length - short.length}/${rows.length} tracks have ${FLOOR_TOTAL}+ questions and ${FLOOR_LEVEL}+ per level.`);
  const perDomain = Object.fromEntries(DOMAIN_KEYS.map((d) => [d, { ok: 0, short: 0 }]));
  for (const x of rows) perDomain[dom(x.t.slug)][short.includes(x) ? "short" : "ok"]++;
  for (const d of DOMAIN_KEYS) console.log(`  ${d.padEnd(11)} ${perDomain[d].ok} ready, ${perDomain[d].short} short`);
  console.log(`Short tracks that ladders already ask for: ${[...shallowUsed].sort().join(", ") || "none"}`);
  if (argv.includes("--list")) for (const x of short.sort((a, b) => a.d.total - b.d.total)) console.log(`  ${x.t.slug.padEnd(30)} ${dom(x.t.slug).padEnd(11)} total ${String(x.d.total).padStart(5)}  thinnest level ${x.d.min}`);
}

/**
 * Fits career ladders to their question-mix blueprints (content/blueprints).
 *   npm run fit:blueprint                          dry run: show what would change for every role
 *   npm run fit:blueprint -- --role cto --role sales   only these roles
 *   npm run fit:blueprint -- --write               rewrite content/careers/roles/*.json
 *   npm run fit:blueprint -- --write --apply       also update the database ladders
 *
 * For each rung in turn it hill-climbs over the role's allowed tracks (content/blueprints/pools.json): raise or lower a track's
 * required level, add a track, or drop one, to minimise the largest gap between the blueprint mix and the mix of levels the ladder
 * asks for so far. A track's level never falls below what an earlier rung already asks, levels stay within what the rung can
 * reasonably ask (rung 2 up to 8 ... rung 6 up to 20) and steps for tracks that do not exist are left alone.
 * --apply only touches a role whose database steps still equal the role file (nothing an admin edited is overwritten), and keeps
 * steps from overlays untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { careerLevels, careerRequirements, db, tracks } from "@/lib/db";
import { DOMAIN_KEYS, domainOf, mixFor, type Domain } from "@/lib/blueprint";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const only = argv.flatMap((a, i) => (a === "--role" ? [argv[i + 1]] : []));
const alsoFile = argv.includes("--also") ? argv[argv.indexOf("--also") + 1] : undefined; // an earlier version of the single --role file whose levels the database may still hold
const skip = argv.flatMap((a, i) => (a === "--skip" ? [argv[i + 1]] : []));
const LEVELS = [5, 8, 10, 12, 14, 16, 18, 20];
const CAP = [0, 0, 8, 12, 16, 18, 20, 20, 20, 20, 20]; // by rung number
const MAX_NEW = 14, TARGET = 5, MIN_STEPS = 3, MIN_ADDED = 12, MIN_GROWTH = 0.15;

type Step = [string, number];
type Role = { role: string; rungs: { title: string; steps: Step[] }[] } & Record<string, unknown>;
type Pools = { tech: Record<string, string[]>; tool: Record<string, string[]>; process: Record<string, string[]>; leadership: Record<string, string[]>; roles: Record<string, Record<"tech" | "tool" | "process" | "leadership", string>> };

const root = path.join(process.cwd(), "content");
const pools: Pools = JSON.parse(fs.readFileSync(path.join(root, "blueprints", "pools.json"), "utf8"));
const kind = new Map(db.select({ s: tracks.slug, k: tracks.kind }).from(tracks).all().map((r) => [r.s, r.k]));
const dom = (s: string): Domain => domainOf(s, kind.get(s) ?? "technology");
const poolFor = (role: string): Set<string> => {
  const m = pools.roles[role];
  const out = new Set<string>(["product-management-core", "service-design-pricing", "brand-positioning-voice"]);
  if (m) for (const d of ["tech", "tool", "process", "leadership"] as const) for (const s of pools[d][m[d]] ?? []) out.add(s);
  return out;
};

function score(L: Map<string, number>, want: Record<Domain, number>): { max: number; l1: number } {
  const got = Object.fromEntries(DOMAIN_KEYS.map((d) => [d, 0])) as Record<Domain, number>;
  for (const [s, lv] of L) if (kind.has(s)) got[dom(s)] += lv;
  const sum = DOMAIN_KEYS.reduce((a, d) => a + got[d], 0);
  if (!sum) return { max: 100, l1: 100 };
  const gaps = DOMAIN_KEYS.map((d) => Math.abs((got[d] / sum) * 100 - want[d]));
  return { max: Math.max(...gaps), l1: gaps.reduce((a, b) => a + b, 0) };
}

function fitRole(r: Role): { rungs: Step[][]; report: string[]; worst: number } {
  const pool = poolFor(r.role);
  const R = r.rungs.length;
  let prev = new Map<string, number>();
  const outRungs: Step[][] = [[]];
  const report: string[] = [];
  let worst = 0;
  const unknown = new Set<string>(); // steps for tracks that do not exist: kept as written
  for (let i = 1; i < R; i++) {
    const rung = i + 1, cap = CAP[Math.min(rung, 10)];
    const orig = new Map<string, number>(prev);
    for (const [s, lv] of r.rungs[i].steps) { if (!kind.has(s)) { unknown.add(s); continue; } orig.set(s, Math.min(20, Math.max(orig.get(s) ?? 0, lv))); }
    const cur = new Map(orig);
    let prevTotal = 0;
    for (const [s, lv] of prev) if (kind.has(s)) prevTotal += lv;
    const want = mixFor(r.role, rung, R);
    const eligible = new Set<string>([...pool, ...orig.keys()]);
    const cost = (L: Map<string, number>) => {
      const sc = score(L, want);
      let changed = 0, news = 0, added = 0;
      for (const s of new Set([...L.keys(), ...orig.keys()])) {
        if ((L.get(s) ?? 0) !== (orig.get(s) ?? 0)) changed++;
        const gain = (L.get(s) ?? 0) - (prev.get(s) ?? 0);
        if (gain > 0) { news++; if (kind.has(s)) added += gain; }
      }
      // every rung has to ask for something new: at least MIN_STEPS tracks raised, and a real step up in total levels
      const need = Math.max(MIN_ADDED, Math.round(prevTotal * MIN_GROWTH));
      const progress = Math.max(0, MIN_STEPS - news) * 400 + Math.max(0, need - added) * 8;
      return { v: sc.max * 100 + sc.l1 + changed * 0.5 + progress, news, max: sc.max };
    };
    let best = cost(cur);
    for (let it = 0; it < 400; it++) {
      let move: { s: string; to: number } | null = null, mv = best;
      for (const s of eligible) {
        const c = cur.get(s) ?? 0, f = prev.get(s) ?? 0;
        const opts = new Set<number>();
        const up = LEVELS.find((x) => x > c && x <= Math.max(cap, c));
        if (up !== undefined && (pool.has(s) || orig.has(s))) opts.add(up);
        const down = [...LEVELS].reverse().find((x) => x < c && x >= f);
        if (down !== undefined) opts.add(down); else if (c > f && f === 0) opts.add(0); else if (c > f) opts.add(f);
        for (const to of opts) {
          const t = new Map(cur); if (to === 0) t.delete(s); else t.set(s, to);
          const k = cost(t);
          if (k.news <= MAX_NEW && k.v < mv.v - 1e-9) { mv = k; move = { s, to }; }
        }
      }
      if (!move) break;
      if (move.to === 0) cur.delete(move.s); else cur.set(move.s, move.to);
      best = mv;
      if (best.max <= TARGET && best.v < 1000 && it > 3) break;
    }
    const steps: Step[] = [];
    for (const [s, lv] of cur) if (lv > (prev.get(s) ?? 0)) steps.push([s, lv]);
    for (const s of r.rungs[i].steps) if (!kind.has(s[0])) steps.push(s);
    const pos = new Map(r.rungs[i].steps.map((s, k) => [s[0], k]));
    steps.sort((a, b) => (pos.get(a[0]) ?? 99) - (pos.get(b[0]) ?? 99) || DOMAIN_KEYS.indexOf(dom(a[0])) - DOMAIN_KEYS.indexOf(dom(b[0])));
    outRungs.push(steps);
    worst = Math.max(worst, best.max);
    const sc = score(cur, want);
    report.push(`  rung ${rung}: gap ${sc.max.toFixed(0)}pp, ${steps.length} steps (was ${r.rungs[i].steps.length})`);
    prev = cur;
  }
  return { rungs: outRungs, report, worst };
}

const dir = path.join(root, "careers", "roles");
const fmt = (o: Role) => JSON.stringify(o, null, 2).replace(/\[\n\s+("[^"]+"),\n\s+(\d+)\n\s+\]/g, "[$1, $2]");
let touched = 0;
const diverged: string[] = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Role;
  if ((only.length && !only.includes(r.role)) || skip.includes(r.role)) continue;
  if (!pools.roles[r.role]) { console.log(`${r.role}: no pool, skipped`); continue; }
  const old = r.rungs.map((u) => u.steps.map((s) => [...s] as Step));
  const { rungs, report, worst } = fitRole(r);
  console.log(`${worst <= 15 ? "✓" : "✗"} ${r.role} (worst rung ${worst.toFixed(0)}pp)`);
  if (only.length || worst > 15) console.log(report.join("\n"));
  if (!flag("write")) continue;
  r.rungs.forEach((u, i) => (u.steps = rungs[i]));
  fs.writeFileSync(path.join(dir, f), fmt(r) + "\n");
  touched++;
  if (!flag("apply")) continue;
  // database: only if it still equals the old role file
  const levels = db.select().from(careerLevels).where(eq(careerLevels.jobRole, r.role)).all();
  const id = new Map(levels.map((l) => [l.level, l.id]));
  const slugOf = new Map(db.select({ i: tracks.id, s: tracks.slug }).from(tracks).all().map((t) => [t.i, t.s]));
  const idOf = new Map([...slugOf].map(([i, s]) => [s, i]));
  let ok = true;
  for (let i = 1; i < old.length && ok; i++) {
    const lid = id.get(i + 1);
    if (!lid) { ok = false; break; }
    const rows = db.select().from(careerRequirements).where(eq(careerRequirements.careerLevelId, lid)).all();
    const alt = new Map<string, number>(alsoFile ? (JSON.parse(fs.readFileSync(alsoFile, "utf8")) as Role).rungs[i]?.steps ?? [] : []);
    for (const [s, lv] of old[i]) { const t = idOf.get(s); if (t === undefined) continue; const row = rows.find((x) => x.trackId === t); if (!row || (row.requiredLevel !== lv && row.requiredLevel !== alt.get(s))) ok = false; }
  }
  if (!ok) { diverged.push(r.role); continue; }
  db.transaction((tx) => {
    for (let i = 1; i < old.length; i++) {
      const lid = id.get(i + 1)!;
      const altSlugs = alsoFile ? ((JSON.parse(fs.readFileSync(alsoFile, "utf8")) as Role).rungs[i]?.steps ?? []).map(([s]) => s) : [];
      const oldIds = [...new Set([...old[i].map(([s]) => s), ...altSlugs])].map((s) => idOf.get(s)).filter((x): x is number => x !== undefined);
      const rows = tx.select().from(careerRequirements).where(eq(careerRequirements.careerLevelId, lid)).all();
      for (const t of oldIds) tx.delete(careerRequirements).where(and(eq(careerRequirements.careerLevelId, lid), eq(careerRequirements.trackId, t))).run();
      const kept = new Set(rows.map((x) => x.trackId).filter((t) => !oldIds.includes(t)));
      for (const [s, lv] of rungs[i]) { const t = idOf.get(s); if (t !== undefined && !kept.has(t)) tx.insert(careerRequirements).values({ careerLevelId: lid, trackId: t, requiredLevel: lv }).run(); }
    }
  });
}
if (flag("write")) console.log(`\nWrote ${touched} role files.${diverged.length ? ` Database NOT updated for (steps were edited in the app): ${diverged.join(", ")}` : flag("apply") ? " Database updated." : ""}`);
else console.log("\nDry run. Add --write to rewrite the role files, --write --apply to update the database too.");

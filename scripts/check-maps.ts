/*
 * Every map (lib/lifecycle/maps.ts) must be sound: unique ids, stops on lines that exist and inside a phase, no stop sitting on a handoff
 * gate that crosses its line, gates between real lines, and areas and company stages that only name stops and gates that exist.
 * Run: npm run check:maps
 */
import { MAPS } from "../lib/lifecycle/maps";
import { BUSINESS_DEF } from "../lib/lifecycle/business";
import { PUBLIC_DEF } from "../lib/lifecycle/public";
import type { MapDef } from "../lib/lifecycle/engine";

const DEFS: Record<string, MapDef> = { business: BUSINESS_DEF, public: PUBLIC_DEF };

let bad = 0;
const fail = (map: string, msg: string) => { bad++; console.error(`FAIL [${map}] ${msg}`); };

for (const m of Object.values(MAPS)) {
  const id = m.id;
  const lineIds = new Set(m.LINES.map((l) => l.id));
  const seen = new Set<string>();
  for (const s of m.STATIONS) {
    if (seen.has(s.id)) fail(id, `stop id "${s.id}" is used twice`);
    seen.add(s.id);
    if (!lineIds.has(s.line)) fail(id, `${s.id}: no line "${s.line}"`);
    if (m.zoneOf(s.x) < 0) fail(id, `${s.id}: x ${s.x} is outside every phase`);
    if (!s.track) fail(id, `${s.id}: no learning track`);
    if (!s.ins.length || !s.outs.length) fail(id, `${s.id}: needs inputs and outputs`);
  }
  for (const l of m.LINES) {
    const xs = m.stationsOn(l.id).map((s) => s.x);
    if (new Set(xs).size !== xs.length) fail(id, `line ${l.id}: two stops share a position`);
  }
  // labels: two stops on one line must not draw their names on top of each other (the layout picks a tier and side for each)
  for (const l of m.LINES) {
    const on = m.stationsOn(l.id);
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      const a = on[i], b = on[j];
      if (a.tier === b.tier && a.L < b.R - 2 && b.L < a.R - 2) fail(id, `labels overlap on ${l.id}: "${a.name}" and "${b.name}"`);
    }
  }
  const gateIds = new Set<string>();
  for (const g of m.GATES) {
    if (gateIds.has(g.id)) fail(id, `gate id "${g.id}" is used twice`);
    gateIds.add(g.id);
    for (const ln of g.lines) {
      if (!lineIds.has(ln)) { fail(id, `gate ${g.id}: no line "${ln}"`); continue; }
      const clash = m.stationsOn(ln).find((s) => Math.abs(s.x - g.x) < 1);
      if (clash) fail(id, `gate ${g.id} (x ${g.x}) sits on ${clash.name} on line ${ln}`);
    }
    if (!g.fail || !g.ins.length || !g.outs.length) fail(id, `gate ${g.id}: needs inputs, outputs and a failure note`);
  }
  const focusIds = new Set<string>();
  for (const f of m.FOCUS) {
    if (focusIds.has(f.id)) fail(id, `area "${f.id}" is used twice`);
    focusIds.add(f.id);
    for (const ln of f.lines) if (!lineIds.has(ln)) fail(id, `area ${f.id}: no line "${ln}"`);
    for (const sid of f.stops ?? []) if (!m.STATION_BY_ID.has(sid)) fail(id, `area ${f.id}: no stop "${sid}"`);
    if (f.start && !m.STATION_BY_ID.has(f.start)) fail(id, `area ${f.id}: starts on unknown stop "${f.start}"`);
  }
  const stageIds = new Set<string>();
  for (const st of m.STAGES) {
    if (stageIds.has(st.id)) fail(id, `stage "${st.id}" is used twice`);
    stageIds.add(st.id);
    for (const sid of st.stops) if (!m.STATION_BY_ID.has(sid)) fail(id, `stage ${st.id}: no stop "${sid}"`);
    if (new Set(st.stops).size !== st.stops.length) fail(id, `stage ${st.id}: a stop is listed twice`);
    if (!st.stops.includes(st.start)) fail(id, `stage ${st.id}: starts on "${st.start}", which is not one of its stops`);
    for (const g of st.watch) if (!m.GATE_BY_ID.has(g)) fail(id, `stage ${st.id}: no gate "${g}"`);
    const n = m.buildRoute(null, "all", "human", st.id).ids.size;
    if (n !== st.stops.length) fail(id, `stage ${st.id}: route has ${n} stops, expected ${st.stops.length}`);
  }
  // sizes: ids exist, a bigger size never loses a stop, and a stage's first stop is never one the size lens would hide
  if (m.SIZES.length) {
    const sizeIds = new Set(m.SIZES.map((x) => x.id));
    const def = DEFS[id];
    for (const [sz, ids] of Object.entries(def?.sizes?.from ?? {})) {
      if (!sizeIds.has(sz) || sz === m.SIZES[0].id) fail(id, `sizes.from: "${sz}" is not a size after the smallest`);
      for (const sid of ids) if (!m.STATION_BY_ID.has(sid)) fail(id, `sizes.from.${sz}: no stop "${sid}"`);
    }
    const listed = Object.values(def?.sizes?.from ?? {}).flat();
    if (new Set(listed).size !== listed.length) fail(id, "sizes.from: a stop is listed under two sizes");
    for (const [sid, by] of Object.entries(def?.sizes?.notes ?? {})) {
      if (!m.STATION_BY_ID.has(sid)) fail(id, `sizes.notes: no stop "${sid}"`);
      for (const sz of Object.keys(by)) if (!sizeIds.has(sz)) fail(id, `sizes.notes.${sid}: no size "${sz}"`);
    }
    if (sizeIds.size !== m.SIZES.length) fail(id, "two sizes share an id");
    for (const z of m.SIZES) if (!z.changes.length || !z.challenges.length || !z.owner || !z.formal || !z.blurb || !z.people) fail(id, `size ${z.id}: needs people, a blurb, changes, challenges, an owner line and a handoff line`);
    for (const st of m.STATIONS) {
      const first = m.sizeFrom(st.id);
      if (first < 0 || first >= m.SIZES.length) fail(id, `${st.id}: bad size`);
    }
    for (const stage of m.STAGES) if (m.sizeFrom(stage.start) !== 0) fail(id, `stage ${stage.id} starts on "${stage.start}", which the smallest size leaves out`);
    for (const f of m.FOCUS) if (f.start && m.sizeFrom(f.start) !== 0) fail(id, `area ${f.id} starts on "${f.start}", which the smallest size leaves out`);
    let prev = 0;
    for (const z of m.SIZES) {
      const n = m.buildRoute(null, "all", "human", null, z.id).ids.size;
      if (n < prev) fail(id, `size ${z.id} lights ${n} stops, fewer than the size below it (${prev})`);
      prev = n;
      for (const stage of m.STAGES) if (m.buildRoute(null, "all", "human", stage.id, z.id).ids.size < 3) fail(id, `stage ${stage.id} has fewer than 3 stops at size ${z.id}`);
    }
    const sizeCounts = m.SIZES.map((z) => `${z.label} ${m.buildRoute(null, "all", "human", null, z.id).ids.size}`).join(", ");
    console.log(`          sizes: ${sizeCounts}`);
  }
  // every stop should be reachable from at least one company stage, or the stage view hides it for good
  const inStage = new Set(m.STAGES.flatMap((s) => s.stops));
  const orphans = m.STATIONS.filter((s) => !inStage.has(s.id)).map((s) => s.id);
  if (orphans.length) console.warn(`note [${id}] ${orphans.length} stops are in no company stage: ${orphans.join(", ")}`);
  const links = m.STATIONS.filter((s) => m.dependenciesOf(s.id).needs.length).length;
  console.log(`${id.padEnd(9)} ${m.STATIONS.length} stops, ${m.LINES.length} lines, ${m.GATES.length} gates, ${m.STAGES.length} stages, ${links} stops with "builds on" links`);
}
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log("maps ok");

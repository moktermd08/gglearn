/*
 * Every map (lib/lifecycle/maps.ts) must be sound: unique ids, stops on lines that exist and inside a phase, no stop sitting on a handoff
 * gate that crosses its line, gates between real lines, and areas and company stages that only name stops and gates that exist.
 * Run: npm run check:maps
 */
import { MAPS } from "../lib/lifecycle/maps";

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
  // every stop should be reachable from at least one company stage, or the stage view hides it for good
  const inStage = new Set(m.STAGES.flatMap((s) => s.stops));
  const orphans = m.STATIONS.filter((s) => !inStage.has(s.id)).map((s) => s.id);
  if (orphans.length) console.warn(`note [${id}] ${orphans.length} stops are in no company stage: ${orphans.join(", ")}`);
  const links = m.STATIONS.filter((s) => m.dependenciesOf(s.id).needs.length).length;
  console.log(`${id.padEnd(9)} ${m.STATIONS.length} stops, ${m.LINES.length} lines, ${m.GATES.length} gates, ${m.STAGES.length} stages, ${links} stops with "builds on" links`);
}
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log("maps ok");

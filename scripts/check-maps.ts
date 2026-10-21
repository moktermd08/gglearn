/*
 * Every map (lib/lifecycle/maps.ts) must be sound: unique ids, stops on lines that exist and inside a phase, no stop sitting on a handoff
 * gate that crosses its line, gates between real lines, and areas and company stages that only name stops and gates that exist.
 * Run: npm run check:maps
 */
import { MAPS } from "../lib/lifecycle/maps";
import { BUSINESS_DEF } from "../lib/lifecycle/business";
import { PUBLIC_DEF } from "../lib/lifecycle/public";
import { SOFTWARE_DEF } from "../lib/lifecycle/software";
import type { MapDef } from "../lib/lifecycle/engine";
import { combineProblems } from "../lib/lifecycle/problems";
import { loadRoles } from "../lib/lifecycle/roles";

const DEFS: Record<string, MapDef> = { business: BUSINESS_DEF, public: PUBLIC_DEF, software: SOFTWARE_DEF };

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
  // problems in plain words: unique ids, real stops, a first step and a way to know it worked, and a combined link must resolve
  const probIds = new Set<string>();
  for (const p of m.PROBLEMS) {
    if (probIds.has(p.id) || p.id.includes("+")) fail(id, `problem "${p.id}" is used twice or has a "+" in its id`);
    probIds.add(p.id);
    if (!p.say || !p.first || !p.done || !p.words) fail(id, `problem ${p.id}: needs say, words, first and done`);
    if (p.stops.length < 2 || p.stops.length > 10) fail(id, `problem ${p.id}: has ${p.stops.length} stops (2 to 10)`);
    for (const sid of p.stops) if (!m.STATION_BY_ID.has(sid)) fail(id, `problem ${p.id}: no stop "${sid}"`);
    if (new Set(p.stops).size !== p.stops.length) fail(id, `problem ${p.id}: a stop is listed twice`);
  }
  if (m.PROBLEMS.length >= 2 && !combineProblems(`${m.PROBLEMS[0].id}+${m.PROBLEMS[1].id}`, m.PROBLEMS)) fail(id, "two problems do not combine");
  // every map gives every stop its own words for where it breaks and how you know it worked, so no card borrows a gate's note
  {
    for (const s of m.STATIONS) {
      if (!m.breaksFor(s.id)) fail(id, `${s.id}: no own "where it usually breaks" text`);
      if (!m.outcomeFor(s.id)) fail(id, `${s.id}: no "you will know it worked when" text`);
    }
    const known = new Set(m.STATIONS.map((s) => s.id));
    // how well the question bank backs each stop (content/lifecycle/coverage-business.json): only real stops, sane counts, and a stale file is named
    const cov = id === "business" ? DEFS.business.coverage ?? {} : {}; // measured for the business map only
    for (const [sid, c] of Object.entries(cov)) {
      if (!known.has(sid)) fail(id, `coverage: no stop "${sid}"`);
      else if (!(c.total > 0) || c.hit < 0 || c.hit > c.total) fail(id, `coverage: bad counts for "${sid}" (${c.hit} of ${c.total})`);
    }
    const unmeasured = m.STATIONS.filter((s) => !cov[s.id]).map((s) => s.id);
    if (id === "business" && unmeasured.length > 6) console.warn(`note [business] ${unmeasured.length} stops have no coverage figure (run npm run report:coverage -- --write): ${unmeasured.join(", ")}`);
    for (const [what, rec] of [["breaks", DEFS[id]?.breaks], ["outcomes", DEFS[id]?.outcomes], ["pros", DEFS[id]?.pros], ["handoffs", DEFS[id]?.handoffs]] as const)
      for (const sid of Object.keys(rec ?? {})) if (!known.has(sid)) fail(id, `${what}: no stop "${sid}"`);
  }
  // kinds of business: unique ids, real stops, something to say, a route of their own in the finder, and a note only on stops that exist
  const secIds = new Set<string>();
  for (const s of m.SECTORS) {
    if (secIds.has(s.id)) fail(id, `sector "${s.id}" is used twice`);
    secIds.add(s.id);
    if (!s.label || !s.blurb || !s.watch || !s.rules.length || !s.say || !s.words || !s.first || !s.done) fail(id, `sector ${s.id}: needs a label, blurb, who sets the rules, rules, and what to say, do first and expect`);
    if (s.key.length < 5 || s.key.length > 12) fail(id, `sector ${s.id}: has ${s.key.length} key stops (5 to 12)`);
    for (const sid of s.key) if (!m.STATION_BY_ID.has(sid)) fail(id, `sector ${s.id}: no key stop "${sid}"`);
    for (const sid of Object.keys(s.notes)) if (!m.STATION_BY_ID.has(sid)) fail(id, `sector ${s.id}: note on missing stop "${sid}"`);
    if (Object.keys(s.notes).length < 5) fail(id, `sector ${s.id}: has fewer than 5 stop notes`);
    if (!m.PROBLEMS.some((p) => p.id === `sec-${s.id}`)) fail(id, `sector ${s.id}: has no problem in the finder`);
  }
  const links = m.STATIONS.filter((s) => m.dependenciesOf(s.id).needs.length).length;
  console.log(`${id.padEnd(9)} ${m.STATIONS.length} stops, ${m.LINES.length} lines, ${m.GATES.length} gates, ${m.STAGES.length} stages, ${links} stops with "builds on" links`);
}
// every career ladder is served by some map: a role whose main subjects have no stop on any map would show nothing useful anywhere
// (a role mostly covered by another map is pointed there, see LifecycleMap's "Open it there")
const maps = Object.values(MAPS);
let pointed = 0;
for (const r of loadRoles()) {
  if (!r.core.length) continue;
  const cover = maps.map((mm) => mm.roleCoverage(r.core) / r.core.length), best = Math.max(...cover);
  if (best < 0.25) fail("roles", `${r.key}: only ${Math.round(best * 100)}% of its main subjects have a stop on any map`);
  if (cover[0] <= 0.5 && best >= 0.3 && best >= cover[0] + 0.25) pointed++;
}
console.log(`roles     ${loadRoles().length} ladders, every one served by at least one map; ${pointed} are pointed from the business map to a better-fitting one`);
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log("maps ok");

/* The company stages (lib/lifecycle/model.ts) must only name stops and gates that exist, and start on one of their own stops. Run: npm run check:stages */
import { GATE_BY_ID, STAGES, STATION_BY_ID, buildRoute } from "../lib/lifecycle/model";

let bad = 0;
const fail = (msg: string) => { bad++; console.error("FAIL", msg); };
for (const st of STAGES) {
  for (const id of st.stops) if (!STATION_BY_ID.has(id)) fail(`${st.id}: no stop "${id}"`);
  if (new Set(st.stops).size !== st.stops.length) fail(`${st.id}: a stop is listed twice`);
  if (!(st.stops as readonly string[]).includes(st.start)) fail(`${st.id}: starts on "${st.start}", which is not one of its stops`);
  for (const g of st.watch) if (!GATE_BY_ID.has(g)) fail(`${st.id}: no gate "${g}"`);
  const n = buildRoute(null, "all", "human", st.id).ids.size;
  if (n !== st.stops.length) fail(`${st.id}: route has ${n} stops, expected ${st.stops.length}`);
  console.log(`${st.id.padEnd(7)} ${String(st.stops.length).padStart(2)} stops, starts at ${STATION_BY_ID.get(st.start)?.name}`);
}
if (new Set(STAGES.map((s) => s.id)).size !== STAGES.length) fail("two stages share an id");
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log("stages ok");

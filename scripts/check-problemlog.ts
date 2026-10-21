/** Checks the anonymous problem-finder counts: npm run check:problemlog (uses DATABASE_FILE or data/gglearn.db; counts on a day in 1999 and removes them). Run db:push first. */
import { eq } from "drizzle-orm";
import { db, problemPicks } from "../lib/db";
import { MAPS } from "../lib/lifecycle/maps";
import { cleanPick, problemReport, recordPick } from "../lib/problemLog";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const DAY = "1999-01-01", NEXT = "1999-01-02", EARLY = "1998-12-01";
const sweep = () => { for (const d of [DAY, NEXT, EARLY]) db.delete(problemPicks).where(eq(problemPicks.day, d)).run(); };

const biz = MAPS.business;
const pid = biz.PROBLEMS[0].id, pid2 = biz.PROBLEMS[1].id, sid = biz.STATIONS[0].id;

// ---- what may be logged ----
check("a real problem on a real map is accepted", cleanPick("pick", "business", [pid])?.ids[0] === pid);
check("a made-up problem is refused", cleanPick("pick", "business", ["not-a-problem"]) === null);
check("a problem from another map is refused", cleanPick("pick", "business", [MAPS.public.PROBLEMS[0].id]) === null);
check("a made-up map is refused", cleanPick("pick", "nowhere", [pid]) === null);
check("a made-up kind is refused", cleanPick("delete", "business", [pid]) === null);
check("one bad id in a combined pick refuses all of it", cleanPick("pick", "business", [pid, "nope"]) === null);
check("a combined pick keeps each problem once, up to four", cleanPick("pick", "business", [pid, pid, pid2])?.ids.length === 2);
check("a real stop is accepted, and only one at a time", cleanPick("stop", "business", [sid, biz.STATIONS[1].id])?.ids.length === 1);
check("a made-up stop is refused", cleanPick("stop", "business", ["zzz"]) === null);
check("a search that found nothing needs no id", cleanPick("nomatch", "business", [])?.ids[0] === "");
check("a pick with no ids is refused", cleanPick("pick", "business", []) === null);

// ---- counting ----
sweep();
try {
  check("a pick is counted", recordPick("pick", "business", [pid], DAY) === 1);
  recordPick("pick", "business", [pid], DAY);
  recordPick("pick", "business", [pid, pid2], DAY); // a combined route counts each problem once
  recordPick("stop", "business", [sid], DAY);
  recordPick("nomatch", "business", [], DAY);
  recordPick("nomatch", "business", [], DAY);
  recordPick("pick", "business", [pid], NEXT);
  recordPick("pick", "business", ["junk"], DAY);
  const rows = db.select().from(problemPicks).where(eq(problemPicks.day, DAY)).all();
  check("repeat picks add to one row per day, problem and kind", rows.filter((r) => r.problem === pid && r.kind === "pick").length === 1 && rows.find((r) => r.problem === pid && r.kind === "pick")?.n === 3);
  check("a combined pick counts both problems", rows.find((r) => r.problem === pid2)?.n === 1);
  check("junk is not stored", !rows.some((r) => r.problem === "junk"));
  check("nothing but counts is stored (no user, address or text column)", Object.keys(rows[0]).sort().join() === ["day", "id", "kind", "map", "n", "problem"].sort().join());

  // ---- the report ----
  const rep = problemReport(7, NEXT);
  const m = "error" in rep ? null : rep.maps.find((x) => x.id === "business");
  check("the report covers the period (two days)", !!m && m.picks.find((p) => p.id === pid)?.n === 4);
  check("the report counts searches that found nothing", m?.nomatch === 2);
  check("the report counts stop jumps", m?.stops.find((s) => s.id === sid)?.n === 1);
  check("the report lists problems nobody picked", !!m && m.unpicked.length === biz.PROBLEMS.length - 2 && !m.unpicked.some((p) => p.id === pid));
  const narrow = problemReport(1, NEXT);
  check("a shorter period leaves out older days", "maps" in narrow && narrow.maps.find((x) => x.id === "business")?.picks.find((p) => p.id === pid)?.n === 1);
  const old = problemReport(7, "1999-03-01");
  check("days outside the period are left out", "maps" in old && (old.maps.find((x) => x.id === "business")?.total ?? 0) === 0);
  check("the report covers every map with a finder", "maps" in rep && rep.maps.length === Object.values(MAPS).filter((x) => x.PROBLEMS.length).length);
} finally {
  sweep();
}
if (fails) { console.error(`${fails} failed`); process.exit(1); }
console.log("problem log ok");

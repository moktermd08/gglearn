/**
 * Checks the Career doctor's "others say" signal: npm run check:others. Pure, touches no database. Praise is counted by different people and by
 * different 30-day periods, only inside the last year, only for the field whose tracks it was left on; promotions are matched to a field by role.
 */
import { rollup, WINDOW_DAYS, type Praise } from "../lib/careerOthers";

let fails = 0;
const check = (name: string, ok: boolean) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };
const DAY = 86400, NOW = 1_800_000_000;
const ago = (d: number) => NOW - d * DAY;
const praise = (trackId: number, authorId: number, days: number): Praise => ({ trackId, authorId, at: ago(days) });
const fields = [
  { family: "Data & AI", tracks: new Set([1, 2]), roles: new Set(["data-analyst", "data analyst"]) },
  { family: "Sales", tracks: new Set([3]), roles: new Set(["sales", "sales manager"]) },
];

const empty = rollup(fields, [], [], NOW).get("Data & AI")!;
check("nothing said is all zeros and null", empty.notes === 0 && empty.people === 0 && empty.promotions === 0 && empty.lastPraiseAt === null && empty.lastPromotionAt === null);

const one = rollup(fields, [praise(1, 9, 1), praise(1, 9, 2), praise(2, 9, 3)], [], NOW).get("Data & AI")!;
check("one reviewer leaving three notes is one person", one.notes === 3 && one.people === 1);
check("a burst inside one 30-day period is one period", one.periods === 1);

const spread = rollup(fields, [praise(1, 9, 5), praise(1, 8, 40), praise(2, 7, 100)], [], NOW).get("Data & AI")!;
check("three people over three periods", spread.people === 3 && spread.periods === 3 && spread.lastPraiseAt === ago(5));

const old = rollup(fields, [praise(1, 9, WINDOW_DAYS + 1), praise(1, 9, WINDOW_DAYS - 1)], [], NOW).get("Data & AI")!;
check("praise older than a year is left out", old.notes === 1);

const other = rollup(fields, [praise(3, 9, 1)], [], NOW);
check("praise counts only for the field that owns the track", other.get("Data & AI")!.notes === 0 && other.get("Sales")!.notes === 1);
check("praise from the future is ignored", rollup(fields, [praise(1, 9, -2)], [], NOW).get("Data & AI")!.notes === 0);

const promo = rollup(fields, [], [{ role: " Data Analyst ", at: ago(200) }, { role: "sales", at: ago(900) }, { role: "chef", at: ago(1) }], NOW);
check("a promotion matches its field by role name, ignoring case and spaces", promo.get("Data & AI")!.promotions === 1 && promo.get("Data & AI")!.lastPromotionAt === ago(200));
check("a promotion is counted however long ago", promo.get("Sales")!.promotions === 1);
check("a role in no field is counted nowhere", [...promo.values()].reduce((n, o) => n + o.promotions, 0) === 2);

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);

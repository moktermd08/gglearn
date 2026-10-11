import type { Draft, Family } from "../types";
import { NAMES, NOUNS, nearNums, tier } from "../kit";

type Row = { id: number; name: string; dept: string; salary: number; mgr: number | null };
const DEPTS = ["Sales", "Ops", "Dev", "HR", "Legal", "Data"];

function table(r: ReturnType<typeof import("../rng").rng>, n: number): Row[] {
  const names = r.sample(NAMES, n), depts = r.sample(DEPTS, 3);
  return names.map((name, i) => ({ id: i + 1, name, dept: r.pick(depts), salary: r.int(3, 12) * 1000, mgr: i === 0 || r.chance(0.2) ? null : r.int(1, i) }));
}
const ddl = (rows: Row[]) =>
  `CREATE TABLE emp(id INTEGER, name TEXT, dept TEXT, salary INTEGER, mgr INTEGER);\n` +
  `INSERT INTO emp VALUES ${rows.map((x) => `(${x.id}, '${x.name}', '${x.dept}', ${x.salary}, ${x.mgr ?? "NULL"})`).join(",\n  ")};`;
const shown = (rows: Row[]) => rows.map((x) => `(${x.id}, '${x.name}', '${x.dept}', ${x.salary}, ${x.mgr ?? "NULL"})`).join("\n");

export const sqlFamilies: Family[] = [
  {
    id: "sql.select", tags: ["sql"], levels: [1, 20],
    make(r, level) {
      const rows = table(r, 5 + tier(level)), min = r.int(4, 9) * 1000, dept = r.pick(rows).dept, lim = r.int(1, 3);
      const asc = r.chance(0.5);
      const forms: [string, string, string][] = [
        [`SELECT COUNT(*) FROM emp WHERE salary > ${min}`, String(rows.filter((x) => x.salary > min).length), "count"],
        [`SELECT name FROM emp WHERE dept = '${dept}' ORDER BY salary ${asc ? "ASC" : "DESC"}, id LIMIT 1`, [...rows.filter((x) => x.dept === dept)].sort((a, b) => (asc ? a.salary - b.salary : b.salary - a.salary) || a.id - b.id)[0].name, "name"],
        [`SELECT SUM(salary) FROM emp WHERE dept = '${dept}'`, String(rows.filter((x) => x.dept === dept).reduce((s, x) => s + x.salary, 0)), "sum"],
        [`SELECT COUNT(DISTINCT dept) FROM emp`, String(new Set(rows.map((x) => x.dept)).size), "distinct"],
        [`SELECT MAX(salary) - MIN(salary) FROM emp`, String(Math.max(...rows.map((x) => x.salary)) - Math.min(...rows.map((x) => x.salary))), "range"],
        [`SELECT COUNT(*) FROM emp WHERE salary BETWEEN ${min} AND ${min + 3000} AND dept <> '${dept}'`, String(rows.filter((x) => x.salary >= min && x.salary <= min + 3000 && x.dept !== dept).length), "between"],
        [`SELECT id FROM emp ORDER BY salary DESC, id ASC LIMIT 1 OFFSET ${lim}`, String([...rows].sort((a, b) => b.salary - a.salary || a.id - b.id)[lim].id), "offset"],
        [`SELECT COUNT(*) FROM emp WHERE name LIKE '${rows[0].name[0]}%'`, String(rows.filter((x) => x.name.startsWith(rows[0].name[0])).length), "like"],
      ];
      const [sql, v, topic] = r.pick(level < 5 ? forms.slice(0, 4) : forms);
      const n = Number(v);
      const wr = Number.isFinite(n) ? nearNums(r, n, 3, topic === "sum" || topic === "range" ? 1000 : 1).map(String) : rows.map((x) => x.name);
      return { prompt: `Given the table below (salaries by id: ${rows.map((x) => x.salary / 1000).join(", ")}k), what does \`${sql}\` return?`, code: shown(rows).replace(/^/, "emp(id, name, dept, salary, mgr)\n"), correct: v, wrong: wr.filter((x) => x !== v), topic: "SELECT queries",
        verify: { lang: "sql", src: `${ddl(rows)}\n${sql};`, expect: v } };
    },
  },
  {
    id: "sql.group", tags: ["sql"], levels: [5, 20],
    make(r, level) {
      const rows = table(r, 7 + tier(level) * 2), k = r.int(1, 3), s = r.int(8, 20) * 1000;
      const by = new Map<string, Row[]>();
      for (const x of rows) by.set(x.dept, [...(by.get(x.dept) ?? []), x]);
      const forms: [string, string][] = [
        [`SELECT COUNT(*) FROM (SELECT dept FROM emp GROUP BY dept HAVING COUNT(*) > ${k})`, String([...by.values()].filter((g) => g.length > k).length)],
        [`SELECT COUNT(*) FROM (SELECT dept FROM emp GROUP BY dept HAVING SUM(salary) >= ${s})`, String([...by.values()].filter((g) => g.reduce((a, b) => a + b.salary, 0) >= s).length)],
        [`SELECT dept FROM emp GROUP BY dept ORDER BY SUM(salary) DESC, dept LIMIT 1`, [...by.entries()].sort((a, b) => b[1].reduce((x, y) => x + y.salary, 0) - a[1].reduce((x, y) => x + y.salary, 0) || (a[0] < b[0] ? -1 : 1))[0][0]],
        [`SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM emp GROUP BY dept)`, String(Math.max(...[...by.values()].map((g) => g.length)))],
        [`SELECT COUNT(*) FROM emp e JOIN emp m ON e.mgr = m.id WHERE e.salary > m.salary`, String(rows.filter((e) => { const m = rows.find((y) => y.id === e.mgr); return m && e.salary > m.salary; }).length)],
        [`SELECT COUNT(*) FROM emp WHERE mgr IS NULL`, String(rows.filter((x) => x.mgr === null).length)],
        [`SELECT COUNT(mgr) FROM emp`, String(rows.filter((x) => x.mgr !== null).length)],
        [`SELECT COUNT(*) FROM emp WHERE mgr NOT IN (SELECT id FROM emp WHERE dept = '${rows[0].dept}')`, String(rows.filter((x) => x.mgr !== null && !rows.some((y) => y.id === x.mgr && y.dept === rows[0].dept)).length)],
        [`SELECT MAX(salary) - MIN(salary) FROM emp WHERE dept = '${rows[0].dept}'`, String(Math.max(...rows.filter((x) => x.dept === rows[0].dept).map((x) => x.salary)) - Math.min(...rows.filter((x) => x.dept === rows[0].dept).map((x) => x.salary)))],
      ];
      const [sql, v] = r.pick(level < 8 ? forms.slice(0, 4) : forms);
      const n = Number(v);
      const wr = Number.isFinite(n) ? nearNums(r, n, 3, n > 500 ? 500 : 1).map(String) : DEPTS;
      return { prompt: `For the table below (salaries by id: ${rows.map((x) => x.salary / 1000).join(", ")}k), what does \`${sql}\` return?`, code: "emp(id, name, dept, salary, mgr)\n" + shown(rows), correct: v, wrong: wr.filter((x) => x !== v), topic: "grouping and joins",
        hint: "NULL never equals anything; COUNT(col) skips NULLs; NOT IN with a NULL in the list matches nothing.", verify: { lang: "sql", src: `${ddl(rows)}\n${sql};`, expect: v } } as Draft;
    },
  },
  {
    id: "sql.join", tags: ["sql"], levels: [8, 20],
    make(r, level) {
      const nA = r.int(3, 6), nB = r.int(3, 7), keysA = Array.from({ length: nA }, () => r.int(1, 5)), keysB = Array.from({ length: nB }, () => r.int(1, 6));
      const [ta, tb] = r.sample(NOUNS, 2).map((x) => `${x}s`);
      const ddl2 = `CREATE TABLE ${ta}(k INTEGER);\nCREATE TABLE ${tb}(k INTEGER);\nINSERT INTO ${ta} VALUES ${keysA.map((k) => `(${k})`).join(",")};\nINSERT INTO ${tb} VALUES ${keysB.map((k) => `(${k})`).join(",")};`;
      const inner = keysA.reduce((s, a) => s + keysB.filter((b) => b === a).length, 0);
      const left = keysA.reduce((s, a) => s + Math.max(1, keysB.filter((b) => b === a).length), 0);
      const cross = nA * nB, semi = keysA.filter((a) => keysB.includes(a)).length, anti = nA - semi;
      const forms: [string, number][] = [
        [`SELECT COUNT(*) FROM ${ta} JOIN ${tb} ON ${ta}.k = ${tb}.k`, inner], [`SELECT COUNT(*) FROM ${ta} LEFT JOIN ${tb} ON ${ta}.k = ${tb}.k`, left], [`SELECT COUNT(*) FROM ${ta}, ${tb}`, cross],
        [`SELECT COUNT(*) FROM ${ta} WHERE k IN (SELECT k FROM ${tb})`, semi], [`SELECT COUNT(*) FROM ${ta} WHERE k NOT IN (SELECT k FROM ${tb})`, anti],
        [`SELECT COUNT(*) FROM ${ta} WHERE EXISTS (SELECT 1 FROM ${tb} WHERE ${tb}.k = ${ta}.k)`, semi],
        [`SELECT COUNT(*) FROM (SELECT k FROM ${ta} UNION SELECT k FROM ${tb})`, new Set([...keysA, ...keysB]).size], [`SELECT COUNT(*) FROM (SELECT k FROM ${ta} UNION ALL SELECT k FROM ${tb})`, nA + nB],
        [`SELECT COUNT(*) FROM (SELECT k FROM ${ta} INTERSECT SELECT k FROM ${tb})`, new Set(keysA.filter((a) => keysB.includes(a))).size],
      ];
      const [sql, v] = r.pick(level < 11 ? forms.slice(0, 6) : forms);
      return { prompt: `${ta}.k holds ${keysA.join(", ")} and ${tb}.k holds ${keysB.join(", ")}. What does \`${sql}\` return?`, correct: String(v), wrong: [...new Set([inner, left, cross, semi, anti, nA + nB, nA, nB, v + 1, v - 1])].filter((x) => x !== v && x >= 0).map(String),
        topic: "joins and set operations", verify: { lang: "sql", src: `${ddl2}\n${sql};`, expect: String(v) } };
    },
  },
];

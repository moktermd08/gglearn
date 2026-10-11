/**
 * Question coverage report: for every track and level, how many distinct questions a learner can be asked.
 * capacity = stored active questions + distinct prompts the dynamic families can generate (sampled).
 * Usage: tsx scripts/coverage.ts [--min 100] [--fail] [--verbose]
 */
import { eq, sql } from "drizzle-orm";
import { db, questions, tracks } from "@/lib/db";
import { distinctPrompts, familiesFor } from "@/lib/dynamic/engine";
import { tagsFor } from "@/lib/dynamic/tags";
import { MAX_LEVEL } from "@/lib/levels";

const arg = (n: string) => process.argv.includes(`--${n}`);
const min = Number(process.argv[process.argv.indexOf("--min") + 1]) || 100;
const memo = new Map<string, number>();
const cap = (fam: ReturnType<typeof familiesFor>[number], level: number) => {
  const k = `${fam.id}:${level}`;
  if (!memo.has(k)) memo.set(k, distinctPrompts(fam, level, 300));
  return memo.get(k)!;
};

const stored = new Map<string, number>();
for (const r of db.select({ t: questions.trackId, l: questions.level, n: sql<number>`count(*)` }).from(questions).where(eq(questions.status, "active")).groupBy(questions.trackId, questions.level).all()) stored.set(`${r.t}:${r.l}`, r.n);

let below = 0, cells = 0;
const rows: string[] = [];
for (const t of db.select().from(tracks).orderBy(tracks.slug).all()) {
  const tags = tagsFor(t.slug);
  const per: number[] = [], dyn: number[] = [];
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const d = familiesFor(t.slug, l).reduce((s, f) => s + cap(f, l), 0), s = stored.get(`${t.id}:${l}`) ?? 0;
    per.push(s + d); dyn.push(d); cells++;
    if (s + d < min) below++;
  }
  const lowest = Math.min(...per), bad = per.map((n, i) => (n < min ? i + 1 : 0)).filter(Boolean);
  rows.push(`${lowest >= min ? "✓" : "✗"} ${t.slug.padEnd(28)} min ${String(lowest).padStart(5)}  dynamic-only min ${String(Math.min(...dyn)).padStart(5)}  tags [${tags.join(",") || "none"}]${bad.length ? `  short at levels ${bad.join(",")}` : ""}`);
}
console.log(rows.join("\n"));
console.log(`\n${cells - below}/${cells} track-levels have ${min}+ distinct questions (${below} below).`);
if (arg("fail") && below) process.exit(1);

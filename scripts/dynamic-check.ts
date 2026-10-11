/**
 * Self-test for the dynamic question families. For every family and a spread of levels it checks that:
 *  - drafts finalize into four distinct options with the answer among them,
 *  - the stated answer matches what real execution produces (node, python, php, sqlite3, git, semver, tsc),
 *  - each family has enough distinct prompts at every level it claims.
 * Usage: tsx scripts/dynamic-check.ts [familyPrefix] [samplesPerLevel]
 */
import { FAMILIES } from "@/lib/dynamic/families";
import { distinctPrompts, finalize } from "@/lib/dynamic/engine";
import { rng } from "@/lib/dynamic/rng";
import { verify } from "@/lib/dynamic/verify";

const only = process.argv[2] ?? "", samples = Number(process.argv[3] ?? 6);
let bad = 0, checked = 0, unverified = 0;
const rejected = new Map<string, [number, number]>(); // generators may reject a draw (the engine retries); too many rejections is a problem
for (const fam of FAMILIES.filter((f) => f.id.startsWith(only))) {
  const lv = [...new Set([fam.levels[0], Math.ceil((fam.levels[0] + fam.levels[1]) / 2), fam.levels[1]])];
  for (const level of lv) {
    for (let i = 0; i < samples; i++) {
      const r = rng(`check:${fam.id}:${level}:${i}`);
      let d;
      const tally = rejected.get(fam.id) ?? [0, 0];
      rejected.set(fam.id, tally); tally[1]++;
      try { d = fam.make(r, level); } catch { tally[0]++; continue; }
      const g = finalize(r, fam.id, d);
      checked++;
      if (!g) { bad++; console.log(`✗ ${fam.id} L${level} fewer than 3 distinct wrong answers\n  ${d.prompt}\n  correct=${d.correct} wrong=${JSON.stringify(d.wrong)}`); continue; }
      if (!g.options.some((o) => o.key === g.answer && o.text === d.correct)) { bad++; console.log(`✗ ${fam.id} answer key mismatch`); continue; }
      if (!d.verify) { unverified++; continue; }
      const err = verify(d.verify);
      if (err) { bad++; console.log(`✗ ${fam.id} L${level}: ${err}\n  ${d.prompt}\n${d.code ?? ""}`); }
    }
  }
}
for (const [id, [rej, all]] of rejected) if (rej / all > 0.4) { bad++; console.log(`✗ ${id} rejects ${rej}/${all} draws`); }
console.log(`\n${checked} questions checked, ${unverified} without an execution check, ${bad} problems`);
console.log("\nfamily capacity (distinct prompts out of 400 samples, min over claimed levels):");
for (const fam of FAMILIES.filter((f) => f.id.startsWith(only))) {
  let min = Infinity;
  for (let level = fam.levels[0]; level <= fam.levels[1]; level++) min = Math.min(min, distinctPrompts(fam, level));
  console.log(`${min < 60 ? "⚠" : " "} ${fam.id.padEnd(22)} L${fam.levels[0]}-${fam.levels[1]}  ${min}`);
}
process.exit(bad ? 1 : 0);

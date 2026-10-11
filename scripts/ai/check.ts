/** npx tsx scripts/ai/check.ts [slug...]   validates data files: pool size, per-level counts, warnings, samples */
import fs from "node:fs";
import path from "node:path";
import { generate, levelOf, LEVEL_COUNT, MIN_PER_LEVEL } from "./engine";
import type { TrackSpec } from "./types";

const dir = path.join(__dirname, "data");
const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sample = process.argv.includes("--sample");
(async () => {
  let bad = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
    const slug = f.replace(".ts", "");
    if (want.length && !want.includes(slug)) continue;
    const spec: TrackSpec = (await import(path.join(dir, f))).default;
    const { qs, pool, warnings } = generate(spec);
    const per = Array(LEVEL_COUNT).fill(0);
    qs.forEach((_, i) => per[levelOf(i, qs.length) - 1]++);
    const min = Math.min(...per);
    const forms: Record<string, number> = {};
    qs.forEach((q) => (forms[q.form] = (forms[q.form] ?? 0) + 1));
    const ok = min >= MIN_PER_LEVEL && spec.slug === slug;
    if (!ok) bad++;
    console.log(`${ok ? "OK  " : "FAIL"} ${slug}: ${spec.cards.length} cards, ${spec.qa?.length ?? 0} qa -> pool ${pool}, kept ${qs.length}, min/level ${min}`);
    if (spec.slug !== slug) console.log(`  slug "${spec.slug}" must equal file name`);
    if (!ok || sample) console.log("  forms:", JSON.stringify(forms));
    for (const w of warnings.slice(0, 12)) console.log("  warn:", w);
    if (sample) for (const i of [0, 400, 900, 1400, 1900].map((x) => Math.min(x, qs.length - 1))) { const q = qs[i]; console.log(`  L${levelOf(i, qs.length)} [${q.form}] ${q.prompt}\n    ✓ ${q.options[q.correct]}\n    ✗ ${q.options.filter((_, k) => k !== q.correct).join(" | ")}`); }
  }
  process.exit(bad ? 1 : 0);
})();

/** npx tsx scripts/ai/check.ts [--cards] [slug...]   validates data files: pool size, per-level counts, warnings, samples */
import { generate, levelOf, LEVEL_COUNT } from "./engine";
import { loadSpecs, minPerLevelFor } from "./specs";

const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sample = process.argv.includes("--sample");
(async () => {
  let bad = 0;
  for (const { slug, spec, origin } of await loadSpecs(process.argv.includes("--cards") ? "cards" : "ts", want)) {
    const { qs, pool, warnings } = generate(spec);
    // `use` is spliced after "when you" / "You", and `says` after the subject, so each must start with a verb, not a noun phrase
    for (const k of spec.cards) {
      if (k.use && /^(a|an|the|there|it|they|this|that|some|your|our|my|their|no|each|every|any|one|two|three)\b/i.test(k.use.trim())) warnings.push(`card "${k.subject}": use must start with a verb ("need...", "want...", "are asked to..."): "${k.use}"`);
      k.says.forEach((p) => { if (/^[A-Z]/.test(p.trim()) && !/^(I|API|AI|CI|CD|HR)\b/.test(p.trim())) warnings.push(`card "${k.subject}": says should start lower-case with a verb: "${p}"`); });
    }
    const per = Array(LEVEL_COUNT).fill(0);
    qs.forEach((_, i) => per[levelOf(i, qs.length) - 1]++);
    const min = Math.min(...per);
    const forms: Record<string, number> = {};
    qs.forEach((q) => (forms[q.form] = (forms[q.form] ?? 0) + 1));
    const ok = min >= minPerLevelFor(spec, origin) && spec.slug === slug;
    if (!ok) bad++;
    console.log(`${ok ? "OK  " : "FAIL"} ${slug}: ${spec.cards.length} cards, ${spec.qa?.length ?? 0} qa -> pool ${pool}, kept ${qs.length}, min/level ${min}`);
    if (spec.slug !== slug) console.log(`  slug "${spec.slug}" must equal file name`);
    if (!ok || sample) console.log("  forms:", JSON.stringify(forms));
    for (const w of warnings.slice(0, 12)) console.log("  warn:", w);
    if (sample) for (const i of [0, 400, 900, 1400, 1900].map((x) => Math.min(x, qs.length - 1))) { const q = qs[i]; console.log(`  L${levelOf(i, qs.length)} [${q.form}] ${q.prompt}\n    ✓ ${q.options[q.correct]}\n    ✗ ${q.options.filter((_, k) => k !== q.correct).join(" | ")}`); }
  }
  process.exit(bad ? 1 : 0);
})();

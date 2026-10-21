/**
 * Turns the drafted learning content in content/review/business-stops/*.json into readable review packs, one per kind of reviewer:
 *   npm run review:packs            writes content/review/packs/*.md
 *   npm run review:packs -- --check exits non-zero if the packs are out of date with the JSON (nothing is written)
 *
 * The JSON is the source of truth. A pack is a generated handout: a person who does the work (an accountant, an HR adviser, a solicitor)
 * should not have to read JSON to say whether a passage is right. Edit the JSON (or apply their notes to it), then run this again.
 */
import fs from "node:fs";
import path from "node:path";
import { MAPS } from "../lib/lifecycle/maps";

type Q = { level: number; prompt: string; options: { key: string; text: string }[]; answer: string };
type Item = { title: string; stop: string; body: string; questions: Q[] };
type File = { trackSlug: string; items: Item[] };

/** Who should check an item: the stop's id decides. Anything not listed goes to the business practitioner. */
const GROUPS: { id: string; file: string; title: string; who: string; stops: string[] }[] = [
  { id: "accountant", file: "1-accountant-or-bookkeeper.md", title: "Accountant or bookkeeper", who: "someone who keeps small-business books and does tax and payroll for a living",
    stops: ["books", "taxrun", "tax", "insolv", "creditors", "payroll", "annual", "approvals"] },
  { id: "hr", file: "2-hr-or-employment-adviser.md", title: "HR or employment adviser", who: "someone who advises small employers on hiring, pay, contracts, performance and dismissal",
    stops: ["employlaw", "hrproc", "payreview", "recruit", "paysetup", "stress", "delegate", "culture", "growteam", "tellteam", "succession"] },
  { id: "solicitor", file: "3-solicitor.md", title: "Solicitor or legal adviser", who: "a solicitor who advises small businesses and charities",
    stops: ["contractrev", "ipdeep", "register", "legalclose", "dissolve", "trustees", "family", "franch"] },
  { id: "compliance", file: "4-compliance-safety-or-trade-adviser.md", title: "Compliance, safety or trade adviser", who: "someone who advises on health and safety, product safety, licences, accessibility, or customs and shipping",
    stops: ["safety", "prodsafe", "licence", "access", "trade"] },
];
const PRACTITIONER = { id: "practitioner", file: "5-business-practitioner.md", title: "Business practitioner (sales, marketing, operations, strategy)", who: "someone who has run or advised small businesses day to day" };

const root = path.join(process.cwd(), "content", "review");
const dir = path.join(root, "business-stops"), out = path.join(root, "packs");
const files: { file: string; track: string; item: Item }[] = [];
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as File;
  for (const item of j.items) files.push({ file: f, track: j.trackSlug, item });
}
const names = new Map(MAPS.business.STATIONS.map((s) => [s.id, s.name]));
const groupOf = (stop: string) => GROUPS.find((g) => g.stops.includes(stop)) ?? PRACTITIONER;
const byGroup = new Map<string, typeof files>();
for (const x of files) byGroup.set(groupOf(x.item.stop).id, [...(byGroup.get(groupOf(x.item.stop).id) ?? []), x]);

const box = "☐";
const pack = (g: { id: string; title: string; who: string }, items: typeof files): string => {
  const lines: string[] = [];
  lines.push(`# Review pack: ${g.title}`, "");
  lines.push(`**For:** ${g.who}.  **Items:** ${items.length}.  **Questions:** ${items.reduce((n, x) => n + x.item.questions.length, 0)}.`, "");
  lines.push("## What this is", "");
  lines.push("A learning app for small businesses has a map of everything a business does, and each step (a \"stop\") has a learning track. These are **drafts** that an AI assistant wrote for steps where the app has little or no teaching material. **Nothing here is live.** Please read each one as someone who does this work, and say whether it is right.", "");
  lines.push("They were written from general UK small-business knowledge, **not from cited documents**, so treat every fact as unchecked. Rules, thresholds and deadlines change, and some are different outside the UK.", "");
  lines.push("## How to review", "");
  lines.push("For each item, read the passage, then the questions. Tick the boxes, and write corrections in the spaces or straight onto the text. You do not need to fix everything; a note such as \"wrong: the limit is X\" is enough.", "");
  lines.push(`- ${box} **Accurate.** Is every statement in the passage true, and current?`);
  lines.push(`- ${box} **UK only?** Would any of it be wrong or misleading outside the UK? Say which part.`);
  lines.push(`- ${box} **Clear.** Would a small-business owner who knows nothing about this follow it?`);
  lines.push(`- ${box} **Questions.** One clearly right answer, supported by the passage? Are the wrong answers plausible rather than silly?`);
  lines.push(`- ${box} **Source.** Write down the real source you checked it against (a GOV.UK page, a regulator's guidance). The app needs one before this goes live.`, "");
  lines.push("**Verdict for each item:** Approve / Approve with changes / Reject. A \"Reject\" with a reason is as useful as an approval.", "");
  lines.push("---", "");
  items.forEach(({ track, item }, i) => {
    lines.push(`## ${i + 1}. ${item.title}`, "");
    lines.push(`*Step on the map:* ${names.get(item.stop) ?? item.stop}  ·  *Learning track:* \`${track}\`  ·  *Id:* \`${item.stop}\``, "");
    lines.push("### The passage", "", ...item.body.split("\n").map((l) => `> ${l}`), "");
    lines.push("### The questions", "");
    item.questions.forEach((q, n) => {
      lines.push(`**Question ${n + 1}** (difficulty level ${q.level} of 20): ${q.prompt}`, "");
      for (const o of q.options) lines.push(`- ${o.key}) ${o.text}${o.key === q.answer ? "  **← marked as the right answer**" : ""}`);
      lines.push("", `${box} clear  ${box} one right answer  ${box} wrong answers plausible   Notes: ________________________________`, "");
    });
    lines.push("### Your review", "");
    lines.push(`${box} Accurate  ${box} UK only  ${box} Clear   **Verdict:** ${box} Approve  ${box} Approve with changes  ${box} Reject`, "");
    lines.push("Corrections and notes: ________________________________________________________________", "");
    lines.push("Source checked (name or link): ____________________________________________________________", "", "---", "");
  });
  return lines.join("\n");
};

const readme = (): string => {
  const rows = [...GROUPS, PRACTITIONER].map((g) => `| [${g.title}](${g.file}) | ${(byGroup.get(g.id) ?? []).length} | ${(byGroup.get(g.id) ?? []).reduce((n, x) => n + x.item.questions.length, 0)} |`);
  return [
    "# Review packs", "",
    "Readable handouts for checking the drafted learning content in `business-stops/`, one per kind of reviewer, so nobody has to read JSON. **Generated** by `npm run review:packs`; do not edit these files by hand, edit the JSON and run it again.", "",
    "| Pack | Items | Questions |", "|---|---|---|", ...rows, "",
    `**Total:** ${files.length} items, ${files.reduce((n, x) => n + x.item.questions.length, 0)} questions. Every item is in exactly one pack.`, "",
    "## What happens with the feedback", "",
    "1. Reviewers tick, mark up or comment on the pack for their field (print it, edit the Markdown, or send notes).",
    "2. Someone applies the corrections to the matching JSON file in `business-stops/`, replaces each item's `source` with the real source the reviewer named, and runs `npm run check:review` and `npm run review:packs`.",
    "3. Once an item is approved, import its file (`npm run import:knowledge -- content/review/business-stops/<track>.json`). Because files say `\"status\": \"review\"`, the questions are saved **unpublished** until an admin activates them in the question bank. Run it against a copy of the data first if you want to try it.",
    "4. Move approved files out of `content/review/`, then `npm run report:coverage -- --write` so the stop cards show the new coverage.", "",
    "Nothing in this folder is live, and nothing here is advice: these are teaching drafts, not professional guidance.", "",
  ].join("\n");
};

const wanted = new Map<string, string>();
for (const g of [...GROUPS, PRACTITIONER]) wanted.set(g.file, pack(g, byGroup.get(g.id) ?? []));
wanted.set("README.md", readme());

// every item in exactly one pack
const seen = files.map((x) => x.item.stop), dup = seen.filter((s, i) => seen.indexOf(s) !== i);
if (dup.length) { console.error(`item(s) listed twice across the JSON files: ${dup.join(", ")}`); process.exit(1); }
const placed = [...GROUPS.flatMap((g) => g.stops)].filter((s) => !seen.includes(s));
if (placed.length) console.warn(`note: these stops are assigned to a reviewer but have no draft: ${placed.join(", ")}`);

if (process.argv.includes("--check")) {
  const stale = [...wanted].filter(([f, text]) => !fs.existsSync(path.join(out, f)) || fs.readFileSync(path.join(out, f), "utf8") !== text).map(([f]) => f);
  const extra = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => f.endsWith(".md") && !wanted.has(f)) : [];
  if (stale.length || extra.length) { console.error(`review packs are out of date (${[...stale, ...extra.map((f) => `${f} (no longer generated)`)].join(", ")}); run npm run review:packs`); process.exit(1); }
  console.log(`review packs are up to date (${wanted.size} files)`);
} else {
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out).filter((n) => n.endsWith(".md") && !wanted.has(n))) fs.rmSync(path.join(out, f));
  for (const [f, text] of wanted) fs.writeFileSync(path.join(out, f), text);
  console.log(`wrote ${wanted.size} files to ${path.relative(process.cwd(), out)}: ` + [...GROUPS, PRACTITIONER].map((g) => `${g.id} ${(byGroup.get(g.id) ?? []).length}`).join(", "));
}

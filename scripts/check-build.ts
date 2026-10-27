/** Checks the Build & launch programme (content/build): npm run check:build. Needs no database. */
import { RANKS } from "../content/build/steps";
import { TEMPLATES } from "../content/build/projects";
import { PRACTICAL, practicalFor } from "../content/build/stops";
import { RAW } from "../lib/lifecycle/data";
import { matchFiles, parseRepo, parseSite, isPrivateIp } from "../lib/build/github";

let fails = 0;
const check = (name: string, ok: boolean, more = "") => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && more ? `: ${more}` : ""}`); };

const steps = RANKS.flatMap((r) => r.stages.flatMap((s) => s.steps));
const keys = steps.map((s) => s.key);
check("there are six ranks", RANKS.length === 6);
check("step keys are unique", new Set(keys).size === keys.length, keys.filter((k, i) => keys.indexOf(k) !== i).join(", "));
check("every rank has stages and every stage has steps", RANKS.every((r) => r.stages.length > 0 && r.stages.every((s) => s.steps.length > 0)));
check("every step says why, and what to do", steps.every((s) => s.why.length > 20 && s.doIt.length >= 1 && s.title.length > 3), steps.filter((s) => s.why.length <= 20 || !s.doIt.length).map((s) => s.key).join(", "));
const known = /\{(name|pitch|customer|mvp|stack|agent|launch)\}/g;
const text = (s: (typeof steps)[number]) => [s.title, s.why, ...s.doIt, s.prompt ?? ""].join("\n");
check("only known {placeholders} are used", steps.every((s) => (text(s).replace(known, "").match(/\{[a-z]+\}/g) ?? []).length === 0), steps.filter((s) => (text(s).replace(known, "").match(/\{[a-z]+\}/g) ?? []).length).map((s) => s.key).join(", "));
check("a prompt is given for most steps that produce a file", steps.filter((s) => s.check.kind === "files" && !s.prompt).length <= 6);
check("self-ticked steps ask for a sensible note length", steps.every((s) => s.check.kind !== "self" || (s.check.min >= 40 && s.check.min <= 300)));
check("there are only a few self-ticked steps, so GitHub proves most of the work", steps.filter((s) => s.check.kind === "self").length <= 4);
check("templates have unique slugs and include a custom one", new Set(TEMPLATES.map((t) => t.slug)).size === TEMPLATES.length && TEMPLATES.some((t) => t.slug === "custom"));
check("every template has a first version, a stack, an agent and a launch place", TEMPLATES.every((t) => t.mvp.length >= 2 && t.stack && t.agent && t.launch));

// the file checks, tried against a repository that has done everything and one that has done nothing
const full = steps.flatMap((s) => (s.check.kind === "files" ? [s.check] : []));
const sample = [
  "README.md", "AGENTS.md", "docs/01-problem.md", "docs/02-mvp.md", "docs/research/interview-1.md", "docs/research/interview-2.md", "docs/research/interview-3.md",
  "docs/03-prd.md", "docs/04-architecture.md", "design/home.png", "design/wireframes.md", "docs/05-design-system.md", "docs/06-brand.md", "public/logo.svg", "docs/ai-log.md",
  "docs/07-agent.md", "evals/cases.jsonl", "evals/run.py", "docs/08-agent-safety.md", "tests/a.test.ts", "tests/b.test.ts", "src/c.spec.ts", ".env.example", ".github/dependabot.yml",
  ".github/workflows/codeql.yml", "docs/09-threat-model.md", "SECURITY.md", "docs/10-runbook.md", "docs/11-launch-plan.md", "docs/launch/hn.md", "docs/launch/reddit.md",
  "docs/12-sales.md", "docs/sales/outreach-log.md", "docs/13-metrics.md", "docs/14-case-study.md",
  "docs/15-data-privacy.md", "docs/16-migration.md", "docs/17-access-review.md", "docs/18-compliance-pack.md", "docs/19-budget.md", "docs/20-risk-register.md", "docs/21-vendors.md",
  "docs/22-governance.md", "docs/23-sustainability.md", "openapi.yaml", "docs/24-retirement.md",
].map((path) => ({ path, size: 5000 }));
const unmatched = full.filter((c) => matchFiles(sample, c.glob, c.minBytes ?? 0).length < (c.min ?? 1));
check("a repository that follows every step satisfies every file check", unmatched.length === 0, unmatched.map((c) => c.glob).join(" | "));
check("an empty repository satisfies none", full.every((c) => matchFiles([], c.glob).length === 0));
check("a stub file does not count", matchFiles([{ path: "docs/01-problem.md", size: 10 }], "docs/01-problem.md", 400).length === 0);
check("README matching ignores case", matchFiles([{ path: "readme.md", size: 900 }], "README.md", 600).length === 1);
check("** may match no folder, and * never crosses one", matchFiles([{ path: "public/logo.svg", size: 500 }], "{public,assets}/**/*logo*").length === 1 && matchFiles([{ path: "docs/a/b.md", size: 500 }], "docs/*.md").length === 0);

// what goes in a request address
check("repository names are read from addresses", parseRepo("https://github.com/moktermd08/gglearn.git") === "moktermd08/gglearn" && parseRepo("owner/name") === "owner/name" && parseRepo("https://github.com/o/n/issues") === "o/n" && parseRepo("https://www.github.com/o/n/") === "o/n");
check("anything odd is refused as a repository", ["", "a", "a/b/c/d", "../x", "a/..", "a b/c", "-a/b", "a/b?x=1&y=2"].every((s) => { const r = parseRepo(s); return r === null || /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r); }) && parseRepo("../x") === null && parseRepo("a/..") === null);
check("live addresses must be https on a real host", !!parseSite("https://my-app.example.com/x") && ["http://a.com", "https://localhost", "https://127.0.0.1", "https://a.com:8080", "https://u:p@a.com", "https://intranet", "https://[::1]/", "javascript:alert(1)", "https://x.local"].every((s) => parseSite(s) === null));
check("private network addresses are recognised", ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1", "100.64.0.1"].every(isPrivateIp) && !isPrivateIp("93.184.216.34") && !isPrivateIp("2606:4700::1111"));

// the stops of the software map that a step makes you do for real
const stopIds = Object.values(RAW).flat().map((r) => r[0]);
const unknownStops = PRACTICAL.flatMap(([, , ids]) => ids).filter((id) => !stopIds.includes(id));
check("every step named in stops.ts exists", PRACTICAL.every(([k]) => keys.includes(k)), PRACTICAL.filter(([k]) => !keys.includes(k)).map(([k]) => k).join(", "));
check("every stop named in stops.ts is on the software map", unknownStops.length === 0, unknownStops.join(", "));
check("every step is linked from at least one stop", keys.every((k) => PRACTICAL.some(([s]) => s === k)), keys.filter((k) => !PRACTICAL.some(([s]) => s === k)).join(", "));
const uncovered = stopIds.filter((id) => practicalFor(id).length === 0);
console.log(`info ${stopIds.length - uncovered.length} of ${stopIds.length} software-map stops have a practical step; not yet: ${uncovered.join(" ")}`);
check("every stop on the software map has a practical step", uncovered.length === 0, uncovered.join(" "));

console.log(fails ? `\n${fails} check(s) failed` : `\nall good: ${steps.length} steps in ${RANKS.length} ranks, ${TEMPLATES.length} starting points`);
process.exit(fails ? 1 : 0);

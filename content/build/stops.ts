/**
 * Which stops of the software map (lib/lifecycle/software.ts) a Build & launch step makes you do for real.
 * [step key in steps.ts, short label for the stop's "Do it for real" link, stop ids]. A stop may appear under several steps.
 * Kept free of imports so the map can load it without the whole curriculum; `npm run check:build` checks every key and stop id,
 * and lists the stops no step covers yet (those are the next practical steps to write).
 */
export const PRACTICAL: [step: string, label: string, stops: string[]][] = [
  ["problem", "Write the problem in one page", ["idea", "goals", "icp", "valueprop"]],
  ["interviews", "Talk to three real people", ["market", "research", "personas", "journeys", "stake", "blueprint"]],
  ["scope", "Fix the smallest first version", ["feas", "bizcase", "roadmap", "method", "dplan"]],
  ["repo", "Create the repository", ["repo", "devenv"]],
  ["readme", "Write a README", ["readme", "kb", "docstd", "gloss", "userguide"]],
  ["license", "Choose a licence", ["licence"]],
  ["ai-rules", "Write rules for your AI tool", ["standards", "aiuse"]],
  ["first-commits", "Make small commits", ["skeleton"]],
  ["prd", "Write the product requirements", ["accept", "nfr", "secreq", "content"]],
  ["backlog", "Turn the plan into GitHub issues", ["backlog", "resourcing", "team", "burn"]],
  ["architecture", "Sketch the architecture", ["techland", "buildbuy", "context", "solarch", "intmap", "apicon", "stack", "spike", "scaling", "archrev", "target", "adr", "datasrc", "dmodel", "schema", "migplan", "captest"]],
  ["wireframes", "Draw the key screens", ["ia", "wire", "proto", "usability", "hifi"]],
  ["design-system", "Pick colours, type and spacing", ["dsys", "a11yrev", "a11ystmt", "a11ytest", "uxsign"]],
  ["brand", "Write your brand", ["position", "compwatch", "brandvoice"]],
  ["branches", "Merge pull requests", ["frontend", "backend", "codereview", "merge", "bugfix", "refactor", "hotfix"]],
  ["mvp", "Build the first version", ["seed"]],
  ["ai-log", "Keep a log of what the AI got wrong", ["lessons"]],
  ["agent-spec", "Specify your agent", ["aifeat", "modelsel"]],
  ["agent-evals", "Write tests for the AI", ["evalset", "modelval", "training", "drift", "dqmon", "pipelines"]],
  ["agent-safety", "Write down how it could be misused", ["airisk", "dclass", "dpia"]],
  ["tests", "Add automated tests", ["teststrat", "testplan", "testenv", "automation", "unit", "integ", "contract", "regression", "smoke", "perf", "uat"]],
  ["ci", "Run the tests on every push", ["ci", "cd", "envs"]],
  ["review", "Review AI-written code", ["codereview"]],
  ["secrets", "Keep secrets out of the repository", ["secrets", "iam"]],
  ["dependabot", "Get warned about unsafe dependencies", ["deps", "sbom", "vulnwatch"]],
  ["scan", "Scan the code for vulnerabilities", ["sast", "dast", "pentest"]],
  ["threat", "Write a threat model", ["threat", "secdesign", "regscan"]],
  ["security-md", "Tell people how to report a problem", ["secinc", "evidence", "audit"]],
  ["deploy", "Deploy it", ["hosting", "iac", "staging", "flags", "proddeploy", "relplan", "changereq"]],
  ["release", "Publish a release", ["relnotes"]],
  ["runbook", "Write the runbook", ["runbooks", "rollback", "obs", "monitor", "incident", "slo", "hypercare", "servicedesk", "backup", "patching", "sunset", "decomplan", "shutdown"]],
  ["launch-plan", "Write the launch plan", ["gtm", "funnel", "contentplan", "paidsocial", "emailseq"]],
  ["discoverable", "Make the repository easy to find", ["landing", "leadcapture"]],
  ["launch-posts", "Write your launch posts", ["launch"]],
  ["sales", "Write your pitch and your price", ["pricing", "playbook", "salesen", "crm", "pipeline", "renewal"]],
  ["outreach", "Contact ten real people", ["calls", "beta"]],
  ["first-user", "Get your first real user", ["onboard"]],
  ["feedback", "Turn feedback into issues", ["feedback", "health", "uxiter"]],
  ["metrics", "Decide what you measure", ["kpi", "analytics", "benefits"]],
  ["v1", "Publish a second release", ["techdebt"]],
  ["logo", "Make a logo and icon", ["hifi"]],
  ["env-example", "Document the settings", ["envs", "devenv"]],
  ["data-privacy", "Write how you handle personal data", ["sar", "retain", "sanitise", "dclass"]],
  ["data-migration", "Plan and rehearse a migration and restore", ["dmig", "replat", "migplan", "backup"]],
  ["access-review", "Review who can get in", ["recert", "iam"]],
  ["compliance-pack", "Collect your evidence in one place", ["accred", "evidence", "audit"]],
  ["budget", "Write the budget and running costs", ["fund", "spend", "budget", "opbudget", "cloudcost", "finops"]],
  ["risks", "Keep a risk register", ["risk"]],
  ["vendors", "Choose and review your suppliers", ["vendorsel", "contracts", "vendorrev", "exit"]],
  ["governance", "Say who decides, and when you stop", ["sponsor", "serviceassess", "stagegate", "board"]],
  ["sustainability", "Think about its footprint", ["sustain"]],
  ["api-docs", "Document your API", ["apidocs", "apicon"]],
  ["retirement", "Plan how it ends", ["archive", "custnotice", "decomplan", "shutdown", "sunset"]],
  ["case-study", "Write the case study", ["board", "stagegate"]],
];

export type Practical = { step: string; label: string };

const BY_STOP = new Map<string, Practical[]>();
for (const [step, label, stops] of PRACTICAL) for (const id of stops) BY_STOP.set(id, [...(BY_STOP.get(id) ?? []), { step, label }]);

/** The steps that make you do this stop of the software map for real; empty when none does yet. */
export const practicalFor = (stopId: string): Practical[] => BY_STOP.get(stopId) ?? [];

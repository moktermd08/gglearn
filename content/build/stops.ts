/**
 * Which stops of the software map (lib/lifecycle/software.ts) a Build & launch step makes you do for real.
 * [step key in steps.ts, short label for the stop's "Do it for real" link, stop ids]. A stop may appear under several steps.
 * Kept free of imports so the map can load it without the whole curriculum; `npm run check:build` checks every key and stop id,
 * and lists the stops no step covers yet (those are the next practical steps to write).
 */
type Row = [step: string, label: string, stops: string[]];

const SOFTWARE: Row[] = [
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


/** The business map (lib/lifecycle/business.ts). Most stops are answered by the Operator rank in packs.ts. */
const BUSINESS: Row[] = [
  ["problem", "Write the problem in one page", ["idea", "icp", "promise", "mission"]],
  ["interviews", "Talk to three real people", ["market", "talk", "test", "research"]],
  ["scope", "Fix the smallest first version", ["model"]],
  ["brand", "Write your brand", ["brand", "offer", "rivals"]],
  ["launch-plan", "Write the launch plan", ["launchplan", "channels", "content"]],
  ["launch-posts", "Write your launch posts", ["open", "social"]],
  ["discoverable", "Make the repository easy to find", ["site", "leads"]],
  ["sales", "Write your pitch and your price", ["sales", "pricing", "pmodels", "crm"]],
  ["first-user", "Get your first real user", ["first", "onboard"]],
  ["feedback", "Turn feedback into issues", ["feedback", "cfeed", "reviews", "improve"]],
  ["metrics", "Decide what you measure", ["tracking", "dash", "datask"]],
  ["threat", "Write a threat model", ["secbasics", "cyber"]],
  ["data-privacy", "Write how you handle personal data", ["dataprot", "custdata"]],
  ["data-migration", "Plan and rehearse a migration and restore", ["backups"]],
  ["deploy", "Deploy it", ["domain"]],
  ["architecture", "Sketch the architecture", ["tools", "systems"]],
  ["ai-rules", "Write rules for your AI tool", ["aiwork"]],
  ["runbook", "Write the runbook", ["upkeep"]],
  ["v1", "Publish a second release", ["growsys"]],
  ["ci", "Run the tests on every push", ["automate"]],
  ["risks", "Keep a risk register", ["unknowns", "risks"]],
  ["governance", "Say who decides, and when you stop", ["decide", "decisions", "approvals", "readiness", "board", "policies"]],
  ["compliance-pack", "Collect your evidence in one place", ["compliance", "rules", "records"]],
  ["sustainability", "Think about its footprint", ["esg"]],
  ["case-study", "Write the case study", ["lessons", "finalrep"]],
  ["vendors", "Choose and review your suppliers", ["suppliers", "supreview"]],
  ["retirement", "Plan how it ends", ["wind", "close", "retire", "deleteacc", "archive", "legalclose", "dissolve", "finalacc", "creditors"]],
  ["budget", "Write the budget and running costs", ["startcost", "budget", "growbudget"]],
  ["legal-setup", "Set up the business legally", ["rules", "structure", "register", "tax", "trademark", "licence", "insure", "protect", "ip", "ipdeep"]],
  ["contracts-terms", "Write your terms and contracts", ["terms", "contracts", "contractrev", "ethics"]],
  ["quality-safety", "Set quality, safety and service standards", ["std", "quality", "qcheck", "dry", "prodsafe", "safety", "access", "qms"]],
  ["money-setup", "Set up how money moves", ["startcost", "funding", "bank", "payonline", "books", "invoice", "taxrun", "records"]],
  ["cash-numbers", "Plan and watch your cash", ["forecast", "cashplan", "cashwatch", "numbers", "profit", "adnum", "growbudget", "insolv", "value", "invest"]],
  ["team-plan", "Plan the team and hiring", ["skills", "roles", "hire", "recruit", "paysetup", "payroll", "employlaw", "growteam", "leaders"]],
  ["team-life", "Look after the team", ["induct", "train", "rota", "perf", "payreview", "wellbeing", "culture", "tellteam", "delegate", "hrproc", "stress"]],
  ["customer-care", "Look after your customers", ["support", "complaints", "keep", "referrals", "keyacc", "research", "servskill", "notice"]],
  ["operations", "Run the day-to-day", ["premises", "suppliers", "stock", "process", "orders", "delivery", "daily", "stockctl", "capacity", "scaleops", "projects", "trade"]],
  ["offer-range", "Shape and grow what you sell", ["design", "pilot", "launchoffer", "newoffers", "range", "ads", "partners", "newmkts", "sellskills", "negotiate", "tender", "salesteam", "franch"]],
  ["leadership-rhythm", "Set your rhythm and your plan", ["mission", "model", "plan", "goals", "swot", "growopts", "exitopts", "milestones", "rhythm", "weekly", "priorities", "comms", "advisers", "policies", "annual", "review", "perfrep", "succession", "family", "trustees", "govup", "strategy", "board", "lessons", "finalrep"]],
];

/** The public-sector map (lib/lifecycle/public.ts). Most stops are answered by the Public service rank in packs.ts. */
const PUBLIC: Row[] = [
  ["policy-case", "Set out the need, powers and outcomes", ["need", "evidence", "powers", "outcomes", "options", "scope", "impact", "pilot", "outcomemon", "evaluate", "decide", "endmandate", "futureopts"]],
  ["users-inclusion", "Design for everyone who must use it", ["users", "research", "inclusion", "codesign", "journey", "startuse", "support", "feedback", "complaints", "satisfaction", "excluded", "tellusers", "usertest"]],
  ["service-standard", "Deliver through discovery, alpha, beta and live", ["sowner", "discovery", "alpha", "ways", "design", "beta", "opsready", "golive", "run", "improve", "change", "perf", "continuity", "pir", "lessons", "transfer", "handover"]],
  ["commissioning", "Commission and buy what you need", ["needs", "marketeng", "route", "spec", "tender", "social", "award", "contract", "mobilise", "supplier", "contractrev", "extend", "contractexit"]],
  ["public-digital", "Handle digital, data and security", ["datasrc", "datashare", "tech", "standards", "secure", "hosting", "build", "test", "a11ytest", "monitor", "cyber", "dataqual", "opendata", "archive", "switchoff"]],
  ["public-money", "Show the money and the value", ["funding", "cost", "budgetline", "benefits", "case", "afford", "controls", "finprocess", "forecast", "payments", "monthly", "vfm", "realise", "accounts", "closeacc"]],
  ["public-workforce", "Plan the workforce", ["roles", "skills", "recruit", "clearance", "induct", "train", "consultstaff", "rota", "perfsup", "wellbeing", "succession", "redeploy"]],
  ["public-law", "Meet your legal duties", ["legalpowers", "equality", "eia", "dpia", "subsidy", "consultation", "humanrights", "foi", "accessreg", "privacy", "complaintspol", "inforeq", "legalwatch", "records", "legalclose"]],
  ["assurance", "Plan assurance and scrutiny", ["riskreg", "earlyreview", "assureplan", "auditplan", "indep", "delassure", "ready", "scrutiny", "extaudit", "assurebenefits", "closeassure"]],
  ["public-governance", "Set decision rights and governance", ["sponsor", "pboard", "delegation", "approval", "rhythm", "appetite", "escalate", "report", "briefing", "strategic", "closereport"]],
  ["transparency", "Engage and publish", ["stake", "engageplan", "publishplans", "pubcomms", "announce", "pubperf", "annualrep", "ongoing", "tellpublic"]],
];

/** Per map: [step key, label for the stop's "Do it for real" link, stop ids]. Stops are only looked up in their own map, since ids repeat between maps. */
export const PRACTICAL_BY_MAP: Record<string, Row[]> = { software: SOFTWARE, business: BUSINESS, public: PUBLIC };

export type Practical = { step: string; label: string };

const BY_STOP = new Map<string, Practical[]>();
for (const [map, rows] of Object.entries(PRACTICAL_BY_MAP)) for (const [step, label, stops] of rows) for (const id of stops) BY_STOP.set(`${map}:${id}`, [...(BY_STOP.get(`${map}:${id}`) ?? []), { step, label }]);

/** The steps that make you do this stop for real; empty when none does yet. */
export const practicalFor = (mapId: string, stopId: string): Practical[] => BY_STOP.get(`${mapId}:${stopId}`) ?? [];

import { GATES, LINES as LINE_NAMES, RAW } from "./data";
import { SOFTWARE_PROBLEMS } from "./otherProblems";
import type { LineDef, LineId, MapDef, StageDef, ZoneDef } from "./engine";

/** The software lifecycle: from first idea to shutdown. Edit the stops and gates in data.ts. */

/** Line colours, tuned for the site's light page. */
const COLOUR: Record<LineId, string> = {
  doc: "#c99700", str: "#d22b3c", gtm: "#7aa300", ux: "#7a4cb5", arc: "#0b97a3", dat: "#8a5629",
  eng: "#1d5ec2", qa: "#2b9a4c", sec: "#39465a", ops: "#ec7618", gov: "#d14892",
};

/** What each line is about, in one plain sentence. */
const BLURB: Record<LineId, string> = {
  doc: "Writing things down so anyone can take over.",
  str: "Why we build it, who for, and how it earns its keep.",
  gtm: "Finding customers, winning them, and keeping them.",
  ux: "How it looks, feels and works for real people.",
  arc: "How the pieces fit together.",
  dat: "The information the product keeps, and the AI that learns from it.",
  eng: "Writing the code.",
  qa: "Proving it works before anyone depends on it.",
  sec: "Keeping it safe, legal and trustworthy.",
  ops: "Getting it live and keeping it running.",
  gov: "Money, people, risk and decisions.",
};

/** The seven phases, left to right, with a plain-words subtitle. */
const ZONES: ZoneDef[] = [
  { name: "Discover", sub: "Find the problem", from: -99, to: 5.5 },
  { name: "Define", sub: "Decide what to build", from: 5.5, to: 11.5 },
  { name: "Design", sub: "Plan how", from: 11.5, to: 17.5 },
  { name: "Build", sub: "Make it", from: 17.5, to: 25.5 },
  { name: "Release", sub: "Ship it", from: 25.5, to: 30.5 },
  { name: "Operate", sub: "Run it", from: 30.5, to: 37.5 },
  { name: "Retire", sub: "Switch off safely", from: 37.5, to: 99 },
];

/**
 * Each stop on the map belongs to one of the academy's Software Lifecycle tracks, so a handful of tracks cover every station.
 * A line has a default track; stations listed under OVERRIDES belong to a better-fitting one.
 */
const LINE_DEFAULT: Record<LineId, string> = {
  doc: "tools-plan-design", str: "sdlc-discovery", gtm: "lead-generation-titan", ux: "tools-plan-design", arc: "sdlc-architecture", dat: "sdlc-database",
  eng: "sdlc-backend", qa: "sdlc-testing", sec: "sdlc-security", ops: "sdlc-devops", gov: "delivery-management",
};
const OVERRIDES: Record<string, string[]> = {
  "sdlc-backend": ["apidocs", "intmap", "apicon"],
  "sdlc-devops": ["runbooks"],
  "sdlc-launch": ["relnotes", "userguide", "hypercare"],
  "sdlc-architecture": ["adr"],
  "sdlc-frontend": ["dsys", "hifi", "a11yrev", "uxsign", "a11ystmt", "frontend"],
  "tools-build-ship": ["readme", "devenv", "standards", "repo", "skeleton", "codereview", "merge"],
  "tools-business": ["market", "gtm", "beta", "compwatch", "crm", "pipeline"],
  "lead-generation-titan": ["icp", "funnel", "leadcapture"],
  "brand-positioning-voice": ["position", "brandvoice", "valueprop"],
  "service-design-pricing": ["pricing"],
  "finance-for-leaders": ["budget", "opbudget", "fund", "spend", "bizcase"],
  "risk-resilience-leadership": ["risk"],
  "product-management-core": ["roadmap", "backlog"],
  "tech-strategy-roadmap": ["buildbuy", "techland", "target", "replat"],
  "executive-communication": ["sponsor", "board"],
  "gglink-seo-content": ["contentplan", "landing"],
  "facebook-marketing-titan": ["paidsocial"],
  "communications-email": ["launch", "emailseq", "custnotice"],
  "gglink-sales-support": ["playbook", "salesen", "calls", "onboard", "feedback", "health", "renewal"],
  "governance-compliance": ["archive", "dclass", "dpia", "sar", "retain", "regscan", "evidence", "accred", "audit", "licence", "airisk", "stagegate", "serviceassess", "sustain"],
    "data-analytics": ["kpi", "benefits", "analytics", "uxiter", "pipelines", "dqmon"],
  "ai-llm-practice": ["aiuse", "drift"],
  "llm-fundamentals-titan": ["modelsel"],
  "llm-prompting-titan": ["evalset"],
  "ml-sklearn-titan": ["training"],
  "eval-llm-titan": ["modelval"],
  "rag-pipelines-titan": ["aifeat"],
  "servers-infrastructure": ["scaling", "captest", "hosting", "iac", "envs", "patching", "shutdown", "cloudcost", "finops"],
  "security-operations": ["threat", "secrets", "vulnwatch", "secinc", "recert", "sanitise", "sbom", "deps"],
  "people-operations": ["team", "resourcing"],
};

/** "I work on…": which lines matter most to each kind of person. */
const FOCUS_BASE = [
  { id: "build", label: "Build software", lines: ["arc", "dat", "eng", "qa", "sec", "ops"] },
  { id: "design", label: "Design and content", lines: ["ux", "doc", "str"] },
  { id: "lead", label: "Lead delivery", lines: ["gov", "str", "ops", "arc"] },
  { id: "sell", label: "Market and sell", lines: ["gtm", "str", "ux"] },
  { id: "customers", label: "Customer success", lines: ["gtm", "ops", "doc"] },
  { id: "run", label: "Run and support", lines: ["ops", "doc", "sec"] },
  { id: "secure", label: "Secure and comply", lines: ["sec", "gov", "dat"] },
] as const;

/** Areas that follow a hand-picked set of stops instead of whole lines (a whole line would pull in stops the area never touches). */
const FOCUS_STOPS: Record<string, string[] | undefined> = {
  build: [
    "buildbuy", "nfr", "solarch", "apicon", "stack", "spike", "dmodel", "schema", "migplan", "devenv", "standards", "repo", "skeleton", "frontend", "backend", "codereview", "merge", "bugfix", "deps", "refactor",
    "automation", "unit", "integ", "contract", "regression", "threat", "secrets", "sast", "envs", "ci", "cd", "flags", "adr", "apidocs", "readme",
  ],
  design: ["research", "personas", "journeys", "blueprint", "content", "ia", "wire", "proto", "usability", "dsys", "hifi", "a11yrev", "uxsign", "a11ystmt", "analytics", "uxiter", "gloss", "docstd", "userguide", "brandvoice", "contentplan", "landing"],
  lead: [
    "goals", "bizcase", "roadmap", "backlog", "kpi", "sponsor", "team", "method", "budget", "risk", "resourcing", "dplan", "board", "burn", "stagegate", "lessons", "accept", "uat", "relnotes", "relplan", "changereq", "hypercare", "incident", "slo",
  ],
  run: ["hosting", "iac", "envs", "obs", "proddeploy", "rollback", "hypercare", "servicedesk", "monitor", "incident", "slo", "patching", "backup", "dqmon", "runbooks", "userguide", "captest", "vulnwatch", "secinc", "hotfix", "bugfix", "opbudget", "finops", "cloudcost"],
  secure: [
    "regscan", "threat", "secreq", "airisk", "iam", "secdesign", "secrets", "sbom", "sast", "licence", "dast", "pentest", "evidence", "accred", "vulnwatch", "audit", "secinc", "recert", "sanitise",
    "dclass", "dpia", "sar", "retain", "risk", "serviceassess", "archive", "deps",
  ],
  sell: ["market", "icp", "position", "compwatch", "brandvoice", "valueprop", "funnel", "pricing", "content", "contentplan", "gtm", "landing", "leadcapture", "crm", "playbook", "paidsocial", "launch", "emailseq", "salesen", "calls", "pipeline"],
  customers: ["emailseq", "onboard", "feedback", "health", "renewal", "custnotice", "hypercare", "servicedesk", "incident", "userguide", "runbooks"],
};

/** Where "Take me to my next stop" begins for an area, when nothing is required or in progress. */
const FOCUS_START: Record<string, string | undefined> = { build: "stack", design: "research", lead: "team", run: "obs", secure: "regscan", sell: "icp", customers: "onboard" };

const ROLE_WORDS: [RegExp, string][] = [
  [/secur|compliance|privacy|risk|audit/, "secure"],
  [/design|ux|content|writer|brand|creative|editor/, "design"],
  [/customer|success|account|support/, "customers"],
  [/sales|market|social|growth|business dev|seo/, "sell"],
  [/service|operat|devops|sre|infrastructure/, "run"],
  [/manag|lead|director|cto|head|product|project|delivery|owner|executive|ceo|founder/, "lead"],
  [/develop|engineer|programmer|architect|data|ml|qa|test/, "build"],
];

/** Where a company is, in the order a software company usually passes through. */
const STAGES: StageDef[] = [
  {
    id: "idea", label: "Just an idea", ask: "I have an idea",
    blurb: "Find out whether the problem is real, who has it and whether it can pay for itself, before money goes into building.",
    start: "idea", watch: ["kickoff"], aiFull: false,
    stops: ["idea", "goals", "market", "feas", "bizcase", "fund", "icp", "compwatch", "position", "valueprop", "research", "personas", "sponsor", "budget", "risk", "regscan"],
  },
  {
    id: "build", label: "Building the first version", ask: "I'm building the first version",
    blurb: "Decide what the first version must do, design it, and build only that, with tests and a pipeline you can trust.",
    start: "roadmap", watch: ["reqbase", "designauth", "sprint"], aiFull: true,
    stops: ["roadmap", "backlog", "accept", "wire", "proto", "usability", "techland", "buildbuy", "nfr", "solarch", "stack", "spike", "dmodel", "schema", "threat", "secrets", "dpia", "devenv", "repo", "skeleton", "frontend", "backend", "unit", "codereview", "merge", "ci", "cd", "hosting", "envs", "method", "team", "dplan"],
  },
  {
    id: "launch", label: "Getting first customers", ask: "I'm launching to my first customers",
    blurb: "Release safely, price it, find the first customers, and make sure someone can help them when something breaks.",
    start: "beta", watch: ["gonogo", "live"], aiFull: true,
    stops: ["beta", "uat", "smoke", "relplan", "rollback", "proddeploy", "hypercare", "relnotes", "userguide", "pricing", "gtm", "landing", "leadcapture", "crm", "playbook", "calls", "launch", "onboard", "servicedesk", "monitor", "obs", "backup", "runbooks"],
  },
  {
    id: "grow", label: "Growing", ask: "I have customers and I'm growing",
    blurb: "Keep the customers you have, grow what is working, and keep the service fast and reliable as use rises, without burning cash.",
    start: "kpi", watch: ["live", "change"], aiFull: true,
    stops: ["kpi", "analytics", "uxiter", "funnel", "contentplan", "paidsocial", "emailseq", "salesen", "pipeline", "feedback", "health", "renewal", "scaling", "captest", "perf", "incident", "slo", "bugfix", "deps", "flags", "resourcing", "burn", "opbudget", "cloudcost", "finops"],
  },
  {
    id: "scale", label: "Scaling up and earning trust", ask: "Bigger customers are asking about security",
    blurb: "Prove you can be trusted with other people's data and money: security testing, access control, compliance evidence and a tidier platform.",
    start: "regscan", watch: ["change"], aiFull: true,
    stops: ["regscan", "dclass", "dpia", "sar", "retain", "iam", "secdesign", "sast", "dast", "pentest", "sbom", "licence", "vulnwatch", "secinc", "recert", "evidence", "audit", "accred", "board", "stagegate", "risk", "adr", "archrev", "techdebt", "refactor", "replat", "target", "patching", "vendorrev"],
  },
  {
    id: "wind", label: "Winding down", ask: "I'm retiring a product or closing",
    blurb: "Decide, tell customers, switch off safely, and keep or delete data exactly as the rules require.",
    start: "sunset", watch: ["decom"], aiFull: false,
    stops: ["sunset", "benefits", "lessons", "custnotice", "decomplan", "shutdown", "archive", "retain", "sanitise", "exit", "vendorrev"],
  },
];

const AI_LITE = ["aiuse", "evalset", "airisk", "drift"];
const AI_REVIEW = ["accept", "uat", "risk", "audit"];
const TECH_FAMILIES = new Set(["Engineering", "Data & AI", "IT & Infrastructure"]);
const TECH_ROLES = new Set(["security", "security analyst", "cto", "cio", "ciso", "chief data officer", "accessibility specialist", "data analyst"]);
const AI_FULL_AREAS = new Set<string>(["build", "secure", "run"]);

const lines: LineDef[] = LINE_NAMES.map((l) => ({ id: l.id, name: l.name, row: l.row, hollow: "hollow" in l ? l.hollow : undefined, colour: COLOUR[l.id], blurb: BLURB[l.id], track: LINE_DEFAULT[l.id] }));

export const SOFTWARE_DEF: MapDef = {
  id: "software",
  label: "Software",
  words: {
    kicker: "Idea to shutdown: the software lifecycle, mapped",
    headline: ["See where you are.", "See the way forward."],
    aria: "Software lifecycle map",
    metaTitle: "See where you are, see the way forward: the software lifecycle map — gglearn",
    metaDescription: "Every stage from first idea to final shutdown, drawn as a transit map. Say what you do or where your company is, see your route, and learn each stop.",
    ogKicker: "A route through the software lifecycle",
    routeWord: "a route through the software lifecycle",
    coverage: "This map is about software, delivery and business roles: try one of the areas instead.",
  },
  lines,
  zones: ZONES,
  stations: RAW,
  gates: GATES,
  problems: SOFTWARE_PROBLEMS,
  trackOverrides: OVERRIDES,
  focus: FOCUS_BASE.map((f) => ({ id: f.id, label: f.label, lines: [...f.lines] as LineId[], stops: FOCUS_STOPS[f.id], start: FOCUS_START[f.id], aiFull: AI_FULL_AREAS.has(f.id) })),
  roleWords: ROLE_WORDS,
  stages: STAGES,
  ai: { lite: AI_LITE, review: AI_REVIEW, techFamilies: [...TECH_FAMILIES], techRoles: [...TECH_ROLES] },
};

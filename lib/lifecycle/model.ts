import { GATES, LINES, RAW, type Gate, type LineId, type Scale } from "./data";

export { GATES, LINES };
export type { LineId, Gate };

/* Layout of the map, in SVG units. */
export const U = 96, LEFT = 230, TOP = 170, ROW = 98;
export const W = LEFT + 40 * U + 70, H = TOP + 9 * ROW + 72;
export const px = (x: number) => LEFT + x * U;
export const py = (row: number) => TOP + row * ROW;

export const LINE_BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l])) as Record<LineId, (typeof LINES)[number]>;

/** Line colours, tuned for the site's light page. */
export const LINE_COLOUR: Record<LineId, string> = {
  doc: "#c99700", str: "#d22b3c", gtm: "#7aa300", ux: "#7a4cb5", arc: "#0b97a3", dat: "#8a5629",
  eng: "#1d5ec2", qa: "#2b9a4c", sec: "#39465a", ops: "#ec7618", gov: "#d14892",
};

/** What each line is about, in one plain sentence. */
export const LINE_BLURB: Record<LineId, string> = {
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
export const ZONES = [
  { name: "Discover", sub: "Find the problem", from: -99, to: 5.5 },
  { name: "Define", sub: "Decide what to build", from: 5.5, to: 11.5 },
  { name: "Design", sub: "Plan how", from: 11.5, to: 17.5 },
  { name: "Build", sub: "Make it", from: 17.5, to: 25.5 },
  { name: "Release", sub: "Ship it", from: 25.5, to: 30.5 },
  { name: "Operate", sub: "Run it", from: 30.5, to: 37.5 },
  { name: "Retire", sub: "Switch off safely", from: 37.5, to: 99 },
] as const;
export const zoneOf = (x: number) => ZONES.findIndex((z) => x >= z.from && x < z.to);

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
  "gglink-seo-content": ["contentplan", "landing"],
  "facebook-marketing-titan": ["paidsocial"],
  "communications-email": ["launch", "emailseq", "custnotice"],
  "gglink-sales-support": ["playbook", "salesen", "calls", "onboard", "feedback", "health", "renewal"],
  "governance-compliance": ["archive", "dclass", "dpia", "sar", "retain", "regscan", "evidence", "accred", "audit", "licence", "airisk", "board", "stagegate", "serviceassess", "risk", "sustain"],
    "data-analytics": ["kpi", "benefits", "analytics", "uxiter", "pipelines", "dqmon"],
  "ai-llm-practice": ["aiuse", "modelsel", "evalset", "training", "modelval", "drift", "aifeat"],
  "servers-infrastructure": ["scaling", "captest", "hosting", "iac", "envs", "patching", "shutdown", "cloudcost", "finops"],
  "security-operations": ["threat", "secrets", "vulnwatch", "secinc", "recert", "sanitise", "sbom", "deps"],
  "people-operations": ["team", "resourcing"],
};
const TRACK_OVERRIDE = new Map<string, string>();
for (const [slug, ids] of Object.entries(OVERRIDES)) for (const id of ids) TRACK_OVERRIDE.set(id, slug);

export type Station = {
  id: string; line: LineId; x: number; row: number; name: string; scale: Scale; ai: boolean; owner: string; ins: string[]; outs: string[];
  /** slug of the Software Lifecycle track this stop belongs to */
  track: string;
  /** label placement: above (a) or below (b) the line, and how it is anchored */
  side: "a" | "b"; anchor: "start" | "middle" | "end"; L: number; R: number;
};

export const STATIONS: Station[] = [];
for (const line of LINES) for (const a of RAW[line.id]) {
  STATIONS.push({
    id: a[0], line: line.id, x: a[1], row: line.row, name: a[2], scale: a[3], ai: !!a[4], owner: a[6], ins: a[7].split("|"), outs: a[8].split("|"),
    track: TRACK_OVERRIDE.get(a[0]) ?? LINE_DEFAULT[line.id], side: "a", anchor: "middle", L: 0, R: 0,
  });
}
export const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));
export const GATE_BY_ID = new Map(GATES.map((g) => [g.id, g]));
export const gateRow = (g: Gate) => Math.min(...g.lines.map((id) => LINE_BY_ID[id].row));
export const gateBottom = (g: Gate) => Math.max(...g.lines.map((id) => LINE_BY_ID[id].row));

/** Everything on a line in left-to-right order: its stations and the gates it passes through. */
export type Stop = { kind: "st"; st: Station } | { kind: "gt"; gate: Gate };
export const SEQ = Object.fromEntries(LINES.map((l) => {
  const stops: Stop[] = [...STATIONS.filter((s) => s.line === l.id).map((st) => ({ kind: "st", st }) as Stop), ...GATES.filter((g) => g.lines.includes(l.id)).map((gate) => ({ kind: "gt", gate }) as Stop)];
  return [l.id, stops.sort((a, b) => (a.kind === "st" ? a.st.x : a.gate.x) - (b.kind === "st" ? b.st.x : b.gate.x))];
})) as Record<LineId, Stop[]>;
export const stationsOn = (line: LineId) => STATIONS.filter((s) => s.line === line).sort((a, b) => a.x - b.x);

// Label layout: each label goes above or below its line, centred or shifted to one side, whichever clears its neighbours and the gate connectors.
for (const l of LINES) {
  const gx = GATES.filter((g) => gateRow(g) <= l.row && l.row <= gateBottom(g)).map((g) => px(g.x));
  const last = { a: -1e9, b: -1e9 };
  let prev: "a" | "b" = "b";
  for (const st of stationsOn(l.id)) {
    const X = px(st.x), w = st.name.length * 9.1;
    const span = (anchor: Station["anchor"]) => anchor === "middle" ? [X - w / 2, X + w / 2] : anchor === "start" ? [X - 6, X - 6 + w] : [X + 6 - w, X + 6];
    const clearOfGates = (L: number, R: number) => !gx.some((g) => g > L - 10 && g < R + 10);
    const alt: "a" | "b" = prev === "a" ? "b" : "a", other: "a" | "b" = alt === "a" ? "b" : "a";
    const tries: [Station["side"], Station["anchor"]][] = [[alt, "middle"], [other, "middle"], [alt, "start"], [other, "start"], [alt, "end"], [other, "end"]];
    // first choice: no overlap and no gate line through the text; then allow the text to cross a gate line (it has a halo); last resort: least crowded lane
    const fits = ([side, anchor]: (typeof tries)[number]) => span(anchor)[0] > last[side] + 8;
    let pick = tries.find((t) => fits(t) && clearOfGates(...(span(t[1]) as [number, number]))) ?? tries.find(fits);
    if (!pick) pick = [...tries].sort((p, q) => last[p[0]] - last[q[0]])[0];
    const [side, anchor] = pick, [L, R] = span(anchor);
    last[side] = R; prev = side;
    Object.assign(st, { side, anchor, L, R });
  }
}

/** "I work on…": which lines matter most to each kind of person. */
export const FOCUS = [
  { id: "build", label: "Build software", lines: ["arc", "dat", "eng", "qa", "sec", "ops"] },
  { id: "design", label: "Design and content", lines: ["ux", "doc", "str"] },
  { id: "lead", label: "Lead delivery", lines: ["gov", "str", "ops", "arc"] },
  { id: "sell", label: "Market and sell", lines: ["gtm", "str", "ux"] },
  { id: "customers", label: "Customer success", lines: ["gtm", "ops", "doc"] },
  { id: "run", label: "Run and support", lines: ["ops", "doc", "sec"] },
  { id: "secure", label: "Secure and comply", lines: ["sec", "gov", "dat"] },
  { id: "all", label: "Show me everything", lines: LINES.map((l) => l.id) },
] as const satisfies readonly { id: string; label: string; lines: readonly LineId[] }[];
export type FocusId = (typeof FOCUS)[number]["id"];

/** Areas that follow a hand-picked set of stops instead of whole lines (a whole line would pull in stops the area never touches). */
export const FOCUS_STOPS: Partial<Record<FocusId, readonly string[]>> = {
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
export const FOCUS_START: Partial<Record<FocusId, string>> = { build: "stack", design: "research", lead: "team", run: "obs", secure: "regscan", sell: "icp", customers: "onboard" };
/** The lines an area touches. */
export const focusLinesOf = (id: FocusId): Set<LineId> => {
  const stops = FOCUS_STOPS[id];
  return stops ? new Set(stops.map((sid) => STATION_BY_ID.get(sid)!.line)) : new Set<LineId>(FOCUS.find((f) => f.id === id)!.lines);
};

const ROLE_WORDS: [RegExp, FocusId][] = [
  [/secur|compliance|privacy|risk|audit/, "secure"],
  [/design|ux|content|writer|brand|creative|editor/, "design"],
  [/customer|success|account|support/, "customers"],
  [/sales|market|social|growth|business dev|seo/, "sell"],
  [/service|operat|devops|sre|infrastructure/, "run"],
  [/manag|lead|director|cto|head|product|project|delivery|owner|executive|ceo/, "lead"],
  [/develop|engineer|programmer|architect|data|ml|qa|test/, "build"],
];
export function focusForRole(role: string | null | undefined): FocusId {
  const r = (role ?? "").toLowerCase();
  return ROLE_WORDS.find(([re]) => re.test(r))?.[1] ?? "all";
}

/** A job role from the career ladders, with every track its ladder asks for. */
export type RoleInfo = {
  key: string; name: string; aliases: string[];
  /** every track the ladder asks for (used to find races) */
  tracks: string[];
  /** the tracks that set this role apart: asked for at level 8 or more, or not a basic that nearly every role shares (used for the route) */
  core: string[];
};
/** A live or upcoming public race (campaign) on one track. */
export type RaceInfo = {
  id: string; title: string; track: string; trackName: string; state: "live" | "upcoming"; humans: number; slug: string; hook: string; headline: string; goal: number; days: number;
};
export type TrackInfo = {
  slug: string; name: string;
  /** highest level passed, 0 to 20 */
  passed: number; requiredLevel: number;
  required: boolean; overdue: boolean; dueAt: number | null;
  /** false when this person's plan does not include the track */
  open: boolean;
  rival: { name: string; level: number } | null;
};
export type MapData = {
  signedIn: boolean; firstName: string | null; defaultFocus: FocusId; tracks: Record<string, TrackInfo>;
  roles: RoleInfo[]; races: RaceInfo[];
  /** the visitor's own job role, when it matches one of the ladders */
  defaultRole: string | null;
};

/* ---------- the AI lens: a role as a person, a person working with AI, or an AI agent ---------- */
export type AiMode = "human" | "ai" | "agent";
export const AI_MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: "human", label: "Human", hint: "The role as it is today" },
  { id: "ai", label: "Works with AI", hint: "The same role, plus the AI stops it now needs" },
  { id: "agent", label: "AI agent", hint: "An AI agent does the role; you supervise and approve" },
];
/** Every stop that is about designing, building or governing AI. */
export const AI_STOPS_FULL = STATIONS.filter((s) => s.ai).map((s) => s.id);
/** What a non-technical role needs about AI: where to use it, how to test its output, its risks, and when it drifts. */
export const AI_STOPS_LITE = ["aiuse", "evalset", "airisk", "drift"];
/** Where a human checks an AI agent's work: acceptance, sign-off, risk and audit. */
export const AI_REVIEW_STOPS = ["accept", "uat", "risk", "audit"];
const TECH_ROLES = new Set(["developer", "backend developer", "frontend developer", "full stack developer", "engineer", "architect", "devops", "tester", "security", "data analyst", "cto"]);
const AI_FULL_AREAS = new Set<FocusId>(["build", "secure", "run"]);
/** "CEO" as a person, "CEO working with AI", or "AI CEO". */
export const aiRoleName = (name: string, mode: AiMode) => (mode === "ai" ? `${name} working with AI` : mode === "agent" ? `AI ${name}` : name);

export type Route = {
  /** every lit stop */ ids: Set<string>;
  /** the role's or area's own stops */ base: Set<string>;
  /** AI stops added by the lens */ ai: Set<string>;
  /** human checkpoints on an AI agent's work */ review: Set<string>;
  /** stops an AI agent does itself (agent lens only) */ agent: Set<string>;
};
/** The lit stops for a role (or area) seen through an AI lens. */
export function buildRoute(role: RoleInfo | null, focus: FocusId, mode: AiMode): Route {
  let base: Set<string> | null = null;
  if (role) { const t = new Set(role.core); const ids = STATIONS.filter((s) => t.has(s.track)).map((s) => s.id); if (ids.length) base = new Set(ids); }
  if (!base) {
    const stops = FOCUS_STOPS[focus];
    const lines = focusLinesOf(focus);
    base = stops ? new Set<string>(stops) : new Set(STATIONS.filter((s) => lines.has(s.line)).map((s) => s.id));
  }
  const full = role ? TECH_ROLES.has(role.key) : AI_FULL_AREAS.has(focus);
  const ai = mode === "human" ? new Set<string>() : new Set(full ? AI_STOPS_FULL : AI_STOPS_LITE);
  const review = mode === "agent" ? new Set(AI_REVIEW_STOPS) : new Set<string>();
  const agent = mode === "agent" ? new Set([...base].filter((id) => !ai.has(id) && !review.has(id))) : new Set<string>();
  return { ids: new Set([...base, ...ai, ...review]), base, ai, review, agent };
}

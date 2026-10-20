/**
 * The map engine. A map is described by data (a MapDef: lanes, phases, stops, handoff gates, areas, company stages)
 * and buildModel turns that into everything the page needs: the layout, label placement and the routes for a role,
 * an area or a company stage. The software lifecycle and the general business map are both just definitions.
 */

export type Scale = "S" | "M" | "L" | "P";
/** [id, x, name, scale, ai(0|1), unused, owner, inputs joined by |, outputs joined by |] */
export type RawStation = [string, number, string, Scale, 0 | 1, number, string, string, string];
export type LineId = string;
export type Gate = { id: string; x: number; name: string; lines: LineId[]; ins: string[]; outs: string[]; fail: string };

export type LineDef = {
  id: LineId; name: string; row: number; hollow?: boolean;
  /** the line's colour on the light page */ colour: string;
  /** what the line is about, in one plain sentence */ blurb: string;
  /** the learning track a stop on this line belongs to unless trackOverrides names a better one */ track: string;
};
export type ZoneDef = { name: string; sub: string; from: number; to: number };
/** An area a person can work in: whole lines, or (when `stops` is given) a hand-picked set of stops. */
export type FocusDef = { id: string; label: string; lines: LineId[]; stops?: string[]; start?: string; aiFull?: boolean };
export type StageDef = {
  id: string; label: string; ask: string; blurb: string;
  /** the stop to begin with */ start: string;
  /** the handoff gates where this stage most often goes wrong */ watch: string[];
  aiFull: boolean; stops: string[];
};
export type AiDef = {
  /** what a non-technical role needs about AI */ lite: string[];
  /** where a person checks an AI agent's work */ review: string[];
  techFamilies: string[]; techRoles: string[];
};
/** An organisation size: what it means, what changes on the map at that size, and what usually goes wrong. Sizes run from the smallest to the largest. */
export type SizeDef = {
  id: string; label: string;
  /** who this is, in numbers: "10 to 49 people" */ people: string;
  blurb: string;
  /** what changes on the map at this size */ changes: string[];
  /** what usually goes wrong at this size */ challenges: string[];
  /** who usually owns a stop at this size */ owner: string;
  /** how formal a handoff gate is at this size */ formal: string;
};
export type SizesDef = {
  list: SizeDef[];
  /** size id -> the stops that first matter at that size. A stop in no list matters from the smallest size, and from then on. */
  from: Record<string, string[]>;
  /** stop id -> size id -> what is different about that stop at that size */
  notes?: Record<string, Record<string, string>>;
};
export type MapWords = {
  /** the small line above the headline */ kicker: string;
  /** the headline, in two halves (the second is coloured) */ headline: [string, string];
  /** what screen readers call the map */ aria: string;
  metaTitle: string; metaDescription: string;
  /** the kicker on the link-preview picture */ ogKicker: string;
  /** "a route through …", used in share titles */ routeWord: string;
  /** shown when a role search finds nothing */ coverage: string;
  /** what the stage picker says ("or my company is"); a public service says "or my service is" */ stageIs?: string;
  /** the stage picker's heading */ stageAsk?: string;
  /** what a stage is called in titles ("Company stage") */ stageWord?: string;
};
export type MapDef = {
  id: string;
  /** the name in the map switcher */ label: string;
  words: MapWords;
  lines: LineDef[]; zones: ZoneDef[];
  stations: Record<LineId, RawStation[]>;
  gates: Gate[];
  /** learning track slug -> the stops that belong to it instead of their line's default track */
  trackOverrides: Record<string, string[]>;
  /** the "what do you want to work on" areas; an "all" area is added */
  focus: FocusDef[];
  /** words in a job title that suggest an area */ roleWords: [RegExp, string][];
  stages: StageDef[];
  /** null when the map has no AI lens */ ai: AiDef | null;
  /**
   * Job family -> the lines that family works in. When given, a role's route keeps only the stops on those lines, so a role whose
   * ladder asks for broad tracks does not light up the whole map. A family with no entry (or no stop left) keeps every stop its tracks cover.
   */
  familyLines?: Record<string, LineId[]>;
  /** organisation sizes (startup to enterprise) and what each changes; leave out when size does not change the map */
  sizes?: SizesDef;
  /** room above the first line, in map units: more when the first line is crowded and its labels would touch the handoff-gate titles above it */
  layout?: { top?: number };
};

export type Station = {
  id: string; line: LineId; x: number; row: number; name: string; scale: Scale; ai: boolean; owner: string; ins: string[]; outs: string[];
  /** slug of the learning track this stop belongs to */
  track: string;
  /** label placement: always above the line, on the near (0) or far (1) tier, and how it is anchored */
  tier: 0 | 1; anchor: "start" | "middle" | "end"; L: number; R: number;
};
/** Everything on a line in left-to-right order: its stations and the gates it passes through. */
export type Stop = { kind: "st"; st: Station } | { kind: "gt"; gate: Gate };

/* ---------- things that do not depend on the map ---------- */
export type FocusId = string;
export type StageId = string;
export type SizeId = string;
export type AiMode = "human" | "ai" | "agent";
export const AI_MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: "human", label: "Human", hint: "The role as it is today" },
  { id: "ai", label: "Works with AI", hint: "The same role, plus the AI stops it now needs" },
  { id: "agent", label: "AI agent", hint: "An AI agent does the role; you supervise and approve" },
];
/** "CEO" as a person, "CEO working with AI", or "AI CEO". */
export const aiRoleName = (name: string, mode: AiMode) => (mode === "ai" ? `${name} working with AI` : mode === "agent" ? `AI ${name}` : name);
/** The order functions are listed in the role picker. */
export const FAMILY_ORDER = ["Leadership", "Product & Delivery", "Engineering", "Data & AI", "IT & Infrastructure", "Design & Content", "Marketing, Sales & Customers", "Finance", "People", "Operations & Admin", "Security, Risk & Compliance", "Legal & Public Sector"];
/** How big a piece of work a stop usually is. The fourth size, P, is left unlabelled. */
export const SIZE_LABEL: Partial<Record<Scale, string>> = { S: "A small piece of work", M: "A medium piece of work", L: "A large piece of work" };

/** A job role from the career ladders, with every track its ladder asks for. */
export type RoleInfo = {
  key: string; name: string; aliases: string[];
  /** the function this role belongs to (Engineering, Finance, Legal & Public Sector…) */
  family: string;
  /** one line on what the role does */
  blurb: string;
  /** every track the ladder asks for (used to find races) */
  tracks: string[];
  /** the level the ladder first asks for, per track (server only: left out of what the map receives) */
  entry?: Record<string, number>;
  /** the first rung (1-based) of the ladder that asks for each track */
  firstRung?: Record<string, number>;
  /** the rungs of the career ladder, lowest first: what a person at each level is called and does */
  rungs?: { title: string; summary: string }[];
  /** the tracks that set this role apart: asked for at level 8 or more, or not a basic that nearly every role shares (used for the route) */
  core: string[];
};
/** A live or upcoming public race (campaign) on one track. */
export type RaceInfo = {
  id: string; title: string; track: string; trackName: string; state: "live" | "upcoming"; humans: number; slug: string; hook: string; headline: string; goal: number; days: number;
};
/** A starting level someone was given in a track, outside the exams (lib/credits.ts). */
export type CreditInfo = { level: number; source: "manager" | "admin" | "role"; by: string; reason: string; at: number; expiresAt: number | null; countsAsComplete: boolean };
export type TrackInfo = {
  slug: string; name: string;
  /** the level shown: the highest of exams passed, the placement check and any starting level, 0 to 20 */
  passed: number;
  /** highest level passed by exam */ earned: number;
  /** level the placement check found */ placed: number;
  /** the starting level in force, if any */ credit: CreditInfo | null;
  /** the level this person's job role normally holds here, when they do not have it yet (0 = none) */ suggest: number;
  requiredLevel: number;
  required: boolean; overdue: boolean; dueAt: number | null;
  /** false when this person's plan does not include the track */
  open: boolean;
  rival: { name: string; level: number } | null;
};
export type JourneyView = {
  roleName: string; setting: "choice" | "hard" | "soft"; canSwitch: boolean; locked: boolean; current: number; total: number;
  locks: Record<string, { stage: number; waitingOn: { slug: string; name: string }[] }>;
  advice: Record<string, { stage: number; waitingOn: { slug: string; name: string }[] }>;
  stages: { n: number; state: "done" | "current" | "locked"; waitingOn: string[]; tracks: { slug: string; name: string; passed: number; need: number }[] }[];
};
export type MapData = {
  journey: JourneyView | null;
  signedIn: boolean; firstName: string | null; defaultFocus: FocusId; tracks: Record<string, TrackInfo>;
  roles: RoleInfo[]; races: RaceInfo[];
  /** the visitor's own job role, when it matches one of the ladders */
  defaultRole: string | null;
  /** set when a manager or admin is looking at someone else's map: whose */
  viewingAs: { id: number; name: string } | null;
  /** the person looking may give starting levels (a manager or admin) */
  canGrant: boolean;
};
export type Route = {
  /** every lit stop */ ids: Set<string>;
  /** the role's or area's own stops */ base: Set<string>;
  /** AI stops added by the lens */ ai: Set<string>;
  /** where a person checks an agent's work */ review: Set<string>;
  /** stops an AI agent does */ agent: Set<string>;
  /** stops the chosen organisation size leaves out because they can wait until it is bigger */ deferred: Set<string>;
  /** stops the chosen career level leaves for later: stop id to the rung (1-based) where its track first matters */ waiting: Map<string, number>;
};

/** Layout of the map, in SVG units. */
export const U = 96, LEFT = 230, ROW = 98;
const norm = (t: string) => t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().replace(/s\b/g, "");

export function buildModel(def: MapDef) {
  const TOP = def.layout?.top ?? 170;
  const LINES = def.lines;
  const GATES = def.gates;
  const maxX = Math.max(...GATES.map((g) => g.x), ...Object.values(def.stations).flat().map((s) => s[1]));
  const maxRow = Math.max(...LINES.map((l) => l.row));
  const W = LEFT + maxX * U + 70, H = TOP + (maxRow - 1) * ROW + 72;
  const px = (x: number) => LEFT + x * U;
  const py = (row: number) => TOP + row * ROW;

  const LINE_BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l])) as Record<LineId, LineDef>;
  const LINE_COLOUR = Object.fromEntries(LINES.map((l) => [l.id, l.colour])) as Record<LineId, string>;
  const LINE_BLURB = Object.fromEntries(LINES.map((l) => [l.id, l.blurb])) as Record<LineId, string>;
  const ZONES = def.zones;
  const zoneOf = (x: number) => ZONES.findIndex((z) => x >= z.from && x < z.to);

  const trackOverride = new Map<string, string>();
  for (const [slug, ids] of Object.entries(def.trackOverrides)) for (const id of ids) trackOverride.set(id, slug);

  const STATIONS: Station[] = [];
  for (const line of LINES) for (const a of def.stations[line.id] ?? []) {
    STATIONS.push({
      id: a[0], line: line.id, x: a[1], row: line.row, name: a[2], scale: a[3], ai: !!a[4], owner: a[6], ins: a[7].split("|"), outs: a[8].split("|"),
      track: trackOverride.get(a[0]) ?? line.track, tier: 0, anchor: "middle", L: 0, R: 0,
    });
  }
  const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));
  const GATE_BY_ID = new Map(GATES.map((g) => [g.id, g]));
  const gateRow = (g: Gate) => Math.min(...g.lines.map((id) => LINE_BY_ID[id].row));
  const gateBottom = (g: Gate) => Math.max(...g.lines.map((id) => LINE_BY_ID[id].row));

  const SEQ = Object.fromEntries(LINES.map((l) => {
    const stops: Stop[] = [...STATIONS.filter((s) => s.line === l.id).map((st) => ({ kind: "st", st }) as Stop), ...GATES.filter((g) => g.lines.includes(l.id)).map((gate) => ({ kind: "gt", gate }) as Stop)];
    return [l.id, stops.sort((a, b) => (a.kind === "st" ? a.st.x : a.gate.x) - (b.kind === "st" ? b.st.x : b.gate.x))];
  })) as Record<LineId, Stop[]>;
  const stationsOn = (line: LineId) => STATIONS.filter((s) => s.line === line).sort((a, b) => a.x - b.x);

  // Label layout: every label sits above its line, on the near tier or (when that is taken) a second tier higher up, centred or shifted to one side, whichever clears its neighbours and the gate connectors.
  for (const l of LINES) {
    const gx = GATES.filter((g) => gateRow(g) <= l.row && l.row <= gateBottom(g)).map((g) => px(g.x));
    const last: [number, number] = [-1e9, -1e9];
    let prev: 0 | 1 = 1;
    for (const st of stationsOn(l.id)) {
      const X = px(st.x), w = st.name.length * 9.1;
      const span = (anchor: Station["anchor"]) => anchor === "middle" ? [X - w / 2, X + w / 2] : anchor === "start" ? [X - 6, X - 6 + w] : [X + 6 - w, X + 6];
      const clearOfGates = (L: number, R: number) => !gx.some((g) => g > L - 10 && g < R + 10);
      const alt: 0 | 1 = prev === 0 ? 1 : 0, other: 0 | 1 = alt === 0 ? 1 : 0;
      const tries: [0 | 1, Station["anchor"]][] = [[alt, "middle"], [other, "middle"], [alt, "start"], [other, "start"], [alt, "end"], [other, "end"]];
      // first choice: no overlap and no gate line through the text; then allow the text to cross a gate line (it has a halo); last resort: least crowded tier
      const fits = ([tier, anchor]: (typeof tries)[number]) => span(anchor)[0] > last[tier] + 8;
      let pick = tries.find((t) => fits(t) && clearOfGates(...(span(t[1]) as [number, number]))) ?? tries.find(fits);
      if (!pick) pick = [...tries].sort((p, q) => last[p[0]] - last[q[0]])[0];
      const [tier, anchor] = pick, [L, R] = span(anchor);
      last[tier] = R; prev = tier;
      Object.assign(st, { tier, anchor, L, R });
    }
  }

  /* ---------- areas ---------- */
  const FOCUS: FocusDef[] = [...def.focus, { id: "all", label: "Show me everything", lines: LINES.map((l) => l.id) }];
  const FOCUS_STOPS: Record<FocusId, readonly string[] | undefined> = Object.fromEntries(def.focus.map((f) => [f.id, f.stops]));
  const FOCUS_START: Record<FocusId, string | undefined> = Object.fromEntries(def.focus.map((f) => [f.id, f.start]));
  const focusLinesOf = (id: FocusId): Set<LineId> => {
    const stops = FOCUS_STOPS[id];
    return stops ? new Set(stops.map((sid) => STATION_BY_ID.get(sid)!.line)) : new Set<LineId>(FOCUS.find((f) => f.id === id)!.lines);
  };
  const focusForRole = (role: string | null | undefined): FocusId => {
    const r = (role ?? "").toLowerCase();
    return def.roleWords.find(([re]) => re.test(r))?.[1] ?? "all";
  };

  /* ---------- company stages ---------- */
  const STAGES = def.stages;
  const STAGE_BY_ID = new Map<string, StageDef>(STAGES.map((st) => [st.id, st]));

  /* ---------- organisation sizes ---------- */
  const SIZES = def.sizes?.list ?? [];
  const SIZE_BY_ID = new Map<string, SizeDef>(SIZES.map((x) => [x.id, x]));
  const sizeIndex = (id: SizeId) => SIZES.findIndex((x) => x.id === id);
  const firstSize = new Map<string, number>();
  for (const [sid, ids] of Object.entries(def.sizes?.from ?? {})) for (const id of ids) firstSize.set(id, Math.max(0, sizeIndex(sid)));
  /** The smallest size at which a stop matters (0 = the smallest). */
  const sizeFrom = (stopId: string) => firstSize.get(stopId) ?? 0;
  const sizeNote = (stopId: string, size: SizeId): string | null => def.sizes?.notes?.[stopId]?.[size] ?? null;

  /* ---------- the AI lens ---------- */
  const hasAi = !!def.ai;
  const AI_STOPS_FULL = STATIONS.filter((s) => s.ai).map((s) => s.id);
  const AI_STOPS_LITE = def.ai?.lite ?? [];
  const AI_REVIEW_STOPS = def.ai?.review ?? [];
  const techFamilies = new Set(def.ai?.techFamilies ?? []), techRoles = new Set(def.ai?.techRoles ?? []);
  /** Engineering, data and IT roles (and security-minded leaders): the roles that build or run the technology. */
  const isTechRole = (role: Pick<RoleInfo, "family" | "key">) => techFamilies.has(role.family) || techRoles.has(role.key);
  const aiFullAreas = new Set(def.focus.filter((f) => f.aiFull).map((f) => f.id));

  /** The lit stops for a role, an area or a company stage, seen through an AI lens. */
  function buildRoute(role: RoleInfo | null, focus: FocusId, mode: AiMode, stage: StageId | null = null, size: SizeId | null = null, level: number | null = null): Route {
    let base: Set<string> | null = null;
    if (role) {
      const t = new Set(role.core), fam = def.familyLines?.[role.family], lines = fam ? new Set(fam) : null;
      let ids = STATIONS.filter((s) => t.has(s.track) && (!lines || lines.has(s.line))).map((s) => s.id);
      if (!ids.length && lines) ids = STATIONS.filter((s) => lines.has(s.line)).map((s) => s.id);
      if (ids.length) base = new Set(ids);
    }
    const st = !role && stage ? STAGE_BY_ID.get(stage) : undefined;
    if (!base && st) base = new Set<string>(st.stops);
    if (!base) {
      const stops = FOCUS_STOPS[focus];
      const lines = focusLinesOf(focus);
      base = stops ? new Set<string>(stops) : new Set(STATIONS.filter((s) => lines.has(s.line)).map((s) => s.id));
    }
    // the size lens: stops that only matter once an organisation is bigger can wait
    let deferred = new Set<string>();
    const si = size ? sizeIndex(size) : -1;
    if (si >= 0) {
      const keep = [...base].filter((id) => sizeFrom(id) <= si);
      if (keep.length) { deferred = new Set([...base].filter((id) => sizeFrom(id) > si)); base = new Set(keep); }
    }
    // the level lens: a stop whose track only enters the ladder on a higher rung can wait until then
    const waiting = new Map<string, number>();
    if (role && level && role.firstRung) {
      const first = role.firstRung, floor = Math.min(...Object.values(first)), at = Math.max(level, floor); // a ladder's lowest rungs may ask for nothing yet
      const rungOf = (id: string) => first[STATION_BY_ID.get(id)!.track] ?? 1;
      const keep = [...base].filter((id) => rungOf(id) <= at);
      if (keep.length) { for (const id of base) if (rungOf(id) > at) waiting.set(id, rungOf(id)); base = new Set(keep); }
    }
    const lens = hasAi ? mode : "human";
    const full = role ? isTechRole(role) : st ? st.aiFull : aiFullAreas.has(focus);
    const ai = lens === "human" ? new Set<string>() : new Set(full ? AI_STOPS_FULL : AI_STOPS_LITE);
    const review = lens === "agent" ? new Set(AI_REVIEW_STOPS) : new Set<string>();
    const agent = lens === "agent" ? new Set([...base].filter((id) => !ai.has(id) && !review.has(id))) : new Set<string>();
    return { ids: new Set([...base, ...ai, ...review]), base, ai, review, agent, deferred, waiting };
  }

  /* ---------- what a stop leans on, and what leans on it ---------- */
  let deps: { needs: Map<string, Station[]>; neededBy: Map<string, Station[]> } | null = null;
  /**
   * A stop "needs" another when one of its inputs is that stop's name or one of its outputs, and the other is "needed by" it.
   * Matched on the wording of the map's own inputs and outputs, so only links the map already states appear.
   */
  function dependenciesOf(id: string): { needs: Station[]; neededBy: Station[] } {
    if (!deps) {
      const byKey = new Map<string, Station[]>();
      for (const s of STATIONS) for (const k of [s.name, ...s.outs]) { const key = norm(k); byKey.set(key, [...(byKey.get(key) ?? []), s]); }
      const needs = new Map<string, Station[]>(), neededBy = new Map<string, Station[]>();
      for (const s of STATIONS) for (const i of s.ins) for (const from of byKey.get(norm(i)) ?? []) {
        if (from.id === s.id || needs.get(s.id)?.some((x) => x.id === from.id)) continue;
        needs.set(s.id, [...(needs.get(s.id) ?? []), from]);
        neededBy.set(from.id, [...(neededBy.get(from.id) ?? []), s]);
      }
      deps = { needs, neededBy };
    }
    const byX = (a: Station, b: Station) => a.x - b.x || a.row - b.row;
    return { needs: [...(deps.needs.get(id) ?? [])].sort(byX), neededBy: [...(deps.neededBy.get(id) ?? [])].sort(byX) };
  }
  /** The next handoff gate on this stop's line: where its work is passed on, and so where it usually goes wrong. */
  const nextGateFor = (st: Station): Gate | null => GATES.filter((g) => g.lines.includes(st.line) && g.x >= st.x).sort((a, b) => a.x - b.x)[0] ?? null;

  return {
    id: def.id, label: def.label, words: def.words, hasAi,
    U, LEFT, TOP, ROW, W, H, px, py,
    LINES, GATES, LINE_BY_ID, LINE_COLOUR, LINE_BLURB, ZONES, zoneOf,
    STATIONS, STATION_BY_ID, GATE_BY_ID, gateRow, gateBottom, SEQ, stationsOn,
    FOCUS, FOCUS_STOPS, FOCUS_START, focusLinesOf, focusForRole,
    STAGES, STAGE_BY_ID,
    SIZES, SIZE_BY_ID, sizeFrom, sizeNote,
    AI_STOPS_FULL, AI_STOPS_LITE, AI_REVIEW_STOPS, isTechRole,
    buildRoute, dependenciesOf, nextGateFor,
  };
}
export type MapModel = ReturnType<typeof buildModel>;

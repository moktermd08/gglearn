import { AI_MODES, aiRoleName, type AiMode, type FocusId, type MapModel, type RoleInfo, type StageId } from "./engine";

/** What a shared link carries: a role, an area or a company stage, and whether the role works with AI. Nothing about the person. */
export type RoutePick = { role: string | null; area: FocusId | null; stage: StageId | null; mode: AiMode };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads ?role=ceo&area=sell&stage=launch&ai=agent for a map. Anything that is not a known role, area, stage or mode is ignored, so a link can never break the page. */
export function parsePick(sp: Params, roles: readonly { key: string }[], m: MapModel): RoutePick {
  const role = one(sp.role), area = one(sp.area), stage = one(sp.stage), ai = one(sp.ai);
  return {
    role: role && roles.some((r) => r.key === role) ? role : null,
    area: m.FOCUS.some((f) => f.id === area) ? (area as FocusId) : null,
    stage: m.STAGES.some((g) => g.id === stage) ? (stage as StageId) : null,
    mode: m.hasAi && AI_MODES.some((x) => x.id === ai) ? (ai as AiMode) : "human",
  };
}

/** The query string for a pick: "" when it is the plain map. A role wins over a company stage, and a stage over an area. */
export function pickQuery({ role, area, stage, mode }: RoutePick): string {
  const q = new URLSearchParams();
  if (role) q.set("role", role); else if (stage) q.set("stage", stage); else if (area) q.set("area", area);
  if (mode !== "human") q.set("ai", mode);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** The link-preview picture for a pick on a map: /map/og?map=business&stage=launch */
export function ogPath(m: MapModel, pick: RoutePick): string {
  const q = new URLSearchParams(pickQuery(pick).slice(1));
  if (m.id !== "software") q.set("map", m.id);
  const s = q.toString();
  return `/map/og${s ? `?${s}` : ""}`;
}

/** A route in words, for the page title, the link preview and the picture. */
export function describeRoute(pick: RoutePick, roles: readonly RoleInfo[], m: MapModel) {
  const role = roles.find((r) => r.key === pick.role) ?? null;
  const area = pick.area ?? "all";
  const stage = !role ? pick.stage : null;
  const route = m.buildRoute(role, role || stage ? "all" : area, pick.mode, stage);
  const on = m.STATIONS.filter((s) => route.ids.has(s.id)).sort((a, b) => a.x - b.x || a.row - b.row);
  const who = role ? aiRoleName(role.name, pick.mode) : stage ? `Company stage: ${m.STAGE_BY_ID.get(stage)!.label}` : area === "all" ? "Every stop" : m.FOCUS.find((f) => f.id === area)!.label;
  return { who, count: on.length, from: (stage ? m.STATION_BY_ID.get(m.STAGE_BY_ID.get(stage)!.start)?.name : undefined) ?? on[0]?.name ?? null, goal: on.length > 1 ? on[on.length - 1].name : null };
}

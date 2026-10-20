import { AI_MODES, FOCUS, STATIONS, aiRoleName, buildRoute, type AiMode, type FocusId, type RoleInfo } from "./model";

/** What a shared link carries: a role or an area, and whether the role works with AI. Nothing about the person. */
export type RoutePick = { role: string | null; area: FocusId | null; mode: AiMode };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads ?role=ceo&area=sell&ai=agent. Anything that is not a known role, area or mode is ignored, so a link can never break the page. */
export function parsePick(sp: Params, roles: readonly { key: string }[]): RoutePick {
  const role = one(sp.role), area = one(sp.area), ai = one(sp.ai);
  return {
    role: role && roles.some((r) => r.key === role) ? role : null,
    area: FOCUS.some((f) => f.id === area) ? (area as FocusId) : null,
    mode: AI_MODES.some((m) => m.id === ai) ? (ai as AiMode) : "human",
  };
}

/** The query string for a pick: "" when it is the plain map. A role wins over an area. */
export function pickQuery({ role, area, mode }: RoutePick): string {
  const q = new URLSearchParams();
  if (role) q.set("role", role); else if (area) q.set("area", area);
  if (mode !== "human") q.set("ai", mode);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** A route in words, for the page title, the link preview and the picture. */
export function describeRoute(pick: RoutePick, roles: readonly RoleInfo[]) {
  const role = roles.find((r) => r.key === pick.role) ?? null;
  const area = pick.area ?? "all";
  const route = buildRoute(role, role ? "all" : area, pick.mode);
  const on = STATIONS.filter((s) => route.ids.has(s.id)).sort((a, b) => a.x - b.x || a.row - b.row);
  const who = role ? aiRoleName(role.name, pick.mode) : area === "all" ? "Every stop" : FOCUS.find((f) => f.id === area)!.label;
  return { who, count: on.length, from: on[0]?.name ?? null, goal: on.length > 1 ? on[on.length - 1].name : null };
}

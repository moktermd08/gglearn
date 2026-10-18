import { catalog, inScope, loadProgress, requirementsFor, scopesOf } from "@/lib/paths";
import { rivalFor, rivalProgress } from "@/lib/rivals";
import { MAX_LEVEL } from "@/lib/levels";
import { campaignViews } from "@/lib/campaigns";
import { loadRoles } from "./roles";
import { journeyFor } from "@/lib/journeyLock";
import { STATIONS, focusForRole, type MapData, type RaceInfo, type TrackInfo } from "./model";

type Viewer = Parameters<typeof requirementsFor>[0] & { name: string; jobRole: string };

/** Everything the home-page map needs about the tracks behind its stations, and how this visitor is doing in each. Signed-out visitors see the map untouched. */
export function mapDataFor(viewer: Viewer | null): MapData {
  const slugs = new Set(STATIONS.map((s) => s.track));
  const rows = catalog().filter((t) => slugs.has(t.slug));
  const scopes = viewer ? scopesOf(viewer.id) : [];
  const reqs = viewer ? new Map(requirementsFor(viewer, scopes).map((r) => [r.track.slug, r])) : null;
  const prog = viewer ? loadProgress(new Set([viewer.id])) : null;
  const tracks: Record<string, TrackInfo> = {};
  for (const t of rows) {
    const req = reqs?.get(t.slug);
    const passed = viewer ? Math.min(MAX_LEVEL, prog!.passed.get(`${viewer.id}:${t.id}`) ?? 0) : 0;
    const startedAt = viewer ? prog!.started.get(`${viewer.id}:${t.id}`) : undefined;
    const rival = startedAt != null ? { name: rivalFor(t.slug).name, level: rivalProgress(rivalFor(t.slug), t.slug, startedAt).level } : null;
    tracks[t.slug] = {
      slug: t.slug, name: t.name.replace(/^\d+\.\s*/, ""), passed, requiredLevel: t.requiredLevel,
      required: !!req, overdue: !!req?.overdue, dueAt: req ? req.dueAt : null,
      open: !viewer || inScope(t, viewer.audience, scopes), rival,
    };
  }
  const roles = loadRoles();
  const races: RaceInfo[] = campaignViews().filter((v) => v.state === "live" || v.state === "upcoming").map((v) => ({
    id: v.id, title: v.title, track: v.track, trackName: v.trackName.replace(/^\d+\.\s*/, ""), state: v.state as "live" | "upcoming", humans: v.humans, slug: v.slug, hook: v.hook, headline: v.headline, goal: v.goal, days: v.days,
  }));
  const mine = viewer?.jobRole.toLowerCase() ?? "";
  const j = viewer ? journeyFor(viewer.id) : null;
  return {
    journey: j && { roleName: j.roleName, setting: j.setting, canSwitch: j.canSwitch, locked: j.locked, current: j.current, total: j.total, locks: j.locks, advice: j.advice, stages: j.stages.map((st) => ({ n: st.n, state: st.state, waitingOn: st.waitingOn, tracks: st.tracks.map(({ slug, name, passed, need }) => ({ slug, name, passed, need })) })) },
    signedIn: !!viewer, firstName: viewer ? viewer.name.split(" ")[0] : null, defaultFocus: focusForRole(viewer?.jobRole), tracks,
    roles: roles.map((r) => ({ key: r.key, name: r.name, family: r.family, blurb: r.blurb, aliases: r.aliases, tracks: r.tracks, core: r.core })), races, defaultRole: roles.some((r) => r.key === mine) ? mine : null,
  };
}

import { catalog, inScope, loadProgress, requirementsFor, scopesOf } from "@/lib/paths";
import { rivalFor, rivalProgress } from "@/lib/rivals";
import { MAX_LEVEL } from "@/lib/levels";
import { STATIONS, focusForRole, type MapData, type TrackInfo } from "./model";

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
  return { signedIn: !!viewer, firstName: viewer ? viewer.name.split(" ")[0] : null, defaultFocus: focusForRole(viewer?.jobRole), tracks };
}

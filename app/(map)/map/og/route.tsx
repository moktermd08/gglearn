import { ogCard } from "@/lib/ogCard";
import { loadRoles } from "@/lib/lifecycle/roles";
import { DEFAULT_MAP, mapFor } from "@/lib/lifecycle/maps";
import { describeRoute, parsePick } from "@/lib/lifecycle/share";

/** The picture shown when a route link is pasted into a chat or a feed: /map/og?role=ceo, or /map/og?map=business&stage=launch */
export function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const m = mapFor(params.map) ?? mapFor(DEFAULT_MAP)!;
  const roles = loadRoles();
  const d = describeRoute(parsePick(params, roles, m), roles, m);
  return ogCard({ kicker: m.words.ogKicker, title: d.who, sub: d.from && d.goal ? `${d.count} stops, from ${d.from} to ${d.goal}` : `${d.count} stops to learn` });
}

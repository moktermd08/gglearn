import { ogCard } from "@/lib/ogCard";
import { loadRoles } from "@/lib/lifecycle/roles";
import { describeRoute, parsePick } from "@/lib/lifecycle/share";

/** The picture shown when a route link is pasted into a chat or a feed: /map/og?role=ceo */
export function GET(req: Request) {
  const roles = loadRoles();
  const d = describeRoute(parsePick(Object.fromEntries(new URL(req.url).searchParams), roles), roles);
  return ogCard({ kicker: "A route through the software lifecycle", title: d.who, sub: d.from && d.goal ? `${d.count} stops, from ${d.from} to ${d.goal}` : `${d.count} stops to learn` });
}

import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { lookFor } from "@/lib/brand";
import { LifecycleMap } from "@/components/lifecycle/LifecycleMap";
import { mapDataFor } from "@/lib/lifecycle/server";
import { signage } from "@/lib/lifecycle/font";
import { loadRoles } from "@/lib/lifecycle/roles";
import { describeRoute, parsePick, pickQuery } from "@/lib/lifecycle/share";
import { siteUrl } from "@/lib/share";

type Search = Promise<Record<string, string | string[] | undefined>>;

/** A link with a route in it (/map?role=ceo) gets a title and preview picture of its own; the plain map keeps the layout's. */
export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const roles = loadRoles(), pick = parsePick(await searchParams, roles);
  const qs = pickQuery(pick);
  if (!qs) return {};
  const d = describeRoute(pick, roles);
  const title = `${d.who}: a route through the software lifecycle — gglearn`;
  const description = d.from && d.goal ? `${d.count} stops to learn, from ${d.from} to ${d.goal}. See the route and start at the first stop.` : `${d.count} stops to learn. See the route and start at the first stop.`;
  const image = `/map/og${qs}`;
  return { metadataBase: new URL(await siteUrl()), title, description, openGraph: { title, description, type: "website", images: [image] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export default async function MapPage({ searchParams }: { searchParams: Search }) {
  const viewer = await currentUser();
  const pick = parsePick(await searchParams, loadRoles());
  return <LifecycleMap data={mapDataFor(viewer)} signage={signage.className} standalone={{ brand: lookFor(viewer?.id).name }} initial={pick} />;
}

import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { lookFor } from "@/lib/brand";
import { LifecycleMap } from "@/components/lifecycle/LifecycleMap";
import { mapDataFor } from "@/lib/lifecycle/server";
import { signage } from "@/lib/lifecycle/font";
import { loadRoles } from "@/lib/lifecycle/roles";
import type { MapModel } from "@/lib/lifecycle/engine";
import { describeRoute, ogPath, parsePick, pickQuery } from "@/lib/lifecycle/share";
import { siteUrl } from "@/lib/share";

export type Search = Promise<Record<string, string | string[] | undefined>>;

/** A link with a route in it (/map?role=ceo) gets a title and preview picture of its own; the plain map keeps the layout's. */
export async function mapMetadata(m: MapModel, searchParams: Search): Promise<Metadata> {
  const roles = loadRoles(), pick = parsePick(await searchParams, roles, m);
  const base = { metadataBase: new URL(await siteUrl()) };
  if (!pickQuery(pick)) return { ...base, title: m.words.metaTitle, description: m.words.metaDescription };
  const d = describeRoute(pick, roles, m);
  const title = `${d.who}: ${m.words.routeWord} — gglearn`;
  const description = d.from && d.goal ? `${d.count} stops to learn, from ${d.from} to ${d.goal}. See the route and start at the first stop.` : `${d.count} stops to learn. See the route and start at the first stop.`;
  const image = ogPath(m, pick);
  return { ...base, title, description, openGraph: { title, description, type: "website", images: [image] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export async function MapView({ m, searchParams }: { m: MapModel; searchParams: Search }) {
  const viewer = await currentUser();
  const pick = parsePick(await searchParams, loadRoles(), m);
  return <LifecycleMap mapId={m.id} data={mapDataFor(viewer, m)} signage={signage.className} standalone={{ brand: lookFor(viewer?.id).name }} initial={pick} />;
}

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { reachOf, userInReach } from "@/lib/tenancy";
import { lookFor } from "@/lib/brand";
import { LifecycleMap } from "@/components/lifecycle/LifecycleMap";
import { mapDataFor } from "@/lib/lifecycle/server";
import { signage } from "@/lib/lifecycle/font";
import { loadRoles } from "@/lib/lifecycle/roles";
import type { MapModel } from "@/lib/lifecycle/engine";
import { describeRoute, ogPath, parsePick, pickQuery } from "@/lib/lifecycle/share";
import { siteUrl } from "@/lib/share";
import { DEFAULT_MAP, MAPS } from "@/lib/lifecycle/maps";

export type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** The query string of a page, as it was written (first value of each), for passing on to another address. */
export function queryOf(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) { const x = one(v); if (x != null) q.set(k, x); }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * The map a link was made for, when it is not the default: a link that uses the AI lens, or an area or company stage only another map has,
 * was made before the default changed. Roles and ids both maps share stay on the default.
 */
export function elsewhere(sp: Record<string, string | string[] | undefined>): string | null {
  const here = MAPS[DEFAULT_MAP], ai = one(sp.ai), area = one(sp.area), stage = one(sp.stage);
  for (const m of Object.values(MAPS)) {
    if (m.id === here.id) continue;
    if (ai && m.hasAi && !here.hasAi) return m.id;
    if (area && m.FOCUS.some((f) => f.id === area) && !here.FOCUS.some((f) => f.id === area)) return m.id;
    if (stage && m.STAGES.some((g) => g.id === stage) && !here.STAGES.some((g) => g.id === stage)) return m.id;
  }
  return null;
}

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
  const me = await currentUser(), sp = await searchParams;
  const pick = parsePick(sp, loadRoles(), m);
  // a manager or admin can open the map as someone they run (?as=ID), to see where that person is and give them a starting level
  let subject = me, viewingAs: { id: number; name: string } | null = null;
  const asId = Number(Array.isArray(sp.as) ? sp.as[0] : sp.as);
  if (me && me.role !== "learner" && asId && asId !== me.id) {
    const t = db.select().from(users).where(eq(users.id, asId)).get();
    if (t && t.status === "active" && userInReach(reachOf(me.id), t.id)) { subject = t; viewingAs = { id: t.id, name: t.name }; }
  }
  const canGrant = !!me && me.role !== "learner";
  return <LifecycleMap mapId={m.id} data={mapDataFor(subject, m, { viewingAs, canGrant })} signage={signage.className} standalone={{ brand: lookFor(me?.id).name }} initial={pick} />;
}

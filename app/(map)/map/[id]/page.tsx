import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { DEFAULT_MAP, mapFor } from "@/lib/lifecycle/maps";
import { MapView, mapMetadata, queryOf, type Search } from "../mapPage";

type Props = { params: Promise<{ id: string }>; searchParams: Search };

/** /map/software and the other maps. The default map lives at /map itself, so its own id is not a second address: it goes there, keeping the query. */
async function find({ params, searchParams }: Props) {
  const { id } = await params;
  const m = mapFor(id);
  if (!m) notFound();
  if (m.id === DEFAULT_MAP) permanentRedirect(`/map${queryOf(await searchParams)}`);
  return m;
}

export async function generateMetadata(p: Props): Promise<Metadata> {
  return mapMetadata(await find(p), p.searchParams);
}

export default async function OtherMapPage(p: Props) {
  return <MapView m={await find(p)} searchParams={p.searchParams} />;
}

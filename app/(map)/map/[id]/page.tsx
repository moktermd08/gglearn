import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_MAP, mapFor } from "@/lib/lifecycle/maps";
import { MapView, mapMetadata, type Search } from "../mapPage";

type Props = { params: Promise<{ id: string }>; searchParams: Search };

/** /map/business and the other maps. The default map lives at /map itself, so its own id is not a second address. */
async function find(params: Props["params"]) {
  const { id } = await params;
  const m = id === DEFAULT_MAP ? null : mapFor(id);
  if (!m) notFound();
  return m;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return mapMetadata(await find(params), searchParams);
}

export default async function OtherMapPage({ params, searchParams }: Props) {
  return <MapView m={await find(params)} searchParams={searchParams} />;
}

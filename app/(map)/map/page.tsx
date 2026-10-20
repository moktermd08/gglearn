import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEFAULT_MAP, MAPS } from "@/lib/lifecycle/maps";
import { MapView, elsewhere, mapMetadata, queryOf, type Search } from "./mapPage";

export const generateMetadata = ({ searchParams }: { searchParams: Search }): Promise<Metadata> => mapMetadata(MAPS[DEFAULT_MAP], searchParams);

export default async function MapPage({ searchParams }: { searchParams: Search }) {
  // before the business map became the default, /map was the software map: its links keep working
  const sp = await searchParams, other = elsewhere(sp);
  if (other) redirect(`/map/${other}${queryOf(sp)}`);
  return <MapView m={MAPS[DEFAULT_MAP]} searchParams={searchParams} />;
}

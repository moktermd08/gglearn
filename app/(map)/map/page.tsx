import type { Metadata } from "next";
import { MAPS } from "@/lib/lifecycle/maps";
import { MapView, mapMetadata, type Search } from "./mapPage";

export const generateMetadata = ({ searchParams }: { searchParams: Search }): Promise<Metadata> => mapMetadata(MAPS.software, searchParams);

export default function MapPage({ searchParams }: { searchParams: Search }) {
  return <MapView m={MAPS.software} searchParams={searchParams} />;
}

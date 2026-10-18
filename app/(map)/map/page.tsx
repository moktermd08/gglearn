import { currentUser } from "@/lib/auth";
import { lookFor } from "@/lib/brand";
import { LifecycleMap } from "@/components/lifecycle/LifecycleMap";
import { mapDataFor } from "@/lib/lifecycle/server";
import { signage } from "@/lib/lifecycle/font";

export default async function MapPage() {
  const viewer = await currentUser();
  return <LifecycleMap data={mapDataFor(viewer)} signage={signage.className} standalone={{ brand: lookFor(viewer?.id).name }} />;
}

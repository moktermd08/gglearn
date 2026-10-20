import { currentUser } from "@/lib/auth";
import { lookFor } from "@/lib/brand";
import { LifecycleMap } from "@/components/lifecycle/LifecycleMap";
import { SocialButtons } from "@/components/SocialButtons";
import { mailConfigured } from "@/lib/mail";
import { mapDataFor } from "@/lib/lifecycle/server";
import { signage } from "@/lib/lifecycle/font";

export default async function MapPage() {
  const viewer = await currentUser();
  // signed-out visitors sign in or sign up in a dialog over the map; signing in comes back here
  const auth = viewer ? undefined : { login: <SocialButtons next="/map" />, signup: <SocialButtons verb="Sign up" />, mailReady: mailConfigured() };
  return <LifecycleMap data={mapDataFor(viewer)} signage={signage.className} standalone={{ brand: lookFor(viewer?.id).name }} auth={auth} />;
}

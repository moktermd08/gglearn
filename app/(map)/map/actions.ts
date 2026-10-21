"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { acceptRoleStart } from "@/lib/credits";
import { recordPick } from "@/lib/problemLog";
import { allowed, clientIp, hit } from "@/lib/rate-limit";

/** A person confirms the starting level their own job role normally holds in one track. The level is worked out here, never taken from the form. */
export async function acceptRoleStartAction(slug: string) {
  const me = await requireUser();
  acceptRoleStart(me.id, slug);
  for (const p of ["/map", "/map/public", "/map/software", "/dashboard"]) revalidatePath(p);
}

/**
 * Counts what someone picked in a map's problem finder: a problem, a jump to a named stop, or a search that found nothing. Open to visitors who
 * are not signed in. It stores only a daily count (see lib/problemLog.ts), checks the ids against the map, and is limited per address.
 */
export async function logProblemAction(kind: string, mapId: string, ids: string[]) {
  const key = `problemlog:${await clientIp()}`;
  if (!allowed(key, 60)) return;
  hit(key, 60_000);
  recordPick(kind, mapId, Array.isArray(ids) ? ids.slice(0, 4).map(String) : []);
}

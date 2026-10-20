"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { acceptRoleStart } from "@/lib/credits";

/** A person confirms the starting level their own job role normally holds in one track. The level is worked out here, never taken from the form. */
export async function acceptRoleStartAction(slug: string) {
  const me = await requireUser();
  acceptRoleStart(me.id, slug);
  for (const p of ["/map", "/map/software", "/dashboard"]) revalidatePath(p);
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/share";
import { acceptSponsorship, askForSponsor, endSponsorship } from "@/lib/sponsors";

export type SponsorState = { error?: string; message?: string; link?: string } | null;

/** The learner picks a topic and a level and gets the link to share with someone who might back them. */
export async function makeGoalLink(_: SponsorState, fd: FormData): Promise<SponsorState> {
  const me = await requireUser();
  const r = askForSponsor(me, Number(fd.get("trackId")), Number(fd.get("level")));
  if ("error" in r) return { error: r.error };
  return { link: `${await siteUrl()}/sp/${r.code}` };
}

export async function becomeSponsor(code: string): Promise<SponsorState> {
  const me = await requireUser();
  if (!allowed(`sponsor-accept:${me.id}`, 20)) return { error: "Too many tries. Wait a few minutes." };
  hit(`sponsor-accept:${me.id}`, 60 * MINUTE);
  const r = acceptSponsorship(me.id, code);
  if ("error" in r) return { error: r.error };
  revalidatePath("/sponsoring");
  return { message: r.message ?? "You are now backing them." };
}

export async function stopSponsoring(id: number) {
  const me = await requireUser();
  endSponsorship(me.id, id);
  revalidatePath("/sponsoring");
}

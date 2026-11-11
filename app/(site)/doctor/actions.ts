"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { markField, type TasterResult } from "@/lib/careerTaster";
import { beginJourney } from "../start/actions";

/** From an untried area straight into its level check: the same journey /start opens, alone, so the result lands in the doctor's reading. */
export async function checkMyLevel(trackId: number) {
  await requireUser();
  const fd = new FormData();
  fd.set("trackId", String(trackId));
  fd.set("mode", "solo");
  const r = await beginJourney(null, fd); // redirects to the level check when it can start
  if (r?.error) redirect("/start"); // already racing that topic, or at Titan: the normal page says why
}

export type TasterState = { error?: string; results?: TasterResult[] } | null;

/** The taster form: each field posts its track, its question ids and the picks, and is marked on the server. */
export async function submitTaster(_: TasterState, fd: FormData): Promise<TasterState> {
  const me = await requireUser();
  if (!allowed(`taster:${me.id}`, 8)) return { error: "You have taken the taster a few times already. Try again in an hour." };
  const results: TasterResult[] = [];
  for (const raw of fd.getAll("field")) {
    const [track, ids, family, name] = String(raw).split("|");
    const trackId = Number(track), qids = ids.split(",").map(Number);
    if (!Number.isInteger(trackId) || qids.some((n) => !Number.isInteger(n))) continue;
    const r = markField(me, trackId, qids, (id) => String(fd.get(`q${id}`) ?? ""));
    if (r) results.push({ family, name, ...r });
  }
  if (!results.length) return { error: "Nothing to mark. Reload the page and try again." };
  hit(`taster:${me.id}`, 60 * MINUTE);
  revalidatePath("/doctor");
  return { results };
}

"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
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

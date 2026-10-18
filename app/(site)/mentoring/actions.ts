"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { allowed, hit, MINUTE } from "@/lib/rate-limit";
import { acceptMentorship, encourage, endMentorship } from "@/lib/mentoring";

export type MentorState = { error?: string; message?: string } | null;

/** Pressing the button on a mentee's invitation link. */
export async function becomeMentor(code: string, kind: "mentor" | "parent" = "mentor"): Promise<MentorState> {
  const me = await requireUser();
  if (!allowed(`mentor-accept:${me.id}`, 20)) return { error: "Too many tries. Wait a few minutes." };
  hit(`mentor-accept:${me.id}`, 60 * MINUTE);
  const r = acceptMentorship(me.id, code, kind);
  if ("error" in r) return { error: r.error };
  revalidatePath("/mentoring");
  return { message: r.message ?? (kind === "parent" ? "You now follow them as a parent." : "You are now their mentor.") };
}

export async function stopMentoring(otherId: number) {
  const me = await requireUser();
  endMentorship(me.id, otherId);
  revalidatePath("/mentoring");
}

export async function sendNote(menteeId: number, _: MentorState, fd: FormData): Promise<MentorState> {
  const me = await requireUser();
  const text = fd.get("text");
  const r = encourage(me.id, menteeId, typeof text === "string" ? text : "");
  if ("error" in r) return { error: r.error };
  return { message: "Sent." };
}

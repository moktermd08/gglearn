"use server";

import { allowed, clientIp, hit } from "@/lib/rate-limit";
import { currentUser } from "@/lib/auth";
import { checkTrial, completeTrial, noteTrialCheck, trialTrack } from "@/lib/trial";

/** Tells a visitor whether their answer was right, and what the right one was. Limited per address, so it cannot be used to read a topic's answers in bulk. */
export async function checkTrialAnswer(questionId: number, choice: string): Promise<{ correct: boolean; answer: string } | { error: string }> {
  const key = `trial:${await clientIp()}`;
  if (!allowed(key, 60)) return { error: "That is plenty of practice for one hour. Create a free account to keep going." };
  hit(key, 60 * 60 * 1000);
  const r = Number.isInteger(questionId) && typeof choice === "string" && choice.length <= 10 ? checkTrial(questionId, choice) : null;
  if (!r) return { error: "That question is not available." };
  const me = await currentUser();
  if (me) noteTrialCheck(me.id, r.trackId, questionId); // someone with an account has it counted: see finishTrialAction
  return { correct: r.correct, answer: r.answer };
}

/** A signed-in person reaches the end of a trial: they are enrolled in the topic and it counts as the day's quick drill. */
export async function finishTrialAction(slug: string): Promise<{ xp: number } | null> {
  const me = await currentUser(), track = trialTrack(slug);
  return me && track ? completeTrial(me.id, track.id) : null;
}

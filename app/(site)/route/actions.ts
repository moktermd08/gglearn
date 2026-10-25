"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { HORIZON_MAX, HORIZON_MIN, HOURS_MAX, HOURS_MIN } from "@/lib/routeScore";
import { UNPAID, answerCurrent, assessmentFor, resolveAreas, skipCurrent, startAssessment, targetBySlug } from "@/lib/route";

export type RouteState = { error?: string } | null;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const rating = z.coerce.number().int().min(1).max(5);

const schema = z.object({
  horizonMonths: z.coerce.number().int().min(HORIZON_MIN).max(HORIZON_MAX),
  hoursPerWeek: z.coerce.number().int().min(HOURS_MIN).max(HOURS_MAX),
  education: z.enum(["none", "school", "college", "degree"]),
  yearsOut: z.coerce.number().int().min(0).max(50),
  paidWork: z.enum(["none", "some", "lots"]),
  digital: rating,
  writing: rating,
  workRights: z.enum(["yes", "no", "unsure"]),
});

/** Saves the questionnaire and starts the level checks. Doing it again starts over, so a retake can pick a new timeframe. */
export async function saveRoute(slug: string, _: RouteState, fd: FormData): Promise<RouteState> {
  const me = await requireUser();
  const target = targetBySlug(slug);
  if (!target) return { error: "That job is not on the list." };
  const p = schema.safeParse(Object.fromEntries(["horizonMonths", "hoursPerWeek", "education", "yearsOut", "paidWork", "digital", "writing", "workRights"].map((k) => [k, str(fd.get(k))])));
  if (!p.success) return { error: `Check your answers: choose a timeframe from ${HORIZON_MIN} to ${HORIZON_MAX} months, ${HOURS_MIN} to ${HOURS_MAX} hours a week, and answer every question.` };
  if (!allowed(`route:${me.id}`, 10)) return { error: "You have restarted this a few times already. Try again later." };
  hit(`route:${me.id}`, 60 * MINUTE);
  const known = new Set(UNPAID.map((u) => u.key));
  const unpaid = fd.getAll("unpaid").filter((v): v is string => typeof v === "string" && known.has(v));
  const { horizonMonths, hoursPerWeek, ...answers } = p.data;
  startAssessment(me, target, { horizonMonths, hoursPerWeek, answers: { ...answers, unpaid } });
  redirect(`/route/${slug}`);
}

/** Marks the batch on screen and asks the next one. */
export async function answerRoute(slug: string, fd: FormData) {
  const me = await requireUser();
  const target = targetBySlug(slug);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "in_progress") redirect(`/route/${slug}`);
  answerCurrent(a, resolveAreas(target, me), (id) => str(fd.get(`q${id}`)));
  redirect(`/route/${slug}`);
}

/** Leaves the current area at what is already proven (nothing, for a newcomer) and moves on. */
export async function skipRoute(slug: string) {
  const me = await requireUser();
  const target = targetBySlug(slug);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "in_progress") redirect(`/route/${slug}`);
  skipCurrent(a, resolveAreas(target, me));
  redirect(`/route/${slug}`);
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import type { RouteAnswers } from "@/lib/db/schema";
import { HORIZON_MAX, HORIZON_MIN, HOURS_MAX, HOURS_MIN } from "@/lib/routeScore";
import { createPlan, planFor, setTask } from "@/lib/routePlan";
import { UNPAID, answerCurrent, assessmentFor, resolveAreas, skipCurrent, startAssessment } from "@/lib/route";
import { targetFor } from "@/lib/careerTarget";
import { parseCareerSlug } from "@/lib/standing";

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
  const target = targetFor(slug, me);
  if (!target) return { error: "That job is not on the list." };
  const career = !!parseCareerSlug(slug); // a goal on a career ladder has no questionnaire: only the timeframe and hours
  const p = (career ? schema.pick({ horizonMonths: true, hoursPerWeek: true }) : schema).safeParse(Object.fromEntries((career ? ["horizonMonths", "hoursPerWeek"] : ["horizonMonths", "hoursPerWeek", "education", "yearsOut", "paidWork", "digital", "writing", "workRights"]).map((k) => [k, str(fd.get(k))])));
  if (!p.success) return { error: `Check your answers: choose a timeframe from ${HORIZON_MIN} to ${HORIZON_MAX} months, ${HOURS_MIN} to ${HOURS_MAX} hours a week, and answer every question.` };
  if (!allowed(`route:${me.id}`, 10)) return { error: "You have restarted this a few times already. Try again later." };
  hit(`route:${me.id}`, 60 * MINUTE);
  const known = new Set(UNPAID.map((u) => u.key));
  const unpaid = fd.getAll("unpaid").filter((v): v is string => typeof v === "string" && known.has(v));
  const { horizonMonths, hoursPerWeek, ...rest } = p.data;
  // the stored answers only feed the Civil Service notes and plan; a career goal gets neutral ones
  const answers: RouteAnswers = career ? { education: "degree", yearsOut: 0, paidWork: "lots", unpaid: [], digital: 3, writing: 3, workRights: "yes" } : { ...(rest as Omit<RouteAnswers, "unpaid">), unpaid };
  startAssessment(me, target, { horizonMonths, hoursPerWeek, answers });
  redirect(`/route/${slug}`);
}

/** Marks the batch on screen and asks the next one. */
export async function answerRoute(slug: string, fd: FormData) {
  const me = await requireUser();
  const target = targetFor(slug, me);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "in_progress") redirect(`/route/${slug}`);
  answerCurrent(a, resolveAreas(target, me), (id) => str(fd.get(`q${id}`)));
  redirect(`/route/${slug}`);
}

/** Leaves the current area at what is already proven (nothing, for a newcomer) and moves on. */
export async function skipRoute(slug: string) {
  const me = await requireUser();
  const target = targetFor(slug, me);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "in_progress") redirect(`/route/${slug}`);
  skipCurrent(a, resolveAreas(target, me));
  redirect(`/route/${slug}`);
}

/** Builds the dated plan from a finished check. Does nothing if there already is one, so a double click cannot move its dates. */
export async function makePlan(slug: string) {
  const me = await requireUser();
  const target = targetFor(slug, me);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "complete") redirect(`/route/${slug}`);
  if (!planFor(a.id)) createPlan(me, target, a);
  redirect(`/route/${slug}/plan`);
}

/** Starts the plan again from today with what the person has learned since, keeping the finish date they were working to. */
export async function replanRoute(slug: string) {
  const me = await requireUser();
  const target = targetFor(slug, me);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "complete") redirect(`/route/${slug}`);
  if (!allowed(`replan:${me.id}`, 10)) redirect(`/route/${slug}/plan`);
  hit(`replan:${me.id}`, 60 * MINUTE);
  createPlan(me, target, a);
  redirect(`/route/${slug}/plan`);
}

/** Ticks a non-learning step off, or back on. */
export async function toggleTask(slug: string, key: string, done: boolean) {
  const me = await requireUser();
  const target = targetFor(slug, me);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a) redirect(`/route`);
  setTask(a, target, key, done);
  redirect(`/route/${slug}/plan`);
}

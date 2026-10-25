"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, requireUser, startSession } from "@/lib/auth";
import { claimAnonymous, createAnonymous, isAnonymous } from "@/lib/anonymous";
import { hashPassword } from "@/lib/password";
import { MINUTE, allowed, clientIp, hit } from "@/lib/rate-limit";
import { HORIZON_MAX, HORIZON_MIN, HOURS_MAX, HOURS_MIN } from "@/lib/routeScore";
import { createPlan, planFor, setTask } from "@/lib/routePlan";
import { setReminders } from "@/lib/routeReminders";
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
  const target = targetBySlug(slug);
  if (!target) return { error: "That job is not on the list." };
  let me = await currentUser();
  const p = schema.safeParse(Object.fromEntries(["horizonMonths", "hoursPerWeek", "education", "yearsOut", "paidWork", "digital", "writing", "workRights"].map((k) => [k, str(fd.get(k))])));
  if (!p.success) return { error: `Check your answers: choose a timeframe from ${HORIZON_MIN} to ${HORIZON_MAX} months, ${HOURS_MIN} to ${HOURS_MAX} hours a week, and answer every question.` };
  if (!me) {
    // no account needed to start: a private "just looking" account is made now and can be turned into a real one later
    const ipKey = `route-guest:${await clientIp()}`;
    if (!allowed(ipKey, 10)) return { error: "Too many people have started from this connection. Try again later, or create an account." };
    hit(ipKey, 60 * MINUTE);
    me = createAnonymous();
    await startSession(me.id);
  }
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

/** Builds the dated plan from a finished check. Does nothing if there already is one, so a double click cannot move its dates. */
export async function makePlan(slug: string) {
  const me = await requireUser();
  const target = targetBySlug(slug);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "complete") redirect(`/route/${slug}`);
  if (!planFor(a.id)) createPlan(me, target, a);
  redirect(`/route/${slug}/plan`);
}

/** Starts the plan again from today with what the person has learned since, keeping the finish date they were working to. */
export async function replanRoute(slug: string) {
  const me = await requireUser();
  const target = targetBySlug(slug);
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
  const target = targetBySlug(slug);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a) redirect(`/route`);
  setTask(a, target, key, done);
  redirect(`/route/${slug}/plan`);
}

/** Turns the weekly email about this plan on or off. Off unless the person asks: this is the only place it is switched on. */
export async function setRouteReminders(slug: string, on: boolean) {
  const me = await requireUser();
  const target = targetBySlug(slug);
  const a = target && assessmentFor(me.id, slug);
  if (!target || !a || a.status !== "complete") redirect(`/route/${slug}`);
  if (on && isAnonymous(me)) redirect(`/route/${slug}/plan`); // no address to write to until they save their progress
  setReminders(me.id, slug, on);
  redirect(`/route/${slug}/plan`);
}

/** Turns the guest account into a normal one, keeping everything done so far. */
export async function saveProgress(_: RouteState, fd: FormData): Promise<RouteState> {
  const me = await currentUser();
  if (!me || !isAnonymous(me)) return { error: "There is nothing to save here." };
  const ipKey = `signup:${await clientIp()}`;
  if (!allowed(ipKey, 8)) return { error: "Too many attempts. Try again later." };
  hit(ipKey, 60 * MINUTE);
  const p = z.object({ name: z.string().trim().min(1).max(80), email: z.string().email().max(120), password: z.string().min(8).max(200) })
    .safeParse({ name: str(fd.get("name")), email: str(fd.get("email")).toLowerCase(), password: str(fd.get("password")) });
  if (!p.success) return { error: "Enter your name, a valid email and a password of 8 or more characters." };
  if (!claimAnonymous(me.id, { ...p.data, passwordHash: await hashPassword(p.data.password) }))
    return { error: "We could not save with those details. If you already have an account, sign in instead." };
  revalidatePath("/route", "layout");
  return null;
}

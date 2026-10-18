"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { competitionMembers, competitions, db, enrollments, journeys, topicRequests, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import type { BotTier } from "@/lib/bots";
import { now } from "@/lib/competitions";
import { createContest, enrol, newContestSchema, toMinor } from "@/lib/contests";
import { levelsPassed } from "@/lib/progress";
import { MAX_LEVEL } from "@/lib/levels";
import { PLACEMENT_CAP, PLACEMENT_PASS, canPlace, nextProbe, scoreBatch } from "@/lib/placement";

import { openTo } from "@/lib/paths";
import { guestAudience } from "@/lib/guestLink";
import { emailRaceInvites } from "@/lib/raceMail";
import { topicLabel } from "@/lib/topicName";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
export type StartState = { error?: string } | null;

const mine = (slug: string, userId: number) =>
  db.select().from(journeys).where(and(eq(journeys.slug, slug), eq(journeys.userId, userId))).get();

/** Steps 1 and 2: what to learn, and whether alone or with a group. */
export async function beginJourney(_: StartState, fd: FormData): Promise<StartState> {
  const me = await requireUser();
  const p = z.object({ trackId: z.number().int().positive(), mode: z.enum(["solo", "group"]) })
    .safeParse({ trackId: Number(str(fd.get("trackId"))), mode: str(fd.get("mode")) });
  if (!p.success) return { error: "Pick what you want to learn and whether you are going alone or with a group." };
  const track = db.select().from(tracks).where(eq(tracks.id, p.data.trackId)).get();
  if (!track || !openTo(me.audience, track.audience)) return { error: "Pick a topic from the list." };
  const emails = p.data.mode === "group" ? str(fd.get("emails")).slice(0, 4000) : "";
  if (p.data.mode === "group" && !emails) return { error: "Add at least one email so your group can join." };
  if (!allowed(`journey:${me.id}`, 12)) return { error: "You are starting journeys too quickly. Try again later." };

  const racing = db.select({ id: competitions.id }).from(competitionMembers)
    .innerJoin(competitions, eq(competitions.id, competitionMembers.competitionId))
    .where(and(eq(competitionMembers.userId, me.id), eq(competitionMembers.status, "joined"), eq(competitions.trackId, track.id),
      isNull(competitions.canceledAt), gt(competitions.endsAt, now()))).get();
  if (racing) return { error: `You are already in a live contest on ${track.name}. Finish it first, or pick another topic.` };

  const known = levelsPassed(me.id, track.id);
  if (known >= MAX_LEVEL) return { error: `You have already reached Titan in ${track.name}. Pick another topic.` };
  hit(`journey:${me.id}`, 60 * MINUTE);
  const slug = randomBytes(9).toString("base64url");
  // someone who has already earned levels starts the search from there; no point re-testing what exams proved
  const lo = Math.min(known, PLACEMENT_CAP);
  const skip = lo >= PLACEMENT_CAP || !canPlace(track.id);
  db.insert(journeys).values({
    slug, userId: me.id, trackId: track.id, mode: p.data.mode, emails, lo, hi: PLACEMENT_CAP,
    step: skip ? "setup" : "level", placed: skip ? known : null,
  }).run();
  redirect(`/start/${slug}`);
}

/**
 * One tap from a topic to a running race, for someone who does not want a form. It skips the level check (levels already earned by exam still
 * count, and a race only counts levels passed after it starts, so nobody is disadvantaged) and uses what the form would suggest: three levels
 * (fewer when close to Titan), about four days a level, a certificate for finishing, one simulated rival so nobody races alone, and the
 * race private. A group race also turns the invite link on, so a friend with no account can be brought in straight away.
 */
export async function quickRace(trackId: number, mode: "solo" | "group" | "duel"): Promise<StartState> {
  const me = await requireUser();
  const p = z.object({ trackId: z.number().int().positive(), mode: z.enum(["solo", "group", "duel"]) }).safeParse({ trackId, mode });
  if (!p.success) return { error: "Pick a topic first." };
  const track = db.select().from(tracks).where(eq(tracks.id, p.data.trackId)).get();
  if (!track || !openTo(me.audience, track.audience)) return { error: "Pick a topic from the list." };
  if (!allowed(`journey:${me.id}`, 12)) return { error: "You are starting races too quickly. Try again later." };
  const racing = db.select({ slug: competitions.slug }).from(competitionMembers)
    .innerJoin(competitions, eq(competitions.id, competitionMembers.competitionId))
    .where(and(eq(competitionMembers.userId, me.id), eq(competitionMembers.status, "joined"), eq(competitions.trackId, track.id),
      isNull(competitions.canceledAt), gt(competitions.endsAt, now()))).get();
  if (racing) redirect(`/competitions/${racing.slug}`); // already in one on this topic: take them back to it rather than start a second
  const known = levelsPassed(me.id, track.id);
  const room = MAX_LEVEL - known;
  if (room < 1) return { error: `You have already reached Titan in ${topicLabel(track.name)}. Pick another topic.` };
  hit(`journey:${me.id}`, 60 * MINUTE);

  // a duel is you against one friend: two places, no simulated rival, a shorter finish line, and the link on so they can join at once
  const duel = p.data.mode === "duel", group = p.data.mode !== "solo", goal = Math.min(duel ? 2 : 3, room);
  const v = newContestSchema.safeParse({
    title: duel ? `${me.name.split(" ")[0]}'s ${topicLabel(track.name)} challenge` : `${topicLabel(track.name)} ${group ? "showdown" : "sprint"}`, description: "", trackId: track.id, goalLevels: goal, startInDays: 0,
    days: duel ? 7 : Math.max(7, Math.min(60, goal * 4)), maxHumans: duel ? 2 : group ? 20 : 2, visibility: "private", prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "",
  });
  if (!v.success) return { error: "We could not set up that race. Try the full form instead." };
  const r = createContest(me, { ...v.data, bots: duel ? [] : ["steady"], emails: "", openJoin: false, consent: false });
  if ("error" in r) return { error: r.error };
  if (group && guestAudience(track.id)) db.update(competitions).set({ guestLinkVersion: now() }).where(eq(competitions.slug, r.slug)).run();
  redirect(`/competitions/${r.slug}`);
}

/** Begin the level check: draws the first batch of questions. */
export async function startPlacement(slug: string) {
  const me = await requireUser();
  const j = mine(slug, me.id);
  if (!j || j.step !== "level" || j.pending) redirect(`/start/${slug}`);
  if (!allowed(`placement:${me.id}`, 6)) redirect(`/start/${slug}`);
  hit(`placement:${me.id}`, 24 * 60 * MINUTE);
  finishOrAsk(j.id, j.trackId, me.id, j.lo, j.hi, j.round);
  redirect(`/start/${slug}`);
}

/** Skip the check and start from what exams have already proven (zero for a newcomer). */
export async function skipPlacement(slug: string) {
  const me = await requireUser();
  const j = mine(slug, me.id);
  if (!j || j.step !== "level") redirect(`/start/${slug}`);
  db.update(journeys).set({ step: "setup", pending: null, placed: j.lo }).where(eq(journeys.id, j.id)).run();
  redirect(`/start/${slug}`);
}

/** Mark one batch, narrow the search, then either ask the next batch or settle on a starting level. */
export async function answerPlacement(slug: string, fd: FormData) {
  const me = await requireUser();
  const j = mine(slug, me.id);
  if (!j || j.step !== "level" || !j.pending?.length) redirect(`/start/${slug}`);
  const { right, level } = scoreBatch(j.pending, (id) => str(fd.get(`q${id}`)));
  let { lo, hi } = j;
  if (level >= 1) { if (right >= PLACEMENT_PASS) lo = Math.max(lo, level); else hi = Math.min(hi, level - 1); }
  finishOrAsk(j.id, j.trackId, me.id, lo, hi, j.round);
  redirect(`/start/${slug}`);
}

function finishOrAsk(journeyId: number, trackId: number, userId: number, lo: number, hi: number, round: number) {
  const probe = lo < hi ? nextProbe({ lo, hi, trackId }) : null;
  if (probe) {
    db.update(journeys).set({ lo, hi, round: round + 1, pending: probe.ids }).where(eq(journeys.id, journeyId)).run();
    return;
  }
  db.transaction((tx) => {
    enrol(tx, userId, trackId, "Learning journey");
    const e = tx.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.trackId, trackId))).get()!;
    // only ever raised, so retaking the check can never take away levels already earned
    if (lo > e.placedLevel) tx.update(enrollments).set({ placedLevel: lo, placedAt: now() }).where(eq(enrollments.id, e.id)).run();
    tx.update(journeys).set({ lo, hi: lo, pending: null, placed: lo, step: "setup" }).where(eq(journeys.id, journeyId)).run();
  });
}

/** Final step: set the finish line, rivals, prize and visibility, and open the race. */
export async function launchJourney(slug: string, _: StartState, fd: FormData): Promise<StartState> {
  const me = await requireUser();
  const j = mine(slug, me.id);
  if (!j) return { error: "This journey was not found." };
  if (j.step === "launched" && j.competitionSlug) redirect(`/competitions/${j.competitionSlug}`);
  if (j.step !== "setup" || j.placed === null) return { error: "Finish the level check first." };
  const track = db.select().from(tracks).where(eq(tracks.id, j.trackId)).get()!;
  const room = MAX_LEVEL - j.placed;
  if (room < 1) return { error: "You have already reached Titan in this topic." };

  const num = (k: string) => Number(str(fd.get(k)));
  const group = j.mode === "group";
  const p = newContestSchema.safeParse({
    title: str(fd.get("title")) || `${track.name} ${group ? "showdown" : "sprint"}`, description: str(fd.get("description")),
    trackId: j.trackId, goalLevels: Math.min(num("goalLevels"), room), startInDays: 0, days: num("days"), maxHumans: group ? 20 : 2,
    visibility: group && str(fd.get("visibility")) === "public" ? "public" : "private",
    prizeAmount: str(fd.get("incentive")) === "cash" ? toMinor(str(fd.get("prizeAmount")) || "0") : 0,
    prizeCurrency: str(fd.get("prizeCurrency")) || "USD", prizeSplit: str(fd.get("prizeSplit")) || "winner",
    prizeNote: str(fd.get("incentive")) === "cash" ? str(fd.get("prizeNote")) : "",
  });
  if (!p.success) return { error: "Check the form: a goal of 1 or more levels, a length of 1 to 90 days and a valid prize amount." };
  const bots: BotTier[] = [...Array(Math.min(2, num("steady") || 0)).fill("steady"), ...Array(Math.min(2, num("fierce") || 0)).fill("fierce"), ...Array(Math.min(2, num("casual") || 0)).fill("casual")];
  const r = createContest(me, {
    ...p.data, bots, emails: group ? j.emails : "", openJoin: false, consent: str(fd.get("consent")) === "on",
  });
  if ("error" in r) return { error: r.error };
  await emailRaceInvites(r.slug, me, r.fresh); // the people in the group who already have an account get an email as well as the in-app invitation
  // a group race starts with its invite link on, so a friend with no account can be brought in straight away (only for topics safe to show an outsider)
  if (group && guestAudience(j.trackId)) db.update(competitions).set({ guestLinkVersion: now() }).where(eq(competitions.slug, r.slug)).run();
  db.update(journeys).set({ step: "launched", competitionSlug: r.slug, emails: "" }).where(eq(journeys.id, j.id)).run();
  redirect(`/competitions/${r.slug}`);
}

/** Records that someone looked for a topic the academy does not have, so a manager can see what to write next. */
export async function requestTopic(text: string): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const t = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (t.length < 2 || !allowed(`topic-request:${me.id}`, 20)) return { ok: false };
  hit(`topic-request:${me.id}`, 24 * 60 * MINUTE);
  db.insert(topicRequests).values({ userId: me.id, text: t }).onConflictDoNothing().run();
  return { ok: true };
}

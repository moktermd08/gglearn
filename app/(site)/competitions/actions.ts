"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { competitionCerts, competitionMembers, competitions, contestAttempts, contestTwists, db, tracks, users } from "@/lib/db";
import { openTo } from "@/lib/paths";
import { inRaceScope } from "@/lib/tenancy";
import { attemptStart, canChallenge, MAX_RUNNING_ATTEMPTS, runningAttempts, settleAttempts } from "@/lib/records";
import { declineTwist, reviewTwist, submitTwist } from "@/lib/twists";
import { z } from "zod";
import { requireUser, startSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { clientIp } from "@/lib/rate-limit";
import { admitMember, admitNewGuest, entryFor, guestAudience } from "@/lib/guestLink";
import { markKeyRead } from "@/lib/notifications";
import { emailRaceInvites } from "@/lib/raceMail";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import type { BotTier } from "@/lib/bots";
import { baselineLevel, canView, finishersOf, listedFor, now, standings, stateOf } from "@/lib/competitions";
import { topicLabel } from "@/lib/topicName";
import { cancelContest, switchOffInviteLink } from "@/lib/contestAdmin";
import { enrol, createContest, inviteEmails, newContestSchema, toMinor } from "@/lib/contests";
import { MAX_LEVEL } from "@/lib/levels";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export type CreateState = { error?: string } | null;

/** An unnamed race is named after its topic, so the form does not make someone invent a name first. */
const defaultTitle = (trackId: number) => { const n = db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, trackId)).get()?.n; return n ? `${topicLabel(n)} sprint` : ""; };

export async function createCompetition(_: CreateState, fd: FormData): Promise<CreateState> {
  const me = await requireUser();
  const num = (k: string) => Number(str(fd.get(k)));
  const p = newContestSchema.safeParse({
    title: str(fd.get("title")) || defaultTitle(num("trackId")), description: str(fd.get("description")), trackId: num("trackId"), goalLevels: num("goalLevels"),
    startInDays: num("startInDays"), days: num("days"), maxHumans: num("maxHumans") || 20, visibility: str(fd.get("visibility")),
    prizeAmount: toMinor(str(fd.get("prizeAmount")) || "0"), prizeCurrency: str(fd.get("prizeCurrency")) || "USD",
    prizeSplit: str(fd.get("prizeSplit")) || "winner", prizeNote: str(fd.get("prizeNote")),
  });
  if (!p.success) return { error: "Check the form: a topic, a goal of 1 to 20 levels, a length of 1 to 90 days and a valid prize are required." };
  const bots: BotTier[] = [...Array(num("casual") || 0).fill("casual"), ...Array(num("steady") || 0).fill("steady"), ...Array(num("fierce") || 0).fill("fierce")];
  const r = createContest(me, {
    ...p.data, visibility: p.data.visibility, bots, emails: str(fd.get("emails")),
    openJoin: str(fd.get("openJoin")) === "on", consent: str(fd.get("consent")) === "on", twist: str(fd.get("twist")) === "on",
    scope: str(fd.get("scope")),
  });
  if ("error" in r) return { error: r.error };
  await emailRaceInvites(r.slug, me, r.fresh);
  // the invite link, when asked for and when the topic is safe to show someone with no account
  if (str(fd.get("inviteLink")) === "on" && !str(fd.get("scope")) && guestAudience(p.data.trackId)) db.update(competitions).set({ guestLinkVersion: now() }).where(eq(competitions.slug, r.slug)).run();
  revalidatePath("/competitions");
  redirect(`/competitions/${r.slug}`);
}

export type InviteResult = { message?: string; error?: string } | null;

export async function inviteToCompetition(competitionId: number, _: InviteResult, fd: FormData): Promise<InviteResult> {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || c.createdBy !== me.id) return { error: "Only the organiser can invite people." };
  if (["finished", "canceled"].includes(stateOf(c))) return { error: "This contest is over." };
  if (!allowed(`comp-invite:${me.id}`, 20)) return { error: "Too many invitations. Try again later." };
  hit(`comp-invite:${me.id}`, 60 * MINUTE);
  const { count: n, fresh } = db.transaction((tx) => inviteEmails(tx, c.id, me.id, str(fd.get("emails"))));
  await emailRaceInvites(c.slug, me, fresh);
  if (!n) return { error: "Enter at least one valid email address." };
  revalidatePath(`/competitions/${c.slug}`);
  // identical wording whether or not an address has an account, so this form cannot be used to probe who is registered
  return { message: `Invitations sent to people with an account among the ${n} address${n === 1 ? "" : "es"} you entered.` };
}

/** Join a contest: open public ones, or one you were invited to. */
export async function joinCompetition(competitionId: number, fd: FormData) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c) return;
  if (c.visibility === "public" && str(fd.get("consent")) !== "on") return;
  if (!inRaceScope(me.id, c.scope)) return; // limited to a company or brand: nobody else joins, invited or not
  const t = now();

  db.transaction((tx) => {
    if (["finished", "canceled"].includes(stateOf(c, t))) return;
    const mine = tx.select().from(competitionMembers)
      .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, me.id))).get();
    if (mine?.status === "joined") return;
    const open = c.visibility === "public" && c.joinPolicy === "open" && listedFor(me.id, c.createdBy); // an open race is open to the organiser's arena only
    if (!open && mine?.status !== "invited") return;
    const humans = tx.select({ n: sql<number>`count(*)` }).from(competitionMembers)
      .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).get()?.n ?? 0;
    if (humans >= c.maxHumans) return;
    if (baselineLevel(me.id, c.trackId, Math.max(t, c.startsAt)) >= MAX_LEVEL) return;
    tx.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: me.id, status: "joined", joinedAt: t })
      .onConflictDoUpdate({ target: [competitionMembers.competitionId, competitionMembers.userId], set: { status: "joined", joinedAt: t } }).run();
    enrol(tx, me.id, c.trackId, c.title);
  });
  markKeyRead(me.id, `invite-${c.id}`); // answered (or not possible any more): the invitation no longer needs the bell
  revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
}

async function setMyStatus(competitionId: number, from: ("invited" | "joined")[], to: "declined" | "left") {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || c.createdBy === me.id) return; // the organiser cancels instead of leaving
  db.update(competitionMembers).set({ status: to })
    .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, me.id), inArray(competitionMembers.status, from))).run();
  markKeyRead(me.id, `invite-${c.id}`);
  revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
}
export async function declineInvite(competitionId: number) { await setMyStatus(competitionId, ["invited"], "declined"); }
export async function leaveCompetition(competitionId: number) { await setMyStatus(competitionId, ["joined"], "left"); }

export async function cancelCompetition(competitionId: number) {
  const me = await requireUser();
  // the organiser, or an admin who runs the organiser (lib/contestAdmin.ts): an admin of one company cannot cancel another company's contest or a public campaign
  if (!cancelContest(me, competitionId)) return;
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (c) revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
  revalidatePath("/admin/contests");
}

/** The organiser turns the invite link on, switches it off, or replaces it (the old link stops working). Only for topics that are safe to show an outsider. */
export async function setGuestLink(competitionId: number, mode: "on" | "off" | "new") {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || c.createdBy !== me.id || ["finished", "canceled"].includes(stateOf(c))) return;
  if (mode !== "off" && (c.scope || !guestAudience(c.trackId))) return; // a race limited to a company or brand has no link: people with no account are not in it
  const version = mode === "off" ? null : mode === "on" && c.guestLinkVersion != null ? c.guestLinkVersion : Math.max(now(), (c.guestLinkVersion ?? 0) + 1);
  db.update(competitions).set({ guestLinkVersion: version }).where(eq(competitions.id, c.id)).run();
  revalidatePath(`/competitions/${c.slug}`);
}

/** Someone who is signed in opens the invite link and joins. Everything is re-checked here, not trusted from the page. */
export async function joinWithLink(slug: string, key: string): Promise<string | null> {
  const me = await requireUser();
  const e = entryFor(slug, key);
  if ("error" in e) return e.error === "full" ? "This race is full." : e.error === "over" ? "This race is over." : "This invite link is not valid any more. Ask for a new one.";
  const err = db.transaction((tx) => admitMember(tx, e.c, me));
  if (err) return err;
  revalidatePath(`/competitions/${slug}`);
  revalidatePath("/competitions");
  redirect(`/competitions/${slug}`);
}

/** Someone with no account opens the invite link, makes one, and is in the race. The account has no company, manager access or onboarding. */
export async function joinAsGuest(slug: string, key: string, _: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `guest-join:${await clientIp()}`;
  if (!allowed(ipKey, 10)) return "Too many attempts. Please wait a few minutes and try again.";
  hit(ipKey, 60 * MINUTE);
  const e = entryFor(slug, key);
  if ("error" in e) return e.error === "full" ? "This race is full." : e.error === "over" ? "This race is over." : "This invite link is not valid any more. Ask for a new one.";
  const p = z.object({ name: z.string().min(1).max(80), email: z.string().email().max(120), password: z.string().min(8).max(200) })
    .safeParse({ name: str(fd.get("name")), email: str(fd.get("email")).toLowerCase(), password: str(fd.get("password")) });
  if (!p.success) return "Enter your name, a valid email and a password of 8 or more characters.";
  const r = admitNewGuest(e, { name: p.data.name, email: p.data.email, passwordHash: await hashPassword(p.data.password) });
  if ("error" in r) return r.error;
  await startSession(r.userId);
  redirect(`/competitions/${slug}`);
}

/** One-way on purpose: people joined a public contest agreeing to be seen, but nobody agreed to a private one becoming public. */
export async function makePrivate(competitionId: number) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || c.createdBy !== me.id) return;
  db.update(competitions).set({ visibility: "private", joinPolicy: "invite" }).where(eq(competitions.id, c.id)).run();
  revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
}


/** The organiser records that the prize has been paid out. gglearn only keeps the record; it never moves money. */
export async function markPrizePaid(competitionId: number) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || c.createdBy !== me.id || !c.prizeAmount || stateOf(c) !== "finished") return;
  db.update(competitions).set({ prizePaidAt: now() }).where(and(eq(competitions.id, c.id), isNull(competitions.prizePaidAt))).run();
  revalidatePath(`/competitions/${c.slug}`);
}

/** A participant claims their certificate once the contest is over. Eligibility is re-checked here, never trusted from the page. */
export async function claimCertificate(competitionId: number) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || stateOf(c) !== "finished") return;
  const members = db.select().from(competitionMembers).where(eq(competitionMembers.competitionId, c.id)).all();
  const place = finishersOf(standings(c, members).rows).findIndex((r) => r.userId === me.id);
  if (place < 0) return; // only people who reached the goal
  db.insert(competitionCerts).values({
    competitionId: c.id, userId: me.id, kind: place === 0 ? "champion" : "finisher", place: place + 1,
    code: randomBytes(5).toString("hex").toUpperCase(),
  }).onConflictDoNothing().run();
  revalidatePath(`/competitions/${c.slug}`);
}

// ---- Architect twist (see lib/twists.ts) ----

export type TwistState = { error?: string; message?: string } | null;

/** The drawn racer hands in a rewrite of their question. */
export async function submitTwistAction(twistId: number, _: TwistState, fd: FormData): Promise<TwistState> {
  const me = await requireUser();
  if (!allowed(`twist:${me.id}`, 12)) return { error: "Too many tries. Wait a few minutes." };
  hit(`twist:${me.id}`, 10 * MINUTE);
  const row = db.select({ t: contestTwists, c: competitions, track: tracks.name }).from(contestTwists)
    .innerJoin(competitions, eq(competitions.id, contestTwists.competitionId)).innerJoin(tracks, eq(tracks.id, competitions.trackId))
    .where(eq(contestTwists.id, twistId)).get();
  if (!row) return { error: "This twist was not found." };
  const options = fd.getAll("option").map((o) => (typeof o === "string" ? o : ""));
  const r = await submitTwist(twistId, me.id, { prompt: str(fd.get("prompt")), code: str(fd.get("code")), options, answer: str(fd.get("answer")) }, row.track);
  revalidatePath(`/competitions/${row.c.slug}`);
  return r;
}

async function twistContest(twistId: number) {
  const row = db.select({ slug: competitions.slug }).from(contestTwists)
    .innerJoin(competitions, eq(competitions.id, contestTwists.competitionId)).where(eq(contestTwists.id, twistId)).get();
  return row?.slug;
}

/** The drawn racer passes: the level keeps its normal questions. */
export async function declineTwistAction(twistId: number) {
  const me = await requireUser();
  declineTwist(twistId, me.id);
  const slug = await twistContest(twistId);
  if (slug) revalidatePath(`/competitions/${slug}`);
}

export async function reviewTwistAction(twistId: number, action: "approve" | "reject" | "veto") {
  const me = await requireUser();
  reviewTwist(twistId, me.id, action);
  const slug = await twistContest(twistId);
  if (slug) revalidatePath(`/competitions/${slug}`);
}

/** After a contest ends: start your own clock on the same goal and try to beat the fastest time. */
export async function startChallenge(competitionId: number, fd: FormData) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || !canView(c, me) || !canChallenge(c)) return;
  // a public board shows names, so a person who never joined the contest has to agree to appear on it
  if (c.visibility === "public" && str(fd.get("consent")) !== "on") return;
  if (!allowed(`challenge:${me.id}`, 10)) return;
  hit(`challenge:${me.id}`, 60 * MINUTE);

  db.transaction((tx) => {
    const who = tx.select({ a: users.audience }).from(users).where(eq(users.id, me.id)).get();
    const track = tx.select({ a: tracks.audience }).from(tracks).where(eq(tracks.id, c.trackId)).get();
    if (!who || !track || !openTo(who.a, track.a)) return;
    if (runningAttempts(me.id) >= MAX_RUNNING_ATTEMPTS) return;
    const { startLevel, target } = attemptStart(me.id, c);
    if (target < 1) return; // already a Titan here: nothing left to gain
    tx.insert(contestAttempts).values({ competitionId: c.id, userId: me.id, startLevel, target }).onConflictDoNothing().run();
    enrol(tx, me.id, c.trackId, c.title);
  });
  revalidatePath(`/competitions/${c.slug}`);
}

/** Stop the running attempt; the person can start another. */
export async function abandonChallenge(competitionId: number) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c) return;
  settleAttempts(c); // a goal reached a moment ago is a finish, not an abandon
  db.update(contestAttempts).set({ status: "abandoned", finishedAt: now() })
    .where(and(eq(contestAttempts.competitionId, c.id), eq(contestAttempts.userId, me.id), eq(contestAttempts.status, "active"))).run();
  revalidatePath(`/competitions/${c.slug}`);
}

/** An admin switches off a contest's invite link: moderation, so it works on contests the admin runs, never on others. */
export async function switchOffLinkAsAdmin(competitionId: number) {
  const me = await requireUser();
  if (!switchOffInviteLink(me, competitionId)) return;
  revalidatePath("/admin/contests");
}

"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { competitionCerts, competitionMembers, competitions, db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import type { BotTier } from "@/lib/bots";
import { baselineLevel, finishersOf, now, standings, stateOf } from "@/lib/competitions";
import { enrol, createContest, inviteEmails, newContestSchema, toMinor } from "@/lib/contests";
import { MAX_LEVEL } from "@/lib/levels";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export type CreateState = { error?: string } | null;

export async function createCompetition(_: CreateState, fd: FormData): Promise<CreateState> {
  const me = await requireUser();
  const num = (k: string) => Number(str(fd.get(k)));
  const p = newContestSchema.safeParse({
    title: str(fd.get("title")), description: str(fd.get("description")), trackId: num("trackId"), goalLevels: num("goalLevels"),
    startInDays: num("startInDays"), days: num("days"), maxHumans: num("maxHumans") || 20, visibility: str(fd.get("visibility")),
    prizeAmount: toMinor(str(fd.get("prizeAmount")) || "0"), prizeCurrency: str(fd.get("prizeCurrency")) || "USD",
    prizeSplit: str(fd.get("prizeSplit")) || "winner", prizeNote: str(fd.get("prizeNote")),
  });
  if (!p.success) return { error: "Check the form: a title (3+ characters), a topic, a goal of 1 to 20 levels, a length of 1 to 90 days and a valid prize are required." };
  const bots: BotTier[] = [...Array(num("casual") || 0).fill("casual"), ...Array(num("steady") || 0).fill("steady"), ...Array(num("fierce") || 0).fill("fierce")];
  const r = createContest(me, {
    ...p.data, visibility: p.data.visibility, bots, emails: str(fd.get("emails")),
    openJoin: str(fd.get("openJoin")) === "on", consent: str(fd.get("consent")) === "on",
  });
  if ("error" in r) return { error: r.error };
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
  const n = db.transaction((tx) => inviteEmails(tx, c.id, me.id, str(fd.get("emails"))));
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
  const t = now();

  db.transaction((tx) => {
    if (["finished", "canceled"].includes(stateOf(c, t))) return;
    const mine = tx.select().from(competitionMembers)
      .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, me.id))).get();
    if (mine?.status === "joined") return;
    const open = c.visibility === "public" && c.joinPolicy === "open";
    if (!open && mine?.status !== "invited") return;
    const humans = tx.select({ n: sql<number>`count(*)` }).from(competitionMembers)
      .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).get()?.n ?? 0;
    if (humans >= c.maxHumans) return;
    if (baselineLevel(me.id, c.trackId, Math.max(t, c.startsAt)) >= MAX_LEVEL) return;
    tx.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: me.id, status: "joined", joinedAt: t })
      .onConflictDoUpdate({ target: [competitionMembers.competitionId, competitionMembers.userId], set: { status: "joined", joinedAt: t } }).run();
    enrol(tx, me.id, c.trackId, c.title);
  });
  revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
}

async function setMyStatus(competitionId: number, from: ("invited" | "joined")[], to: "declined" | "left") {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || c.createdBy === me.id) return; // the organiser cancels instead of leaving
  db.update(competitionMembers).set({ status: to })
    .where(and(eq(competitionMembers.competitionId, c.id), eq(competitionMembers.userId, me.id), inArray(competitionMembers.status, from))).run();
  revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
}
export async function declineInvite(competitionId: number) { await setMyStatus(competitionId, ["invited"], "declined"); }
export async function leaveCompetition(competitionId: number) { await setMyStatus(competitionId, ["joined"], "left"); }

export async function cancelCompetition(competitionId: number) {
  const me = await requireUser();
  const c = db.select().from(competitions).where(eq(competitions.id, competitionId)).get();
  if (!c || (c.createdBy !== me.id && me.role !== "admin")) return;
  db.update(competitions).set({ canceledAt: now() }).where(and(eq(competitions.id, c.id), isNull(competitions.canceledAt))).run();
  revalidatePath(`/competitions/${c.slug}`);
  revalidatePath("/competitions");
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

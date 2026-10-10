import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { competitionEmailInvites, competitionMembers, competitions, db, enrollments, tracks, users } from "@/lib/db";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { type BotTier, makeBots } from "@/lib/bots";
import { baselineLevel, now } from "@/lib/competitions";
import { CURRENCIES } from "@/lib/competitions-shared";
import { MAX_LEVEL } from "@/lib/levels";

export const MAX_BOTS = 5, MAX_INVITES = 30, MAX_ACTIVE_PER_USER = 10, MAX_PRIZE_MINOR = 10_000_000; // 100,000 in major units
type Tx = Pick<typeof db, "insert" | "select" | "update" | "delete">;

export function enrol(tx: Tx, userId: number, trackId: number, goal: string) {
  tx.insert(enrollments).values({ userId, trackId, goal: goal.slice(0, 300) }).onConflictDoNothing().run();
}

export const parseEmails = (raw: string) =>
  [...new Set(raw.split(/[\s,;]+/).map((e) => e.toLowerCase()).filter((e) => e.length <= 120 && z.string().email().safeParse(e).success))].slice(0, MAX_INVITES);

/**
 * Emails -> invitations. People with an account get an "invited" row; the rest are remembered and invited the moment an
 * account with that email is created. Callers never learn which addresses matched.
 */
export function inviteEmails(tx: Tx, competitionId: number, inviterId: number, raw: string) {
  const emails = parseEmails(raw);
  if (!emails.length) return 0;
  const found = tx.select({ id: users.id, email: users.email }).from(users).where(and(inArray(users.email, emails), eq(users.status, "active"))).all();
  for (const u of found) {
    tx.insert(competitionMembers).values({ competitionId, kind: "human", userId: u.id, status: "invited", invitedBy: inviterId })
      .onConflictDoUpdate({
        target: [competitionMembers.competitionId, competitionMembers.userId],
        set: { status: "invited", invitedBy: inviterId },
        setWhere: inArray(competitionMembers.status, ["declined", "left"]),
      }).run();
  }
  const known = new Set(found.map((u) => u.email));
  const rest = emails.filter((e) => !known.has(e));
  if (rest.length) {
    tx.insert(competitionEmailInvites).values(rest.map((email) => ({ competitionId, email, invitedBy: inviterId }))).onConflictDoNothing().run();
  }
  return emails.length;
}

/** A new account picks up every contest its email was invited to while it did not exist yet. */
export function claimPendingInvites(tx: Tx, userId: number, email: string) {
  const mail = email.toLowerCase();
  const pending = tx.select().from(competitionEmailInvites).where(eq(competitionEmailInvites.email, mail)).all();
  if (!pending.length) return;
  const open = tx.select({ id: competitions.id }).from(competitions)
    .where(and(inArray(competitions.id, pending.map((p) => p.competitionId)), isNull(competitions.canceledAt), sql`${competitions.endsAt} > ${now()}`)).all();
  const openIds = new Set(open.map((o) => o.id));
  for (const p of pending) {
    if (!openIds.has(p.competitionId)) continue;
    tx.insert(competitionMembers).values({ competitionId: p.competitionId, kind: "human", userId, status: "invited", invitedBy: p.invitedBy })
      .onConflictDoNothing().run();
  }
  tx.delete(competitionEmailInvites).where(eq(competitionEmailInvites.email, mail)).run();
}

export type NewContest = {
  title: string; description: string; trackId: number; goalLevels: number; startInDays: number; days: number; maxHumans: number;
  visibility: "public" | "private"; openJoin: boolean; consent: boolean; bots: BotTier[]; emails: string;
  prizeAmount: number; prizeCurrency: string; prizeSplit: "winner" | "top3"; prizeNote: string;
};

export const newContestSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(500),
  trackId: z.number().int().positive(),
  goalLevels: z.number().int().min(1).max(MAX_LEVEL),
  startInDays: z.number().int().min(0).max(30),
  days: z.number().int().min(1).max(90),
  maxHumans: z.number().int().min(2).max(50),
  visibility: z.enum(["public", "private"]),
  prizeAmount: z.number().int().min(0).max(MAX_PRIZE_MINOR),
  prizeCurrency: z.enum(Object.keys(CURRENCIES) as [string, ...string[]]),
  prizeSplit: z.enum(["winner", "top3"]),
  prizeNote: z.string().max(200),
});

/** Shared by the classic form and the guided journey. Does not redirect; returns the new contest's slug or an error message. */
export function createContest(me: { id: number }, v: NewContest): { slug: string } | { error: string } {
  if (!allowed(`comp-create:${me.id}`, 10)) return { error: "You are creating contests too quickly. Try again later." };
  if (v.bots.length > MAX_BOTS) return { error: `At most ${MAX_BOTS} bots per contest.` };
  const isPublic = v.visibility === "public";
  if (isPublic && !v.consent) return { error: "Confirm that participants' names, photos and progress will be visible to anyone." };
  if (v.prizeAmount > 0 && v.prizeNote.trim() === "") return { error: "Say who pays the prize and how (for example: \"Paid by the L&D budget in the week after the contest\")." };
  if (!db.select().from(tracks).where(eq(tracks.id, v.trackId)).get()) return { error: "Pick a topic from the list." };
  const active = db.select({ n: sql<number>`count(*)` }).from(competitions)
    .where(and(eq(competitions.createdBy, me.id), isNull(competitions.canceledAt), sql`${competitions.endsAt} > ${now()}`)).get()?.n ?? 0;
  if (active >= MAX_ACTIVE_PER_USER) return { error: `You already run ${MAX_ACTIVE_PER_USER} contests. Wait for one to finish or cancel one.` };
  if (baselineLevel(me.id, v.trackId, now()) >= MAX_LEVEL) return { error: "You have already reached Titan in this topic. Pick another." };

  hit(`comp-create:${me.id}`, 60 * MINUTE);
  const startsAt = now() + v.startInDays * 86400, slug = randomBytes(6).toString("base64url");
  const bots = makeBots(slug, v.bots);

  db.transaction((tx) => {
    const c = tx.insert(competitions).values({
      slug, title: v.title, description: v.description, trackId: v.trackId, createdBy: me.id, visibility: v.visibility,
      joinPolicy: isPublic && v.openJoin ? "open" : "invite",
      goalLevels: v.goalLevels, startsAt, endsAt: startsAt + v.days * 86400, maxHumans: v.maxHumans,
      prizeAmount: v.prizeAmount, prizeCurrency: v.prizeCurrency, prizeSplit: v.prizeSplit, prizeNote: v.prizeNote.trim(),
    }).returning().get();
    tx.insert(competitionMembers).values({ competitionId: c.id, kind: "human", userId: me.id, status: "joined", joinedAt: now() }).run();
    if (bots.length) {
      tx.insert(competitionMembers).values(bots.map((b) => ({
        competitionId: c.id, kind: "bot" as const, status: "joined" as const, joinedAt: startsAt,
        botName: b.name, botTagline: b.tagline, botStyle: b.style, botPace: b.pace, botSeed: b.seed,
      }))).run();
    }
    if (v.emails) inviteEmails(tx, c.id, me.id, v.emails);
    enrol(tx, me.id, v.trackId, v.title);
  });
  return { slug };
}

/** Whole currency units typed by a person ("25" or "25.50") -> minor units. NaN when it is not a non-negative number. */
export const toMinor = (raw: string) => {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

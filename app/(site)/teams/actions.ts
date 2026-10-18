"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, teamMembers, teams, users } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { MAX_OWNED_TEAMS, addMember, membersOf, teamByToken } from "@/lib/teams";
import { createAssignment, enrolInClass, removeAssignment } from "@/lib/classes";
import { createContest, newContestSchema } from "@/lib/contests";
import { emailRaceInvites } from "@/lib/raceMail";
import { pickableTopics } from "@/lib/pickTopics";
import { topicLabel } from "@/lib/topicName";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
export type TeamState = { error?: string } | null;

/** Starts a team and makes its owner the first member. */
export async function createTeam(_: TeamState, fd: FormData): Promise<TeamState> {
  const me = await requireUser();
  const name = str(fd.get("name")).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return { error: "Give the team a name of 2 to 60 characters." };
  if (!allowed(`team-create:${me.id}`, 10)) return { error: "You are making teams too quickly. Try again later." };
  const owned = Number(db.select({ n: sql<number>`count(*)` }).from(teams).where(and(eq(teams.ownerId, me.id), isNull(teams.archivedAt))).get()?.n ?? 0);
  if (owned >= MAX_OWNED_TEAMS) return { error: `You already run ${MAX_OWNED_TEAMS} teams. Close one first.` };
  hit(`team-create:${me.id}`, 60 * MINUTE);
  const kind = str(fd.get("kind")) === "class" ? "class" : "team";
  const t = db.insert(teams).values({ name, ownerId: me.id, kind }).returning().get();
  const no = addMember(t.id, me.id, { force: true });
  if (no) return { error: no };
  redirect(`/teams/${t.id}`);
}

/** Joins through the team's link. The signature in the link is what lets a person in, not the team's number. */
export async function joinTeam(token: string): Promise<TeamState> {
  const me = await requireUser();
  const t = teamByToken(token);
  if (!t) return { error: "This team link is not valid." };
  if (!allowed(`team-join:${me.id}`, 20)) return { error: "Too many tries. Wait a few minutes." };
  hit(`team-join:${me.id}`, 60 * MINUTE);
  const no = addMember(t.id, me.id);
  if (no) return { error: no };
  enrolInClass(t.id, me.id); // a class puts its new student on the assigned topics
  redirect(`/teams/${t.id}`);
}

const memberOf = (teamId: number, userId: number) => !!db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).get();

/** Leaving is always allowed. An owner who leaves hands the team to the longest-standing member, or closes it if nobody is left. */
export async function leaveTeam(teamId: number) {
  const me = await requireUser();
  const t = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!t || !memberOf(teamId, me.id)) redirect("/teams");
  db.transaction((tx) => {
    tx.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, me.id))).run();
    if (t!.ownerId !== me.id) return;
    const next = tx.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).orderBy(teamMembers.joinedAt).get();
    if (next) tx.update(teams).set({ ownerId: next.userId }).where(eq(teams.id, teamId)).run();
    else tx.update(teams).set({ archivedAt: Math.floor(Date.now() / 1000) }).where(eq(teams.id, teamId)).run();
  });
  revalidatePath("/teams");
  redirect("/teams");
}

/** Owner only: take someone out. */
export async function removeFromTeam(teamId: number, userId: number) {
  const me = await requireUser();
  const t = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!t || t.ownerId !== me.id || userId === me.id) return;
  db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))).run();
  revalidatePath(`/teams/${teamId}`);
}

/** Owner only: stop (or start again) letting new people in through the link. */
export async function setTeamOpen(teamId: number, open: boolean) {
  const me = await requireUser();
  const t = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!t || t.ownerId !== me.id || t.archivedAt) return;
  db.update(teams).set({ joinOpen: open }).where(eq(teams.id, teamId)).run();
  revalidatePath(`/teams/${teamId}`);
}

/** Owner only: close the team for good. The members keep their own progress; only the team goes. */
export async function closeTeam(teamId: number) {
  const me = await requireUser();
  const t = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!t || t.ownerId !== me.id) return;
  db.update(teams).set({ archivedAt: Math.floor(Date.now() / 1000), joinOpen: false }).where(eq(teams.id, teamId)).run();
  revalidatePath("/teams");
  redirect("/teams");
}

/**
 * Owner only: a race for the whole team on one topic. Everyone in the team is invited at once and finds the invitation on their dashboard
 * (and by email when email is set up). The race is private, with no simulated rivals: the point is the team against itself.
 */
export async function startTeamRace(teamId: number, _: TeamState, fd: FormData): Promise<TeamState> {
  const me = await requireUser();
  const t = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!t || t.archivedAt || t.ownerId !== me.id) return { error: "Only the team's owner can start a race." };
  const p = z.object({ trackId: z.coerce.number().int().positive(), goal: z.coerce.number().int().min(1).max(10), days: z.coerce.number().int().min(3).max(60) })
    .safeParse({ trackId: str(fd.get("trackId")), goal: str(fd.get("goal")) || 3, days: str(fd.get("days")) || 14 });
  if (!p.success) return { error: "Pick a topic, a goal of 1 to 10 levels and 3 to 60 days." };
  const topic = pickableTopics(me).find((x) => x.id === p.data.trackId);
  if (!topic) return { error: "Pick a topic from the list." };
  const others = membersOf(t).filter((m) => m.userId !== me.id);
  if (!others.length) return { error: "Nobody else is in the team yet. Send the team link first." };
  const emails = db.select({ e: users.email }).from(users).where(sql`${users.id} in (${sql.join(others.map((m) => sql`${m.userId}`), sql`, `)})`).all().map((r) => r.e).join(",");
  const v = newContestSchema.safeParse({
    title: `${t.name}: ${topicLabel(topic.name)}`.slice(0, 80), description: "", trackId: topic.id, goalLevels: p.data.goal, startInDays: 0, days: p.data.days,
    maxHumans: Math.min(50, Math.max(others.length + 2, 5)), visibility: "private", prizeAmount: 0, prizeCurrency: "USD", prizeSplit: "winner", prizeNote: "",
  });
  if (!v.success) return { error: "We could not set that race up. Try a different topic or goal." };
  const r = createContest(me, { ...v.data, bots: [], emails, openJoin: false, consent: false });
  if ("error" in r) return { error: r.error };
  await emailRaceInvites(r.slug, me, r.fresh);
  redirect(`/competitions/${r.slug}`);
}


/** Teacher only: "reach level N in this topic within so many days". */
export async function setAssignment(teamId: number, _: TeamState, fd: FormData): Promise<TeamState> {
  const me = await requireUser();
  const r = createAssignment(me.id, teamId, Number(str(fd.get("trackId"))), Number(str(fd.get("level"))), Number(str(fd.get("days"))));
  if ("error" in r) return { error: r.error };
  revalidatePath(`/teams/${teamId}`);
  return null;
}

export async function dropAssignment(teamId: number, assignmentId: number) {
  const me = await requireUser();
  removeAssignment(me.id, assignmentId);
  revalidatePath(`/teams/${teamId}`);
}

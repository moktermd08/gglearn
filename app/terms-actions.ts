"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, terms } from "@/lib/db";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { markCheck, parseTermInput, sameTerm, startCheck, myTerms } from "@/lib/terms";
import { removeTerm } from "@/lib/termsAdmin";
import { recordStudy, removeStudyRole, roleSlug, saveStudyRole, startPlacementStage, startRankExam, startRoleCheck } from "@/lib/termStudy";
import { beginJourney } from "@/lib/termJourney";
import type { SetupState } from "@/lib/setup";

/** What a candidate does with the term bank: add their own terms, make a check from the terms they picked, and answer it. All as themselves. */

const MAX_OWN = 200;

export async function addOwnTermAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const who = await actingUser();
  if (!who) return { error: "Sign in again to add a term." };
  const p = parseTermInput({ term: fd.get("term"), meaning: fd.get("meaning"), tier: fd.get("tier"), groupName: fd.get("groupName") });
  if ("error" in p) return p;
  const have = myTerms(who.me.id);
  if (have.length >= MAX_OWN) return { error: `You can keep up to ${MAX_OWN} terms of your own.` };
  if (have.some((t) => sameTerm(t.term, p.ok.term))) return { error: "You have already added that term." };
  db.insert(terms).values({ ownerUserId: who.me.id, bankId: null, term: p.ok.term, meaning: p.ok.meaning, tier: p.ok.tier, groupName: p.ok.groupName }).run();
  await logViewAsUse(who.viewedBy, who.me, `added the term “${p.ok.term}”`);
  revalidatePath("/terms");
  return { done: `“${p.ok.term}” added. It is private to you until a super admin adds it to a shared bank.` };
}

export async function removeOwnTermAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const id = Number(fd.get("id"));
  const mine = db.select({ id: terms.id }).from(terms).where(and(eq(terms.id, id), eq(terms.ownerUserId, who.me.id))).get();
  if (!mine) return;
  removeTerm(id);
  revalidatePath("/terms");
}

export async function startCheckAction(_: string | null, fd: FormData): Promise<string | null> {
  const who = await actingUser();
  if (!who) return "Sign in again to start a check.";
  const ids = fd.getAll("term").map((v) => Number(v));
  const r = startCheck(who.me, Number(fd.get("claimed")), ids);
  if ("error" in r) return r.error;
  await logViewAsUse(who.viewedBy, who.me, `started term check ${r.id}`);
  redirect(`/terms/check/${r.id}`);
}

export async function submitCheckAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const examId = Number(fd.get("exam"));
  const chosen: Record<number, number> = {};
  for (const [k, v] of fd.entries()) {
    const m = /^a_(\d+)$/.exec(k);
    if (m && typeof v === "string" && /^\d+$/.test(v)) chosen[Number(m[1])] = Number(v);
  }
  markCheck(who.me, examId, chosen);
  await logViewAsUse(who.viewedBy, who.me, `finished term check ${examId}`);
  revalidatePath("/terms");
  redirect(`/terms/check/${examId}`);
}

// ---- learning a role's terms

const roleUrl = (role: string, level: number, extra = "") => `/terms/role/${roleSlug(role.trim().toLowerCase())}?level=${level}${extra}`;

export async function chooseRoleAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const role = String(fd.get("role") ?? ""), level = Number(fd.get("level"));
  const r = saveStudyRole(who.me.id, role, level);
  if ("error" in r) redirect("/terms");
  revalidatePath("/terms");
  redirect(roleUrl(role, level));
}

export async function removeStudyRoleAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  removeStudyRole(who.me.id, String(fd.get("role") ?? ""));
  revalidatePath("/terms");
}

/** One answer in a study sitting. Returns whether it was saved, so the card can say so if it was not. */
export async function studyAnswerAction(termId: number, knew: boolean): Promise<boolean> {
  const who = await actingUser();
  if (!who || !Number.isInteger(termId)) return false;
  return "ok" in recordStudy(who.me.id, termId, knew);
}

export async function startRoleCheckAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const role = String(fd.get("role") ?? ""), level = Number(fd.get("level"));
  const r = startRoleCheck(who.me, role, level);
  if ("error" in r) redirect(roleUrl(role, level, `&error=${encodeURIComponent(r.error)}`));
  await logViewAsUse(who.viewedBy, who.me, `started a term check for ${role}`);
  redirect(`/terms/check/${r.id}`);
}

/** A rank exam for a role level: the same list, asked as deeply as the rank. */
export async function startRankExamAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const role = String(fd.get("role") ?? ""), level = Number(fd.get("level")), rank = Number(fd.get("rank"));
  const r = startRankExam(who.me, role, level, rank);
  if ("error" in r) redirect(roleUrl(role, level, `&error=${encodeURIComponent(r.error)}`));
  await logViewAsUse(who.viewedBy, who.me, `started a rank ${rank} term exam for ${role}`);
  redirect(`/terms/check/${r.id}`);
}

/** One rank of the climb that finds where someone stands. */
export async function startPlacementAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const role = String(fd.get("role") ?? ""), level = Number(fd.get("level")), stage = Number(fd.get("stage"));
  const r = startPlacementStage(who.me, role, level, stage);
  if ("error" in r) redirect(roleUrl(role, level, `&error=${encodeURIComponent(r.error)}`));
  await logViewAsUse(who.viewedBy, who.me, `started placement rank ${stage} for ${role}`);
  redirect(`/terms/check/${r.id}`);
}

/** The start screen: choose what to learn and how much is known already. Someone new starts studying; someone who knows some is placed from the first rank. */
export async function beginAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const role = String(fd.get("role") ?? ""), level = Number(fd.get("level")), how = String(fd.get("how") ?? "some");
  const r = beginJourney(who.me.id, role, level, fd.get("goal") === "on");
  if ("error" in r) redirect("/terms/start?error=" + encodeURIComponent(r.error));
  revalidatePath("/terms");
  if (how === "new") redirect(`/terms/study?role=${roleSlug(role.trim().toLowerCase())}&level=${level}`);
  const p = startPlacementStage(who.me, role, level, 1);
  if ("error" in p) redirect(roleUrl(role, level, `&error=${encodeURIComponent(p.error)}`));
  await logViewAsUse(who.viewedBy, who.me, `began placement for ${role}`);
  redirect(`/terms/check/${p.id}`);
}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, terms } from "@/lib/db";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { markCheck, parseTermInput, sameTerm, startCheck, myTerms } from "@/lib/terms";
import { removeTerm } from "@/lib/termsAdmin";
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

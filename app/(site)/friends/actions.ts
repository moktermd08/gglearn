"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { befriendByLink, cheer, remove, requestByEmail, respond } from "@/lib/friends";
import { referrerOf } from "@/lib/referrals";

export type FriendState = { error?: string; message?: string } | null;

/** Asks someone to be friends by email. The answer is the same whether or not the address has an account. */
export async function addFriendByEmail(_: FriendState, fd: FormData): Promise<FriendState> {
  const me = await requireUser();
  if (!allowed(`friend-ask:${me.id}`, 20)) return { error: "You are asking a lot of people. Try again in a while." };
  const email = z.string().email().max(120).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  hit(`friend-ask:${me.id}`, 60 * MINUTE);
  const r = requestByEmail(me.id, email.data);
  revalidatePath("/friends");
  return "error" in r ? { error: r.error } : { message: r.message };
}

export async function answerRequest(id: number, yes: boolean) {
  const me = await requireUser();
  respond(me.id, id, yes);
  revalidatePath("/friends");
}

export async function removeFriend(userId: number) {
  const me = await requireUser();
  remove(me.id, userId);
  revalidatePath("/friends");
}

export async function cheerEvent(key: string) {
  const me = await requireUser();
  if (allowed(`cheer:${me.id}`, 60)) { hit(`cheer:${me.id}`, MINUTE); cheer(me.id, key); }
  revalidatePath("/friends");
}

/** Someone opens a friend link and agrees: they are friends at once. */
export async function acceptFriendLink(code: string): Promise<FriendState> {
  const me = await requireUser();
  const owner = referrerOf(code);
  if (owner === null) return { error: "This friend link is not valid." };
  const r = befriendByLink(owner, me.id);
  if ("error" in r) return { error: r.error };
  redirect("/friends");
}

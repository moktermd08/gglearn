"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cancelDuel, fillWithBot, joinDuel, startDuel } from "@/lib/duel";

export type DuelActionState = { error?: string } | null;
const who = (u: { id: number; name: string; audience: "staff" | "customer" }) => ({ id: u.id, name: u.name, audience: u.audience });

/** Starts a duel on a topic and takes the person to its room: a friend duel waits there with a link to send, a rival duel begins at once. */
export async function startDuelAction(trackId: number, mode: "friend" | "bot"): Promise<DuelActionState> {
  const me = await requireUser();
  const r = startDuel(who(me), trackId, mode);
  if ("error" in r) return { error: r.error };
  redirect(`/d/${r.code}`);
}

/** A friend opens the link and takes the second seat. */
export async function joinDuelAction(code: string): Promise<DuelActionState> {
  const me = await requireUser();
  const r = joinDuel(code, who(me));
  if ("error" in r) return { error: r.error };
  redirect(`/d/${code}`);
}

export async function fillWithBotAction(code: string): Promise<DuelActionState> {
  const me = await requireUser();
  const r = fillWithBot(code, who(me));
  if ("error" in r) return { error: r.error };
  redirect(`/d/${code}`);
}

export async function cancelDuelAction(code: string) {
  const me = await requireUser();
  cancelDuel(code, who(me));
  redirect("/dashboard");
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, shareCards } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { type ShareKind, snapshotFor } from "@/lib/share";

const KINDS = ["badge", "season", "level", "streak"] as const;

/** Makes (or refreshes) the public card for something the person has earned, then opens it. */
export async function createShare(kind: ShareKind, ref: string) {
  const me = await requireUser();
  if (!(KINDS as readonly string[]).includes(kind) || ref.length > 60) redirect("/achievements");
  if (!allowed(`share:${me.id}`, 30)) redirect("/achievements");
  hit(`share:${me.id}`, 60 * MINUTE);
  const snap = snapshotFor(me, kind, ref);
  if (!snap) redirect("/achievements");
  const live = db.select().from(shareCards).where(and(eq(shareCards.userId, me.id), eq(shareCards.kind, snap.kind), eq(shareCards.ref, snap.ref), isNull(shareCards.revokedAt))).get();
  let code = live?.code;
  if (live) db.update(shareCards).set({ headline: snap.headline, title: snap.title, subtitle: snap.subtitle, tone: snap.tone, name: snap.name }).where(eq(shareCards.id, live.id)).run();
  else db.insert(shareCards).values({ ...snap, userId: me.id, code: (code = randomBytes(7).toString("base64url")) }).run();
  redirect(`/s/${code}`);
}

/** Takes a card down: its page and image stop working at once. */
export async function revokeShare(id: number) {
  const me = await requireUser();
  db.update(shareCards).set({ revokedAt: Math.floor(Date.now() / 1000) }).where(and(eq(shareCards.id, id), eq(shareCards.userId, me.id), isNull(shareCards.revokedAt))).run();
  revalidatePath("/achievements");
  redirect("/achievements");
}

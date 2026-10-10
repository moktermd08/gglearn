"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, userAvatars } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MINUTE, allowed, hit } from "@/lib/rate-limit";
import { sniffImage } from "@/lib/image";

const MAX_BYTES = 300 * 1024;

export type PhotoState = { error?: string; ok?: boolean } | null;

export async function setPhoto(_: PhotoState, fd: FormData): Promise<PhotoState> {
  const me = await requireUser();
  if (!allowed(`photo:${me.id}`, 10)) return { error: "Too many uploads. Try again later." };
  hit(`photo:${me.id}`, 60 * MINUTE);
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > MAX_BYTES) return { error: "That photo is over 300 KB. Pick a smaller or more compressed one." };
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(data); // trust the bytes, not the filename or declared type
  if (!mime) return { error: "Use a JPEG, PNG or WebP photo." };
  db.insert(userAvatars).values({ userId: me.id, mime, data })
    .onConflictDoUpdate({ target: userAvatars.userId, set: { mime, data, updatedAt: Math.floor(Date.now() / 1000) } }).run();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removePhoto() {
  const me = await requireUser();
  db.delete(userAvatars).where(eq(userAvatars.userId, me.id)).run();
  revalidatePath("/", "layout");
}

"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/lib/db";
import { userOfUnsubToken } from "@/lib/nudges";

/** Switches reminder and recap emails off for the person the link belongs to. No sign-in needed: the signed link is the proof, as in every email's footer. */
export async function unsubscribe(token: string) {
  const id = userOfUnsubToken(token);
  if (id) db.update(users).set({ emailNudges: "off" }).where(eq(users.id, id)).run();
  redirect(`/unsubscribe/${token}?done=1`);
}

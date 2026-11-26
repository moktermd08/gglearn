"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { chooseOwnRole } from "@/lib/ownRole";
import { setFlash } from "@/lib/flash";

/** A person who signed up on their own says what they do now, which gives them a career path to climb. */
export async function chooseMyRoleAction(fd: FormData) {
  const who = await actingUser();
  if (!who) return;
  const r = chooseOwnRole(who.me, String(fd.get("role") ?? ""));
  if ("error" in r) {
    await setFlash("/journey", r.error);
    redirect("/journey");
  }
  await logViewAsUse(who.viewedBy, who.me, `set their own role to ${r.ok}`);
  for (const p of ["/journey", "/goal", "/dashboard", "/terms"]) revalidatePath(p);
  redirect("/journey");
}

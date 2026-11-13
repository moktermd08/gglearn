"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/lib/db";
import { realUser, refuseWhileViewingAs, revokeSessions, viewAsState } from "@/lib/auth";
import { startViewAs, stopViewAs } from "@/lib/impersonation";
import { isSuperAdmin } from "@/lib/superAdmin";
import { recordSecurityEvent } from "@/lib/securityLog";
import { clientIp } from "@/lib/rate-limit";

/**
 * What only a super admin can do to someone else's account. Every action here works from the REAL signed-in person (realUser), never from
 * whoever is being viewed, checks they are a super admin again, and writes to the security log.
 */

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** Starts viewing as someone. Returns why it was refused; on success goes to their dashboard. */
export async function startViewAsAction(_: string | null, fd: FormData): Promise<string | null> {
  const real = await realUser();
  if (!real || !isSuperAdmin(real)) return "Only a super admin can view as someone else.";
  const id = Number(fd.get("userId"));
  if (!Number.isInteger(id) || id <= 0) return "Choose a person.";
  const no = await startViewAs(real, id, text(fd.get("reason")), (await viewAsState()) !== null);
  if (no) return no;
  redirect("/dashboard");
}

/** Ends viewing as someone and goes back to their page in People. Safe to call when nothing is on. */
export async function stopViewAsAction() {
  const real = await realUser();
  const id = await stopViewAs(real);
  redirect(id ? `/admin/people?edit=${id}` : "/admin/people");
}

/** Changes someone's name or email. Their sessions end when the email changes. Not for yourself or another super admin, and not while viewing as someone. */
export async function saveDetailsAction(_: string | null, fd: FormData): Promise<string | null> {
  const real = await realUser();
  if (!real || !isSuperAdmin(real)) return "Only a super admin can do this.";
  if (await refuseWhileViewingAs()) return "Exit the view first.";
  const id = Number(fd.get("userId"));
  const target = Number.isInteger(id) ? db.select().from(users).where(eq(users.id, id)).get() : undefined;
  if (!target) return "That person does not exist.";
  if (target.id === real.id || isSuperAdmin(target)) return "A super admin's own details are changed on their profile, not here.";
  const p = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().toLowerCase().email().max(120) }).safeParse({ name: text(fd.get("name")), email: text(fd.get("email")) });
  if (!p.success) return "Enter a name (up to 80 characters) and a valid email.";
  const changes: string[] = [];
  if (p.data.name !== target.name) changes.push(`name "${target.name}" -> "${p.data.name}"`);
  if (p.data.email !== target.email) {
    if (db.select({ id: users.id }).from(users).where(eq(users.email, p.data.email)).get()) return "Another account already uses that email.";
    changes.push(`email ${target.email} -> ${p.data.email}`);
  }
  if (!changes.length) return "Nothing changed.";
  db.update(users).set({ name: p.data.name, email: p.data.email }).where(eq(users.id, target.id)).run();
  if (p.data.email !== target.email) revokeSessions(target.id); // the old address no longer proves who they are
  recordSecurityEvent({ actorId: real.id, targetId: target.id, action: "details_edit", detail: changes.join("; "), ip: await clientIp() });
  revalidatePath("/admin/people");
  return "ok";
}

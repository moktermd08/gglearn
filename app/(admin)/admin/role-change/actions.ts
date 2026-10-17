"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { applyRoleChange } from "@/lib/roleChange";
import type { SetupState } from "@/lib/setup";

/** On success go to a confirmation page: the form is gone once the role has changed, so a message beside it would vanish. */
export async function changeRoleAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = applyRoleChange(await requireManager(), fd);
  if (r?.error) return { error: r.error };
  if (!r?.done) return null;
  for (const p of ["/admin/role-change", "/admin/people", "/admin/compliance", "/admin/careers", "/admin/access"]) revalidatePath(p);
  redirect(`/admin/role-change?user=${Number(fd.get("userId"))}&done=1`);
}

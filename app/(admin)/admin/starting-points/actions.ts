"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { applyRoleStarts, grantCredit, revokeCredit } from "@/lib/credits";
import type { SetupState } from "@/lib/setup";

const refresh = () => { for (const p of ["/admin/starting-points", "/admin/people", "/admin/compliance", "/map", "/map/public", "/map/software", "/dashboard"]) revalidatePath(p); };

/** Give a person a starting level in one track. The rules (who, how much, reason) are in lib/credits.ts. */
export async function giveStartAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = grantCredit(await requireManager(), fd);
  if (r?.done) refresh();
  return r;
}

export async function takeBackStartAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = revokeCredit(await requireManager(), fd);
  if (r?.done) refresh();
  return r;
}

/** Confirm, in one go, the starting levels the person's job role normally holds. */
export async function confirmRoleStartsAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = applyRoleStarts(await requireManager(), Number(fd.get("userId")));
  if (r?.done) refresh();
  return r;
}

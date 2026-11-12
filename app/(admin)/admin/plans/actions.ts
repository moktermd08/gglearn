"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { addItem, removeItem, signOff } from "@/lib/planItems";
import type { SetupState } from "@/lib/setup";

/** A manager or admin sets an item for someone they run. The rules are in lib/planItems.ts, not here, so a forged form changes nothing. */
export async function addForAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await requireManager();
  const r = addItem(me, Number(fd.get("userId")), fd);
  if (r?.done) revalidatePath("/admin/plans");
  return r;
}

export async function signOffAction(fd: FormData) {
  const me = await requireManager();
  signOff(me, Number(fd.get("id")), fd.get("undo") === "1");
  revalidatePath("/admin/plans");
}

export async function removeForAction(fd: FormData) {
  const me = await requireManager();
  removeItem(me, Number(fd.get("id")));
  revalidatePath("/admin/plans");
}

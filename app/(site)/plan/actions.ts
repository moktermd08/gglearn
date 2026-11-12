"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { addItem, logItem, removeItem } from "@/lib/planItems";
import type { SetupState } from "@/lib/setup";

/** A person adds an item for themself. */
export async function addMyItemAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await requireUser();
  const r = addItem(me, me.id, fd);
  if (r?.done) revalidatePath("/plan");
  return r;
}

export async function logItemAction(fd: FormData) {
  const me = await requireUser();
  logItem(me, Number(fd.get("id")));
  revalidatePath("/plan");
}

export async function removeItemAction(fd: FormData) {
  const me = await requireUser();
  removeItem(me, Number(fd.get("id")));
  revalidatePath("/plan");
}

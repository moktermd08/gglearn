"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { addItem, logItem, removeItem } from "@/lib/planItems";
import { addPlan, removePlan } from "@/lib/planSets";
import type { SetupState } from "@/lib/setup";

/** A person adds an item for themself, to the main plan or one of their extra plans. */
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

/** A person makes an extra plan for themself. */
export async function addMyPlanAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const me = await requireUser();
  const r = addPlan(me, me.id, fd);
  if (r?.done) revalidatePath("/plan");
  return r;
}

export async function removePlanAction(fd: FormData) {
  const me = await requireUser();
  removePlan(me, Number(fd.get("id")));
  revalidatePath("/plan");
  redirect("/plan");
}

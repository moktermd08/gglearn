"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";

export async function markAllReadAction() {
  const me = await requireUser();
  markAllRead(me.id);
  revalidatePath("/", "layout"); // the bell in the header
}

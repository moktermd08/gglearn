"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dismissMessage } from "@/lib/accountControl";

/** The person presses OK on the message the administrators left for them. */
export async function dismissMessageAction() {
  const me = await requireUser();
  dismissMessage(me.id);
  revalidatePath("/", "layout");
}

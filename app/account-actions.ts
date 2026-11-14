"use server";
import { revalidatePath } from "next/cache";
import { actingUser, logViewAsUse } from "@/lib/auth";
import { dismissMessage } from "@/lib/accountControl";

/**
 * The person presses OK on the message the administrators left for them. A learner-level action, so a super admin viewing as them may press it too;
 * that is then logged under the super admin like everything else done through a view (lib/auth.ts).
 */
export async function dismissMessageAction() {
  const a = await actingUser();
  if (!a) return;
  await logViewAsUse(a.viewedBy, a.me, "dismissMessageAction");
  dismissMessage(a.me.id);
  revalidatePath("/", "layout");
}

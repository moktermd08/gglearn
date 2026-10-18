"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setPersonOptIn } from "@/lib/openLeague";

/** Choose (or stop) playing the weekly league against people from other companies. */
export async function chooseCrossLeague(on: boolean) {
  const me = await requireUser();
  setPersonOptIn(me, on);
  revalidatePath("/league");
}

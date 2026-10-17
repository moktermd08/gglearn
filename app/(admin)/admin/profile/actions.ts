"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { saveSectionForm } from "@/lib/profileAdmin";
import type { SetupState } from "@/lib/setup";

export async function saveSection(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = saveSectionForm(await requireManager(), fd);
  if (r?.done) revalidatePath("/admin/profile");
  return r;
}

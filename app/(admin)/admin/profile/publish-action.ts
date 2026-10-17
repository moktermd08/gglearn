"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { publishProfile } from "@/lib/profilePublish";
import type { SetupState } from "@/lib/setup";

export async function publishAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const scope = fd.get("scope"), refId = Number(fd.get("refId"));
  if ((scope !== "company" && scope !== "brand") || !Number.isInteger(refId)) return { error: "Pick a company or brand." };
  const r = publishProfile(await requireManager(), scope, refId, { material: fd.get("material") === "on", note: String(fd.get("note") ?? "").trim().slice(0, 500) });
  if (r?.done) { revalidatePath("/admin/profile"); revalidatePath("/admin/paths"); }
  return r;
}

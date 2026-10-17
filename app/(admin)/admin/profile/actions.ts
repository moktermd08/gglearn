"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { addCustomField, retireCustomField, saveSectionForm } from "@/lib/profileAdmin";
import { applyTemplate } from "@/lib/profileTemplates";
import type { SetupState } from "@/lib/setup";

export async function saveSection(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = saveSectionForm(await requireManager(), fd);
  if (r?.done) revalidatePath("/admin/profile");
  return r;
}

export async function addFieldAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = addCustomField(await requireManager(), fd);
  if (r?.done) revalidatePath("/admin/profile");
  return r;
}

export async function retireFieldAction(fd: FormData) {
  const r = retireCustomField(await requireManager(), Number(fd.get("fieldId")));
  if (r?.done) revalidatePath("/admin/profile");
}

export async function applyTemplateAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const scope = fd.get("scope"), refId = Number(fd.get("refId"));
  if ((scope !== "company" && scope !== "brand") || !Number.isInteger(refId)) return { error: "Pick a company or brand." };
  const r = applyTemplate(await requireManager(), scope, refId, String(fd.get("template") ?? ""));
  if (r?.done) revalidatePath("/admin/profile");
  return r;
}

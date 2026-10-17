"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { addBrand, addCompany, addTrack, saveBranding, type SetupState } from "@/lib/setup";

export type { SetupState };

function refreshed(r: SetupState): SetupState {
  if (r?.done) for (const p of ["/admin/setup", "/admin/people", "/admin/paths", "/admin/compliance"]) revalidatePath(p);
  return r;
}

export async function createCompany(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(addCompany(await requireManager(), fd)); }
export async function createBrand(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(addBrand(await requireManager(), fd)); }
export async function createTrack(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(addTrack(await requireManager(), fd)); }
export async function saveCompanyBranding(_: SetupState, fd: FormData): Promise<SetupState> {
  const r = await saveBranding(await requireManager(), fd);
  if (r?.done) revalidatePath("/", "layout");
  return r;
}

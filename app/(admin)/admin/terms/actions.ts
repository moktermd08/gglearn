"use server";
import { revalidatePath } from "next/cache";
import { realUser, viewAsState } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import { promoteTerm, removeTerm, saveBank, saveTerm } from "@/lib/termsAdmin";
import type { SetupState } from "@/lib/setup";

/** Only the platform owner keeps the shared terms: a super admin, signed in as themselves (not while viewing as someone else). Checked again on every action. */
async function superOnly(): Promise<string | null> {
  const real = await realUser();
  if (!real || !isSuperAdmin(real)) return "Only a super admin can change the term bank.";
  if (await viewAsState()) return "Exit the view first.";
  return null;
}

const refreshed = (r: SetupState): SetupState => {
  if (r?.done) { revalidatePath("/admin/terms"); revalidatePath("/terms"); }
  return r;
};

export async function saveBankAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const no = await superOnly();
  return no ? { error: no } : refreshed(saveBank(fd));
}
export async function saveTermAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const no = await superOnly();
  return no ? { error: no } : refreshed(saveTerm(fd));
}
export async function removeTermAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const no = await superOnly();
  return no ? { error: no } : refreshed(removeTerm(Number(fd.get("id"))));
}
export async function promoteTermAction(_: SetupState, fd: FormData): Promise<SetupState> {
  const no = await superOnly();
  return no ? { error: no } : refreshed(promoteTerm(Number(fd.get("id")), Number(fd.get("bankId")), String(fd.get("groupName") ?? "")));
}

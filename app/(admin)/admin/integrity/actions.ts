"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { decide, resetPolicy, savePolicy } from "@/lib/integrityAdmin";
import type { SetupState } from "@/lib/setup";

const refreshed = (r: SetupState): SetupState => { if (r?.done) { revalidatePath("/admin/integrity"); revalidatePath("/admin"); } return r; };

export async function savePolicyAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(savePolicy(await requireManager(), fd)); }
export async function resetPolicyAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(resetPolicy(await requireManager(), fd)); }
export async function decideAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(decide(await requireManager(), fd)); }

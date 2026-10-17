"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { removeRule, saveRule, settleAward } from "@/lib/rewardsAdmin";
import type { SetupState } from "@/lib/setup";

const refreshed = (r: SetupState): SetupState => { if (r?.done) { revalidatePath("/admin/rewards"); revalidatePath("/rewards"); } return r; };

export async function saveRewardRule(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(saveRule(await requireManager(), fd)); }
export async function deleteRewardRule(fd: FormData) { refreshed(removeRule(await requireManager(), Number(fd.get("id")))); }
export async function settleReward(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(settleAward(await requireManager(), fd)); }

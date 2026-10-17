"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { reinstateCertificate, revokeCertificate } from "@/lib/certsAdmin";
import type { SetupState } from "@/lib/setup";

const refreshed = (r: SetupState): SetupState => { if (r?.done) { revalidatePath("/admin/certificates"); revalidatePath("/profile"); revalidatePath("/cert/[code]", "page"); } return r; };

export async function revokeCert(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(revokeCertificate(await requireManager(), fd)); }
export async function reinstateCert(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(reinstateCertificate(await requireManager(), fd)); }

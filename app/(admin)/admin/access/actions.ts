"use server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { addTool, grantForm, removeRoleAccess, revokeForm, setRoleAccess, updateTool } from "@/lib/accessAdmin";
import type { SetupState } from "@/lib/setup";

const refreshed = (r: SetupState): SetupState => { if (r?.done) revalidatePath("/admin/access"); return r; };

export async function addToolAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(addTool(await requireManager(), fd)); }
export async function updateToolAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(updateTool(await requireManager(), fd)); }
export async function setRoleAccessAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(setRoleAccess(await requireManager(), fd)); }
export async function removeRoleAccessAction(fd: FormData) { refreshed(removeRoleAccess(await requireManager(), Number(fd.get("id")))); }
export async function grantAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(grantForm(await requireManager(), fd)); }
export async function revokeAction(_: SetupState, fd: FormData): Promise<SetupState> { return refreshed(revokeForm(await requireManager(), fd)); }

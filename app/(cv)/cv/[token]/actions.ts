"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAgainstDummy, verifyPassword } from "@/lib/password";
import { GATE_SECONDS, gateName, gateValue, openLink } from "@/lib/cv/links";
import { allowed, clear, clientIp, hit, MINUTE } from "@/lib/rate-limit";

export type Unlock = { error?: string } | null;

/** The reader types the passcode the owner gave them. Wrong tries are limited per address and link; the right code opens that one link for twelve hours. */
export async function unlockCv(token: string, _: Unlock, fd: FormData): Promise<Unlock> {
  const link = openLink(token);
  const code = typeof fd.get("code") === "string" ? (fd.get("code") as string).trim().slice(0, 100) : "";
  const key = `cvpass:${await clientIp()}:${link?.id ?? 0}`;
  if (!allowed(key, 8)) return { error: "Too many tries. Please wait a few minutes." };
  const ok = link && link.kind === "passcode" && link.passHash ? await verifyPassword(code, link.passHash) : (await verifyAgainstDummy(code), false);
  if (!ok || !link) { hit(key, 15 * MINUTE); return { error: "That passcode is not right." }; }
  clear(key);
  (await cookies()).set(gateName(link.id), gateValue(link.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/cv", maxAge: GATE_SECONDS });
  redirect(`/cv/${token}`);
}

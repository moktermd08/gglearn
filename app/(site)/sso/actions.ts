"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { allowed, clientIp, hit, MINUTE } from "@/lib/rate-limit";
import { safeNext } from "@/lib/nextPath";
import { companyForEmail } from "@/lib/sso";

/** "Sign in with your company": finds the company's single sign-on from the work email's domain and sends the person to it. */
export async function startCompanySso(_: string | null, fd: FormData): Promise<string | null> {
  const ipKey = `sso-find:${await clientIp()}`;
  if (!allowed(ipKey, 20)) return "Too many tries. Please wait a few minutes.";
  hit(ipKey, 10 * MINUTE);
  const email = z.string().email().max(120).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return "Enter your work email address.";
  const c = companyForEmail(email.data);
  if (!c) return "There is no company sign-in for that address. Use your password or ask your admin.";
  const next = safeNext(String(fd.get("next") ?? ""));
  redirect(`/sso/go/${c.slug}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

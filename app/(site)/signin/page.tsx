import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { safeNext } from "@/lib/nextPath";
import SignInLinkForm from "./form";

export const metadata: Metadata = { title: "Sign in with an email link — gglearn", robots: { index: false, follow: false } };

export default async function SignInByLink({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? "/dashboard");
  return <SignInLinkForm mailReady={mailConfigured()} next={next ?? ""} />;
}

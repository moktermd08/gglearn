import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import ForgotForm from "./form";

export const metadata: Metadata = { title: "Forgot your password? — gglearn", robots: { index: false, follow: false } };

export default async function Forgot() {
  if (await currentUser()) redirect("/profile"); // someone signed in changes their password there
  return <ForgotForm mailReady={mailConfigured()} />;
}

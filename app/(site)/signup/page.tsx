import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/nextPath";
import { SocialButtons } from "@/components/SocialButtons";
import SignUpForm from "./signup-form";

export const metadata = { title: "Create your account — gglearn" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string; try?: string }> }) {
  const q = await searchParams, back = safeNext(q.next);
  if (await currentUser()) redirect(back ?? "/dashboard");
  const refCode = q.ref?.slice(0, 30) ?? "", tried = q.try?.slice(0, 80) ?? "";
  return <SignUpForm next={back ?? ""} refCode={refCode} tried={tried} social={<SocialButtons next={back ?? ""} refCode={refCode} tried={tried} verb="Sign up" />} />;
}

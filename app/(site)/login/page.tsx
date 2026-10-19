import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/nextPath";
import { SocialButtons } from "@/components/SocialButtons";
import { REASONS } from "@/lib/social";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; social?: string }> }) {
  const q = await searchParams, back = safeNext(q.next);
  // someone who is already signed in has no use for the form: take them where they were going, or to their quest
  if (await currentUser()) redirect(back ?? "/dashboard");
  // only a fixed set of messages can be shown, never text from the address bar
  const problem = q.social ? (Object.hasOwn(REASONS, q.social) ? REASONS[q.social] : "That sign-in did not work. Please try again.") : "";
  return <LoginForm next={back ?? ""} problem={problem} social={<SocialButtons next={back ?? ""} />} />;
}

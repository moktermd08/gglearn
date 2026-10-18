import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/nextPath";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const back = safeNext((await searchParams).next);
  // someone who is already signed in has no use for the form: take them where they were going, or to their quest
  if (await currentUser()) redirect(back ?? "/dashboard");
  return <LoginForm next={back ?? ""} />;
}

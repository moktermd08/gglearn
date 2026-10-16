import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

/** Someone who is already signed in has no use for the sign-in form: send them to their quest instead of showing it again. */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/dashboard");
  return children;
}

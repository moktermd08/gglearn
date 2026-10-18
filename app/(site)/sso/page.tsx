import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { REASONS } from "@/lib/sso";
import { safeNext } from "@/lib/nextPath";
import { SsoForm } from "./form";

export const metadata: Metadata = { title: "Sign in with your company — gglearn", robots: { index: false, follow: false } };

export default async function Sso({ searchParams }: { searchParams: Promise<{ e?: string; next?: string }> }) {
  const q = await searchParams, next = safeNext(q.next ?? "") ?? "";
  // only a fixed set of messages can be shown, never text from the address bar
  const problem = q.e === "required" ? "Your company requires single sign-on." : q.e ? Object.hasOwn(REASONS, q.e) ? REASONS[q.e] : "That sign-in did not work. Please try again." : "";
  return (
    <AuthShell title="Sign in with your company." lead="Use the account your company already gave you. No new password to remember.">
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold">Company sign-in</h1>
        <SsoForm next={next} problem={problem} />
        <p className="text-center text-sm text-slate-400"><Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-indigo-300 underline">Use a password instead</Link></p>
      </div>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LinkIcon, LogIn } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { peekLoginLink } from "@/lib/loginLink";
import { safeNext } from "@/lib/nextPath";
import { signInWithLink } from "@/app/actions";

export const metadata: Metadata = { title: "Sign in — gglearn", robots: { index: false, follow: false } };

/** Opening the link only shows this page. Signing in needs the button, so a mail scanner that opens the link cannot use it up or sign in as anyone. */
export default async function SignInLink({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ next?: string }> }) {
  const token = (await params).token, next = safeNext((await searchParams).next) ?? "";
  const who = peekLoginLink(token);
  if (!who) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This link does not work">It has expired, was already used, or was replaced by a newer one. Sign-in links last 15 minutes and work once.</EmptyState>
        <div className="text-center"><Link href="/signin" className="btn">Get a new link<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md">
      <form action={signInWithLink.bind(null, token, next)} className="card space-y-4 p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-500"><LogIn size={26} /></span>
        <h1 className="text-2xl font-extrabold">Sign in as {who.firstName}?</h1>
        <p className="text-sm text-slate-400">Press the button to sign in on this device. If you did not ask for this link, close this page: nothing happens until you press it.</p>
        <button className="btn !px-8 !py-3 text-base"><LogIn size={18} />Sign in</button>
      </form>
    </div>
  );
}

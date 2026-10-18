import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { findOpenReset } from "@/lib/passwordReset";
import ResetForm from "./form";

export const metadata: Metadata = { title: "Choose a new password — gglearn", robots: { index: false, follow: false } };

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!findOpenReset(token)) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This link does not work">It has expired, was already used, or was replaced by a newer one. Links last an hour and work once.</EmptyState>
        <div className="text-center"><Link href="/forgot" className="btn">Get a new link<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  return <ResetForm token={token} />;
}

import Link from "next/link";
import { ArrowRight, LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { findOpenInvite } from "@/lib/invites";
import { currentUser } from "@/lib/auth";
import JoinForm from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = findOpenInvite(token);
  if (!inv) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This invite is not valid">This link has expired or was already used. Ask your manager for a new one.</EmptyState>
        <div className="text-center"><Link href="/login" className="btn btn-ghost">Go to sign in<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const me = await currentUser();
  return <JoinForm token={token} email={inv.email} signedInAs={me && me.email.toLowerCase() !== inv.email.toLowerCase() ? me.name : null} />;
}

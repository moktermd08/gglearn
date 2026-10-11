import Link from "next/link";
import { ArrowRight, LinkIcon } from "lucide-react";
import { findOpenInvite } from "@/lib/invites";
import JoinForm from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = findOpenInvite(token);
  if (!inv) {
    return (
      <div className="card pop mx-auto max-w-sm space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><LinkIcon className="text-rose-300" />Invite not valid</h2>
        <p className="text-sm text-slate-300">This link has expired or was already used. Ask your manager for a new one.</p>
        <Link href="/login" className="btn btn-ghost">Go to sign in<ArrowRight size={16} /></Link>
      </div>
    );
  }
  return <JoinForm token={token} email={inv.email} />;
}

import Link from "next/link";
import { findOpenInvite } from "@/lib/invites";
import JoinForm from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = findOpenInvite(token);
  if (!inv) {
    return (
      <div className="card mx-auto max-w-sm space-y-3 p-6">
        <h2 className="text-lg font-semibold">Invite not valid</h2>
        <p className="text-sm text-slate-300">This link has expired or was already used. Ask your manager for a new one.</p>
        <Link href="/login" className="underline">Go to sign in</Link>
      </div>
    );
  }
  return <JoinForm token={token} email={inv.email} />;
}

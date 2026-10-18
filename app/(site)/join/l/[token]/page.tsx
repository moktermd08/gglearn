import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { db, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { linkOf, stateOfLink } from "@/lib/joinLinks";
import { parseScopes, scopeLabels, scopeOptions } from "@/lib/paths";
import LinkJoinForm from "./form";

// a team's name is not put in a tab title or a link preview
export const metadata: Metadata = { title: "Join your team — gglearn", robots: { index: false, follow: false } };

const WHY = {
  revoked: "It was switched off. Ask whoever sent it for a new one.",
  expired: "It has expired. Ask whoever sent it for a new one.",
  full: "Every place has been taken. Ask whoever sent it to make a new one.",
} as const;

export default async function JoinLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const l = linkOf((await params).token);
  const state = l ? stateOfLink(l) : null;
  if (!l || state !== "open") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This link does not work">{state && state !== "open" ? WHY[state] : "It is not a valid team link. Check you copied all of it, or ask whoever sent it."}</EmptyState>
        <div className="text-center"><Link href="/login" className="btn btn-ghost">Go to sign in<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const me = await currentUser();
  const from = db.select({ n: users.name }).from(users).where(eq(users.id, l.createdBy)).get()?.n ?? null;
  const where = scopeLabels(parseScopes(l.scopes), scopeOptions()).join(", ");
  return <LinkJoinForm token={(await params).token} from={from} where={where} role={l.jobRole} signedInAs={me?.name ?? null} />;
}

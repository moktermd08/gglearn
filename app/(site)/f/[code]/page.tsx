import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, LinkIcon, Users } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { db, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { areFriends } from "@/lib/friends";
import { referrerOf } from "@/lib/referrals";
import { shortName } from "@/lib/seasons";
import { AcceptLink } from "../../friends/forms";

// nobody's name goes in a link preview
export const metadata: Metadata = { title: "Be friends on gglearn", robots: { index: false, follow: false } };

export default async function FriendLink({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code, owner = referrerOf(code);
  const row = owner ? db.select({ n: users.name, s: users.status }).from(users).where(eq(users.id, owner)).get() : undefined;
  if (!owner || !row || row.s !== "active") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This friend link does not work">Check you copied all of it, or ask your friend to send it again.</EmptyState>
        <div className="text-center"><Link href="/" className="btn btn-ghost">Go to gglearn<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const me = await currentUser(), name = shortName(row.n), here = `/f/${code}`;
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-pink-500/15 text-pink-500"><Users size={30} /></span>
        <h1 className="text-2xl font-extrabold">{name} wants to be your friend</h1>
        <p className="text-sm text-slate-300">Friends see each other&apos;s week and achievements on gglearn and can cheer them on. It is mutual, and either of you can stop any time.</p>
        {me?.id === owner ? <p className="text-sm text-slate-400">This is your own friend link. Send it to a friend.</p>
          : me && areFriends(me.id, owner) ? <Link href="/friends" className="btn">You are already friends<ArrowRight size={16} /></Link>
          : me ? <AcceptLink code={code} />
          : (<div className="flex flex-wrap justify-center gap-2">
              <Link href={`/signup?ref=${encodeURIComponent(code)}&next=${encodeURIComponent(here)}`} className="btn">Create a free account to be friends</Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-ghost">I have an account</Link>
            </div>)}
      </div>
    </div>
  );
}

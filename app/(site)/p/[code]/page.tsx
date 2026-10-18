import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, GraduationCap, LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { db, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { isMentor } from "@/lib/mentoring";
import { referrerOf } from "@/lib/referrals";
import { shortName } from "@/lib/seasons";
import { AcceptMentee } from "../../mentoring/forms";

// nobody's name goes in a link preview
export const metadata: Metadata = { title: "Follow a learner on gglearn", robots: { index: false, follow: false } };

export default async function ParentLink({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code, owner = referrerOf(code);
  const row = owner ? db.select({ n: users.name, s: users.status }).from(users).where(eq(users.id, owner)).get() : undefined;
  if (!owner || !row || row.s !== "active") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This parent link does not work">Check you copied all of it, or ask them to send it again.</EmptyState>
        <div className="text-center"><Link href="/" className="btn btn-ghost">Go to gglearn<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const me = await currentUser(), name = shortName(row.n), here = `/p/${code}`;
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/15 text-violet-500"><GraduationCap size={30} /></span>
        <h1 className="text-2xl font-extrabold">{name} asks you to follow their progress as a parent or guardian</h1>
        <p className="text-sm text-slate-300">As a parent or guardian you would see their week, streak, certificates, goal and the topics they work on, and you could send short kind words. Never their email. Either of you can stop any time.</p>
        {me?.id === owner ? <p className="text-sm text-slate-400">This is your own parent link. Send it to the parent or guardian who will follow you.</p>
          : me && isMentor(me.id, owner) ? <Link href="/mentoring" className="btn">You already follow them<ArrowRight size={16} /></Link>
          : me ? <AcceptMentee code={code} kind="parent" />
          : (<div className="flex flex-wrap justify-center gap-2">
              <Link href={`/signup?ref=${encodeURIComponent(code)}&next=${encodeURIComponent(here)}`} className="btn">Create a free account to follow</Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-ghost">I have an account</Link>
            </div>)}
      </div>
    </div>
  );
}

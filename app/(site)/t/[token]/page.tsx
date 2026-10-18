import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ArrowRight, LinkIcon, Users } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { db, teamMembers, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { referralCode } from "@/lib/referrals";
import { joinState, memberCount, teamByToken } from "@/lib/teams";
import { JoinTeamButton } from "../../teams/forms";

// a team's name is not put in a tab title or a link preview
export const metadata: Metadata = { title: "Join a team — gglearn", robots: { index: false, follow: false } };

export default async function JoinTeam({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const t = teamByToken(token);
  const n = t ? memberCount(t.id) : 0, state = t ? joinState(t, n) : null;
  if (!t || state === "archived") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This team link does not work">It is not valid or the team has closed. Check you copied all of it, or ask the person who sent it.</EmptyState>
        <div className="text-center"><Link href="/" className="btn btn-ghost">Go to gglearn<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const me = await currentUser();
  const owner = db.select({ n: users.name }).from(users).where(eq(users.id, t.ownerId)).get()?.n ?? "Someone";
  const already = !!me && !!db.select().from(teamMembers).where(and(eq(teamMembers.teamId, t.id), eq(teamMembers.userId, me.id))).get();
  const here = `/t/${token}`;
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="card space-y-4 p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-400"><Users size={26} /></span>
        <div><h1 className="text-2xl font-extrabold">{t.name}</h1><p className="text-sm text-slate-400">{t.kind === "class" ? "Class taught by" : ""} {owner} {t.kind === "class" ? "·" : "invited you ·"} {n} {n === 1 ? "member" : "members"}</p></div>
        {t.kind === "class"
          ? <div className="rounded-xl bg-amber-500/10 p-3 text-left text-sm text-slate-300"><b>What {owner} will see:</b> your name, how far you have got in the topics set for this class, whether each is done, late or open, and when you last practised on them. Not your other topics, XP, streak or email. You see only your own assignments, and you can leave any time.</div>
          : <p className="text-sm text-slate-300">Learn together, race each other and see who climbs fastest. Members see each other&apos;s names, levels and weekly XP.</p>}
        {already ? <Link href={`/teams/${t.id}`} className="btn">Open the team<ArrowRight size={16} /></Link>
          : state !== "open" ? <p className="text-sm text-amber-500">{state === "full" ? "This team is full." : "This team is not taking new members right now."}</p>
          : me ? <JoinTeamButton token={token} />
          : (<div className="flex flex-wrap justify-center gap-2">
              <Link href={`/signup?ref=${referralCode(t.ownerId)}&next=${encodeURIComponent(here)}`} className="btn">Create a free account to join</Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-ghost">I have an account</Link>
            </div>)}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, HeartHandshake, LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/charts";
import { db, tracks, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { parseSponsorCode, passedIn } from "@/lib/sponsors";
import { shortName } from "@/lib/seasons";
import { topicLabel } from "@/lib/topicName";
import { BackButton } from "../../sponsoring/forms";

// nobody's name or goal goes in a link preview
export const metadata: Metadata = { title: "Back a goal on gglearn", robots: { index: false, follow: false } };

export default async function SponsorLink({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code, g = parseSponsorCode(code);
  const who = g ? db.select({ n: users.name, s: users.status }).from(users).where(eq(users.id, g.learner)).get() : undefined;
  const topic = g ? db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, g.track)).get() : undefined;
  if (!g || !who || who.s !== "active" || !topic) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title="This sponsor link does not work">Check you copied all of it, or ask them to send it again.</EmptyState>
        <div className="text-center"><Link href="/" className="btn btn-ghost">Go to gglearn<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const me = await currentUser(), reached = passedIn(g.learner, g.track) >= g.level, here = `/sp/${code}`;
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-pink-500/15 text-pink-500"><HeartHandshake size={30} /></span>
        <h1 className="text-2xl font-extrabold">{shortName(who.n)} wants you to back a goal</h1>
        <p className="text-lg font-semibold">{topicLabel(topic.n)}: reach level {g.level}</p>
        <p className="text-sm text-slate-300">If you say yes you will see their progress on this goal only, and you are told when they reach it. You do not pay or promise anything. Either of you can stop any time.</p>
        {reached ? <p className="text-sm text-slate-400">They have already reached this goal.</p>
          : me?.id === g.learner ? <p className="text-sm text-slate-400">This is your own goal. Send the link to someone who would back you.</p>
          : me ? <BackButton code={code} />
          : (<div className="flex flex-wrap justify-center gap-2">
              <Link href={`/signup?next=${encodeURIComponent(here)}`} className="btn">Create a free account to back this</Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-ghost">I have an account</Link>
            </div>)}
      </div>
    </div>
  );
}

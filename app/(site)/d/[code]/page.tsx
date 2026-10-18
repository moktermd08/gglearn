import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Swords } from "lucide-react";
import { db, tracks, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { duelOf, isOpenToJoin } from "@/lib/duel";
import { referralCode } from "@/lib/referrals";
import { shortName } from "@/lib/seasons";
import { siteUrl } from "@/lib/share";
import { topicLabel } from "@/lib/topicName";
import { DUEL_SIZE } from "@/lib/duelRules";
import DuelRoom from "./room";
import JoinButton from "./join-button";

// a duel's topic and players are not put in a link preview
export const metadata: Metadata = { title: "Live duel — gglearn", robots: { index: false, follow: false } };

export default async function DuelPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code, d = duelOf(code);
  if (!d) notFound();
  const me = await currentUser();
  const host = db.select({ n: users.name }).from(users).where(eq(users.id, d.hostId)).get()?.n ?? "Someone";
  const topic = topicLabel(db.select({ n: tracks.name }).from(tracks).where(eq(tracks.id, d.trackId)).get()?.n ?? "a topic");
  const here = `/d/${code}`;
  if (me && (me.id === d.hostId || me.id === d.guestId)) return <div className="mx-auto max-w-2xl"><DuelRoom code={code} shareUrl={`${await siteUrl()}${here}`} /></div>;

  const open = isOpenToJoin(d);
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-pink-500/15 text-pink-500"><Swords size={30} /></span>
        <h1 className="text-2xl font-extrabold">{shortName(host)} challenges you to a live duel</h1>
        <p className="text-slate-300">{topic}. {DUEL_SIZE} questions, 15 seconds each, the same for both of you at the same moment. A quick one.</p>
        {!open ? <p className="text-sm text-amber-500">This duel has already started or is no longer open.</p>
          : me ? <JoinButton code={code} />
          : (<div className="flex flex-wrap justify-center gap-2">
              <Link href={`/signup?ref=${referralCode(d.hostId)}&next=${encodeURIComponent(here)}`} className="btn">Create a free account to play</Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-ghost">I have an account</Link>
            </div>)}
      </div>
    </div>
  );
}

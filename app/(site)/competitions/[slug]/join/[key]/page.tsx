import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowRight, CalendarClock, LinkIcon, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { EmptyState } from "@/components/charts";
import { competitionMembers, competitions, db, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { entryFor, guestPath } from "@/lib/guestLink";
import { GuestJoinForm, MemberJoinButton } from "./guest-form";

// never put a private contest's name in the tab or in a link preview
export const metadata: Metadata = { title: "Join a race — gglearn", robots: { index: false, follow: false } };

const utc = (s: number) => `${new Date(s * 1000).toISOString().slice(0, 10)}`;

const NOT_VALID = {
  invalid: ["This invite link is not valid", "It may have been replaced or switched off. Ask the person who sent it for a new one."],
  over: ["This race is over", "You can still see how it ended, if you were part of it. Ask for a link to the next one."],
  full: ["This race is full", "Every place is taken. Ask the organiser to make room or start another race."],
} as const;

export default async function GuestJoinPage({ params }: { params: Promise<{ slug: string; key: string }> }) {
  const { slug, key } = await params;
  const me = await currentUser();
  // someone already in the race has no use for the invitation: take them to it
  if (me) {
    const c0 = db.select({ id: competitions.id }).from(competitions).where(eq(competitions.slug, slug)).get();
    if (c0 && db.select({ id: competitionMembers.id }).from(competitionMembers).where(and(eq(competitionMembers.competitionId, c0.id), eq(competitionMembers.userId, me.id), eq(competitionMembers.status, "joined"))).get()) redirect(`/competitions/${slug}`);
  }
  const e = entryFor(slug, key);
  if ("error" in e) {
    const [title, body] = NOT_VALID[e.error];
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState Icon={LinkIcon} tone="rose" title={title}>{body}</EmptyState>
        <div className="text-center"><Link href="/competitions" className="btn btn-ghost">See open races<ArrowRight size={16} /></Link></div>
      </div>
    );
  }
  const { c, track, left } = e;
  const host = db.select({ n: users.name }).from(users).where(eq(users.id, c.createdBy)).get()?.n.split(" ")[0] ?? "Someone";
  const path = guestPath(c)!;
  return (
    <AuthShell title="You are invited to race." lead={`${host} wants you in. Pick a place on the leaderboard and climb.`}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold">{c.title}</h1>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li className="flex items-center gap-1.5"><Target size={14} className="shrink-0 text-pink-300" />{track.name}: gain {c.goalLevels} level{c.goalLevels === 1 ? "" : "s"}</li>
            <li className="flex items-center gap-1.5"><CalendarClock size={14} className="shrink-0 text-amber-300" />Ends {utc(c.endsAt)}</li>
            <li className="flex items-center gap-1.5"><Users size={14} className="shrink-0 text-sky-300" />Organised by {host} · {left} place{left === 1 ? "" : "s"} left</li>
          </ul>
        </div>
        {me ? <MemberJoinButton slug={slug} k={key} name={me.name} /> : <GuestJoinForm slug={slug} k={key} path={path} />}
      </div>
    </AuthShell>
  );
}

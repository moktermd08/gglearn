import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ArrowRight, Users } from "lucide-react";
import { PageHero } from "@/components/charts";
import { db, teamMembers, teams } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { memberCount } from "@/lib/teams";
import { NewTeamForm } from "./forms";

export const metadata = { title: "Your teams — gglearn" };

export default async function Teams() {
  const me = await requireUser();
  const mine = db.select({ t: teams }).from(teamMembers).innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, me.id), isNull(teams.archivedAt))).orderBy(sql`${teams.createdAt} desc`).all().map((r) => ({ t: r.t, n: memberCount(r.t.id) }));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Users} tone="violet" title="Your teams" sub="Learn with friends, a class or a study group. Everyone sees each other's weekly progress, and the owner can start a race for the whole team." />
      <NewTeamForm />
      <details className="card p-5"><summary className="cursor-pointer font-bold">Teaching? Start a class instead</summary>
        <p className="my-3 text-sm text-slate-300">A class lets you set assignments (reach level N in a topic by a date) and see who is done, who is late and who has not started. Students see only their own assignments, and are told what you can see before they join.</p>
        <NewTeamForm kind="class" /></details>
      {mine.length > 0 ? (
        <ul className="space-y-2">
          {mine.map(({ t, n }) => (
            <li key={t.id}><Link href={`/teams/${t.id}`} className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-400"><Users size={18} /></span>
              <span className="min-w-0 flex-1"><b className="block truncate">{t.name}</b><span className="text-xs text-slate-400">{t.kind === "class" ? "Class · " : ""}{n} {n === 1 ? "member" : "members"}{t.ownerId === me.id ? (t.kind === "class" ? " · you teach it" : " · you run it") : ""}</span></span>
              <ArrowRight size={16} className="text-slate-400" />
            </Link></li>
          ))}
        </ul>
      ) : <p className="text-center text-sm text-slate-400">You are not in a team yet. Start one above, or open a team link a friend sent you.</p>}
    </div>
  );
}

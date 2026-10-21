import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Flame, Lock, LogOut, Sparkles, Swords, Trophy, Unlock, UserMinus, Users } from "lucide-react";
import { PageHero } from "@/components/charts";
import { ShareBar } from "@/components/ShareBar";
import { db, teamMembers, teams } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/share";
import { MAX_TEAM_SIZE, joinState, membersOf, teamPath } from "@/lib/teams";
import { pickableTopics } from "@/lib/pickTopics";
import { byTopicName, topicLabel } from "@/lib/topicName";
import { closeTeam, dropAssignment, leaveTeam, removeFromTeam, setTeamOpen } from "../actions";
import { AssignmentForm, TeamRaceForm } from "../forms";
import { assignableTopics, myAssignments, rosterFor, type Status } from "@/lib/classes";

export const metadata = { title: "Team — gglearn" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  const t = Number.isInteger(id) ? db.select().from(teams).where(eq(teams.id, id)).get() : undefined;
  if (!t || t.archivedAt) notFound();
  if (!db.select().from(teamMembers).where(and(eq(teamMembers.teamId, t.id), eq(teamMembers.userId, me.id))).get()) redirect("/teams"); // a team is for its members
  const owner = t.ownerId === me.id, members = membersOf(t), url = `${await siteUrl()}${teamPath(t.id)}`, state = joinState(t, members.length);
  const topics = owner ? pickableTopics(me).sort((a, b) => byTopicName(a.name, b.name)).map((x) => ({ id: x.id, name: topicLabel(x.name) })) : [];
  const best = Math.max(1, ...members.map((m) => m.weekXp));
  const cls = t.kind === "class", roster = cls && owner ? rosterFor(me.id, t.id) : null, mine = cls && !owner ? myAssignments(me.id, t.id) : [];
  const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const pill: Record<Status, string> = { done: "bg-emerald-500/15 text-emerald-300", open: "bg-sky-500/15 text-sky-300", late: "bg-rose-500/15 text-rose-300" };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Users} tone="violet" title={t.name} sub={cls ? `${members.length} of ${MAX_TEAM_SIZE} places taken. ${owner ? "You see progress on the assigned topics only." : "Only your teacher sees your progress here."}` : `${members.length} of ${MAX_TEAM_SIZE} places taken. Members see each other's names, levels and XP this week.`}>
        <Link href="/teams" className="btn btn-ghost !py-1 text-sm">All teams</Link>
      </PageHero>

      <section className="card space-y-3 p-5" aria-label="Invite people">
        <h2 className="font-bold">Bring people in</h2>
        {state === "open" ? (<>
          <p className="text-sm text-slate-300">{cls ? "Anyone with this link can join. They are told what the teacher sees before they do." : "Anyone with this link can join, create an account if they need one, and see the team\u2019s weekly board."}</p>
          <label className="block text-sm text-slate-400">Team link<input readOnly value={url} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
          <ShareBar url={url} text={`Join my team "${t.name}" on gglearn: we learn, race and climb together.`} />
        </>) : <p className="text-sm text-amber-500">{state === "full" ? "The team is full." : "Joining is switched off, so the link does not let anyone in."}</p>}
        {owner && <form action={setTeamOpen.bind(null, t.id, !t.joinOpen)}><button className="inline-flex items-center gap-1 text-sm text-slate-400 underline">{t.joinOpen ? <><Lock size={13} />Stop letting people in</> : <><Unlock size={13} />Let people in again</>}</button></form>}
      </section>

      {cls && roster && (
        <section className="card space-y-4 p-5" aria-label="Assignments">
          <h2 className="font-bold">Assignments</h2>
          <AssignmentForm teamId={t.id} topics={assignableTopics()} />
          {roster.assignments.length > 0 && <ul className="space-y-1 text-sm">{roster.assignments.map((a) => <li key={a.id} className="flex items-center gap-2"><span className="flex-1">{a.topic}: reach level {a.level} by {day(a.dueAt)}</span><form action={dropAssignment.bind(null, t.id, a.id)}><button className="text-xs text-slate-400 underline">Remove</button></form></li>)}</ul>}
          {roster.students.length > 0 ? (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-slate-400"><th className="py-1 pr-3">Student</th>{roster.assignments.map((a) => <th key={a.id} className="px-2">{a.topic} L{a.level}</th>)}<th className="px-2">Last practised</th></tr></thead>
              <tbody>{roster.students.map((s) => <tr key={s.userId} className="border-t border-black/5"><td className="py-1.5 pr-3 font-semibold">{s.name}</td>{s.each.map((e) => <td key={e.assignmentId} className="px-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pill[e.status]}`}>{e.status === "done" ? "done" : `${e.status} · L${e.passed}`}</span></td>)}<td className="px-2 text-slate-400">{s.lastPracticed ? day(s.lastPracticed) : "not yet"}</td></tr>)}</tbody></table></div>
          ) : <p className="text-sm text-slate-400">No students yet. Send the class link above.</p>}
        </section>
      )}

      {cls && !owner && (
        <section className="card space-y-3 p-5" aria-label="My assignments">
          <h2 className="font-bold">Your assignments</h2>
          {mine.length ? <ul className="space-y-2 text-sm">{mine.map((a) => <li key={a.id} className="flex items-center gap-2"><span className="flex-1">{a.topic}: reach level {a.level} by {day(a.dueAt)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pill[a.status]}`}>{a.status === "done" ? "done" : `${a.status} · level ${a.passed}`}</span></li>)}</ul> : <p className="text-sm text-slate-400">Nothing set yet.</p>}
          <p className="text-xs text-slate-400">Your teacher sees your progress on these topics only. Your quests are on <Link href="/dashboard" className="underline">your dashboard</Link>.</p>
        </section>
      )}

      {!cls && <section className="card p-5" aria-label="This week">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><Trophy size={18} className="text-amber-400" />This week</h2>
        <ol className="space-y-2">
          {members.map((m, i) => (
            <li key={m.userId} className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><b className="truncate">{m.name}</b>{m.owner && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-400">owner</span>}{m.userId === me.id && <span className="text-xs text-slate-400">you</span>}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full bg-indigo-400" style={{ width: `${(m.weekXp / best) * 100}%` }} /></span>
              </span>
              <span className="flex w-24 shrink-0 items-center justify-end gap-1 text-sm font-semibold"><Sparkles size={13} className="text-sky-400" />{m.weekXp}</span>
              <span className="hidden w-20 shrink-0 text-right text-xs text-slate-400 sm:block">{m.levels} {m.levels === 1 ? "level" : "levels"}</span>
              {owner && m.userId !== me.id && <form action={removeFromTeam.bind(null, t.id, m.userId)}><button aria-label={`Remove ${m.name}`} className="text-slate-400 hover:text-rose-400"><UserMinus size={15} /></button></form>}
            </li>
          ))}
        </ol>
        {members.every((m) => m.weekXp === 0) && <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-400"><Flame size={14} className="text-orange-400" />Nobody has scored this week yet. The first quest puts you on the board.</p>}
      </section>}

      {owner && !cls && (
        <section className="card space-y-3 p-5" aria-label="Race the team">
          <h2 className="flex items-center gap-2 font-bold"><Swords size={18} className="text-pink-400" />Race the team</h2>
          <p className="text-sm text-slate-300">Everyone in the team is invited at once. Whoever gains the most levels on the topic wins.</p>
          <TeamRaceForm teamId={t.id} topics={topics} />
        </section>
      )}

      <section className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
        <form action={leaveTeam.bind(null, t.id)}><button className="inline-flex items-center gap-1 underline"><LogOut size={13} />Leave this team</button></form>
        {owner && <form action={closeTeam.bind(null, t.id)}><button className="underline">Close the team for everyone</button></form>}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { Award, CalendarDays, CheckCircle2, ClipboardList, Eye, Flame, GraduationCap, Mail, NotebookPen, ShieldCheck, Target, TriangleAlert, UserCog, Users } from "lucide-react";
import { certificates, checklistItems, db, enrollments, handovers, runs, tracks, users } from "@/lib/db";
import { realUser, requireManager } from "@/lib/auth";
import { Initials, PageHero, PALETTE, StatTile } from "@/components/charts";
import { OnboardingPhases } from "@/components/OnboardingPhases";
import { certState } from "@/lib/certs";
import { weekStats } from "@/lib/friends";
import { roleLabel } from "@/lib/journey";
import { menteesOf, mentorsOf } from "@/lib/mentoring";
import { onboardingFor } from "@/lib/onboarding";
import { catalog, requirementsFor, scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";
import { recordProfileView } from "@/lib/securityLog";
import { activityFor, trackStats } from "@/lib/stats";
import { isSuperAdmin } from "@/lib/superAdmin";
import { clientIp } from "@/lib/rate-limit";
import { isGlobal, reachOf, userInReach } from "@/lib/tenancy";

export const metadata = { title: "Person — gglearn admin" };

const day = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const sect = "card space-y-3 p-4", h = "flex items-center gap-2 text-base font-bold";

/**
 * A person as their manager sees them: who they are, where they belong, what they must learn and how far they are, onboarding, certificates,
 * mentoring, who runs them, and the notes kept about them. Read only: nothing on this page changes the person (it deliberately avoids the
 * helpers that settle leagues or streak freezes as a side effect). Only for people this viewer runs; a super admin's visit is logged.
 */
export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireManager();
  const id = Number((await params).id);
  const u = Number.isInteger(id) ? db.select().from(users).where(eq(users.id, id)).get() : undefined;
  if (!u || !userInReach(reachOf(me.id), u.id)) notFound(); // the same answer for "no such person" and "not yours", so ids cannot be probed
  const real = await realUser();
  if (real && isSuperAdmin(real)) recordProfileView(real.id, u.id, await clientIp());

  const off = u.status === "offboarded", first = u.name.split(" ")[0];
  const scopes = scopesOf(u.id), opts = scopeOptions(), places = scopeLabels(scopes, opts);
  const cat = catalog();
  const reqs = off ? [] : requirementsFor(u, scopes, cat).sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt - b.dueAt);
  const done = reqs.filter((r) => r.done).length, overdue = reqs.filter((r) => !r.done && r.overdue).length;
  const onboarding = off ? null : onboardingFor(u, scopes, { cat });
  const enrolled = db.select({ e: enrollments, t: tracks }).from(enrollments).innerJoin(tracks, eq(tracks.id, enrollments.trackId)).where(eq(enrollments.userId, u.id)).all()
    .map(({ e, t }) => ({ t, s: trackStats(u.id, t, e.startedAt) })).sort((a, b) => b.s.passed - a.s.passed || b.s.xp - a.s.xp);
  const certs = db.select({ c: certificates, t: tracks }).from(certificates).innerJoin(tracks, eq(tracks.id, certificates.trackId)).where(eq(certificates.userId, u.id)).orderBy(desc(certificates.issuedAt)).all();
  const validCerts = certs.filter((x) => x.c.revokedAt == null && certState(x.c).state !== "expired").length;
  const week = weekStats([u.id]).get(u.id) ?? { weekXp: 0, streak: 0 };
  const activity = activityFor(u.id, 12), activeDays = activity.filter((d) => d.value > 0).length;
  const last = db.select({ at: sql<number | null>`max(${runs.finishedAt})` }).from(runs).where(and(eq(runs.userId, u.id), sql`${runs.finishedAt} is not null`)).get()?.at ?? null;
  const mentors = mentorsOf(u.id), mentees = menteesOf(u.id);
  const items = db.select().from(checklistItems).where(eq(checklistItems.userId, u.id)).all();
  const notes = db.select().from(handovers).where(eq(handovers.userId, u.id)).orderBy(desc(handovers.createdAt)).all();
  const trackName = new Map(cat.map((t) => [t.id, t.name]));

  // who runs them: managers and admins whose places cover this person (a super admin or platform owner runs everyone, so is named once, not listed)
  const runners = db.select().from(users).where(eq(users.status, "active")).all()
    .filter((m) => m.id !== u.id && m.role !== "learner" && userInReach(reachOf(m.id), u.id));
  const scopedRunners = runners.filter((m) => !isGlobal(reachOf(m.id)));
  const everyoneRunner = runners.length - scopedRunners.length;

  const tiles = [
    { Icon: Target, label: "Required done", value: reqs.length ? `${done}/${reqs.length}` : "None" },
    { Icon: TriangleAlert, label: "Overdue", value: overdue },
    { Icon: Flame, label: "Day streak", value: week.streak },
    { Icon: Award, label: "Certificates", value: validCerts },
  ];

  return (
    <div className="space-y-6">
      <PageHero Icon={Users} title={u.name} sub={<>{u.email} · {u.audience === "customer" ? "customer" : roleLabel(u.jobRole)}</>}>
        <Link href={`/admin/people?edit=${u.id}`} className="btn btn-ghost !py-1 text-sm"><UserCog size={15} />Edit or place</Link>
        <Link href="/admin/people" className="btn btn-ghost !py-1 text-sm">All people</Link>
      </PageHero>

      <section className={sect} aria-label="Who">
        <div className="flex flex-wrap items-center gap-3">
          <Initials name={u.name} size={56} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-800"><ShieldCheck size={10} aria-hidden />{u.role}</span>
              {u.guest === "yes" && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-sky-800">guest</span>}
              {u.audience === "customer" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-800">customer</span>}
              {off ? <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-800">offboarded</span> : <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-800">active</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><Mail size={13} aria-hidden />{u.email}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden />Joined {day(u.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><GraduationCap size={13} aria-hidden />{last ? `Last finished a level ${day(last)}` : "Has not finished a level yet"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {places.length ? places.map((p) => <span key={p} className="rounded-full bg-black/5 px-2 py-0.5 text-slate-600">{p}</span>) : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-800">Not placed in any company, brand or project</span>}
            </div>
          </div>
          {real && isSuperAdmin(real) && !off && u.id !== real.id && !isSuperAdmin(u) && <Link href={`/admin/people?edit=${u.id}`} className="btn btn-ghost !py-1 text-sm"><Eye size={15} />View as {first}</Link>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, value }, i) => <StatTile key={label} i={i} Icon={Icon} label={label} value={value} color={[PALETTE.emerald, PALETTE.rose, PALETTE.amber, PALETTE.sky][i]} />)}
      </div>

      <section className={sect} aria-labelledby="p-required">
        <h2 id="p-required" className={h}><Target size={16} aria-hidden />Required learning</h2>
        {off ? <p className="text-sm text-slate-400">{first} has been offboarded.</p> : reqs.length === 0 ? <p className="text-sm text-slate-400">{u.guest === "yes" ? "Guests are not put through required courses." : scopes.length === 0 ? "Nothing is required until they are placed in a company, brand or project." : "Nothing is required of them right now."}</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {reqs.map((r) => (
              <li key={r.track.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 font-medium">{r.track.name.replace(/^\d+\.\s*/, "")}</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{r.why === "mandatory" ? "mandatory" : "role"}</span>
                <span className="text-slate-500">level {r.passed}/{r.track.requiredLevel}</span>
                {r.done ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} aria-hidden />Done</span>
                  : r.overdue ? <span className="font-semibold text-rose-600">Overdue, was due {day(r.dueAt)}</span>
                  : <span className="text-slate-500">Due {day(r.dueAt)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {onboarding && onboarding.gated && onboarding.phases.length > 0 && (
        <section className={sect} aria-labelledby="p-onboarding">
          <h2 id="p-onboarding" className={h}><ClipboardList size={16} aria-hidden />Onboarding phases</h2>
          <OnboardingPhases o={onboarding} />
          <p className="text-xs text-slate-400">Signing a phase off is done from their panel in People.</p>
        </section>
      )}

      <section className={sect} aria-labelledby="p-learning">
        <h2 id="p-learning" className={h}><GraduationCap size={16} aria-hidden />What they are learning</h2>
        <p className="text-sm text-slate-500">{week.weekXp.toLocaleString("en-GB")} XP this week · active on {activeDays} of the last 84 days</p>
        {enrolled.length === 0 ? <p className="text-sm text-slate-400">Not enrolled in anything yet.</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {enrolled.slice(0, 15).map(({ t, s }) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5"><span className="min-w-0 flex-1 truncate">{t.name.replace(/^\d+\.\s*/, "")}</span><span className="text-slate-500">{s.passed} levels passed · {s.xp.toLocaleString("en-GB")} XP</span></li>
            ))}
            {enrolled.length > 15 && <li className="py-1.5 text-xs text-slate-400">and {enrolled.length - 15} more</li>}
          </ul>
        )}
      </section>

      <section className={sect} aria-labelledby="p-certs">
        <h2 id="p-certs" className={h}><Award size={16} aria-hidden />Certificates</h2>
        {certs.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {certs.map(({ c, t }) => {
              const st = c.revokedAt != null ? "revoked" : certState(c).state;
              return <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5"><span className="min-w-0 flex-1">{t.name.replace(/^\d+\.\s*/, "")} · level {c.level}</span><span className="text-slate-500">issued {day(c.issuedAt)}{c.expiresAt ? ` · expires ${day(c.expiresAt)}` : ""}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st === "valid" || st === "permanent" ? "bg-emerald-500/15 text-emerald-700" : st === "expiring" ? "bg-amber-500/20 text-amber-800" : "bg-rose-500/15 text-rose-700"}`}>{st}</span></li>;
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={sect} aria-labelledby="p-runs">
          <h2 id="p-runs" className={h}><UserCog size={16} aria-hidden />Who runs {first}</h2>
          {scopedRunners.length === 0 && everyoneRunner === 0 ? <p className="text-sm text-slate-400">Nobody: they are not in a company yet.</p> : (
            <ul className="space-y-1 text-sm">
              {scopedRunners.map((m) => <li key={m.id}><Link href={`/admin/people/${m.id}`} className="text-sky-700 underline">{m.name}</Link> <span className="text-slate-400">· {m.role}</span></li>)}
              {everyoneRunner > 0 && <li className="text-slate-400">and {everyoneRunner} {everyoneRunner === 1 ? "person" : "people"} who run the whole academy</li>}
            </ul>
          )}
        </section>
        <section className={sect} aria-labelledby="p-mentor">
          <h2 id="p-mentor" className={h}><Users size={16} aria-hidden />Mentoring</h2>
          {mentors.length === 0 && mentees.length === 0 ? <p className="text-sm text-slate-400">No mentors or mentees.</p> : (
            <ul className="space-y-1 text-sm">
              {mentors.map((m) => <li key={`a${m.id}`}>{m.name} <span className="text-slate-400">· {m.kind === "parent" ? "follows" : "mentors"} {first}</span></li>)}
              {mentees.map((m) => <li key={`b${m.id}`}>{m.name} <span className="text-slate-400">· {m.kind === "parent" ? "followed by" : "mentored by"} {first}</span></li>)}
            </ul>
          )}
        </section>
      </div>

      <section className={sect} aria-labelledby="p-notes">
        <h2 id="p-notes" className={h}><NotebookPen size={16} aria-hidden />Checklist and handover notes</h2>
        {items.length === 0 && notes.length === 0 && <p className="text-sm text-slate-400">Nothing recorded.</p>}
        {items.length > 0 && <ul className="space-y-1 text-sm">{items.map((c) => <li key={c.id} className={c.done ? "text-slate-400 line-through" : ""}>{c.done ? "✓" : "○"} <span className="text-[10px] uppercase text-slate-400">{c.kind}</span> {c.label}</li>)}</ul>}
        {notes.map((n) => <p key={n.id} className="whitespace-pre-wrap rounded-lg bg-sky-500/10 p-2.5 text-sm">{n.trackId != null && <b>{trackName.get(n.trackId) ?? "A track"}: </b>}{n.notes} <span className="text-xs text-slate-400">· {day(n.createdAt)}</span></p>)}
        <p className="text-xs text-slate-400">Add or tick things from their panel in People.</p>
      </section>
    </div>
  );
}

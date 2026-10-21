import { Initials, PageHero, PALETTE, StatTile } from "@/components/charts";
import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import { checklistItems, db, enrollments, handovers, joinLinks, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addHandover, offboard, setAccess, toggleChecklistItem, updateScopes } from "@/app/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { LEVELS, grantableLevels } from "@/lib/accessLevel";
import { mailConfigured } from "@/lib/mail";
import { catalog, loadProgress, scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";
import { coverageFor, hasNoRolePath, knownRoles } from "@/lib/roles";
import { ScopePicker } from "@/components/ScopePicker";
import { Building2, CheckSquare, ClipboardList, NotebookPen, Plus, Save, Shield, ShieldCheck, Square, UserCheck, UserMinus, UserPlus, Users, UserCog, Mail } from "lucide-react";
import NewPerson from "./new-person";
import InvitePerson from "./invite-person";
import TeamLinks, { type LinkRow } from "./team-links";
import { linkPath, stateOfLink } from "@/lib/joinLinks";
import { siteUrl } from "@/lib/share";
import { parseScopes } from "@/lib/paths";
import ResetPassword from "./reset-password";
import { OnboardingPhases } from "@/components/OnboardingPhases";
import { canSignOff, onboardingFor } from "@/lib/onboarding";
import { isGlobal, limitOptions, reachOf, usersInReach } from "@/lib/tenancy";
import { adminScopeOf } from "@/lib/adminScope";

const PAGE = 50;

export default async function People({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireManager();
  const { q = "", page: pageParam = "1" } = await searchParams;
  const reach = (await adminScopeOf(me)).reach, mine = usersInReach(reach);
  const everyone = db.select().from(users).orderBy(users.name).all().filter((u) => !mine || mine.has(u.id));
  // only the people on this page get their checklist, notes, enrolments and onboarding worked out, so a company of thousands is read in pages
  const needle = q.trim().toLowerCase();
  const found = needle ? everyone.filter((u) => `${u.name} ${u.email} ${u.jobRole}`.toLowerCase().includes(needle)) : everyone;
  const pages = Math.max(1, Math.ceil(found.length / PAGE)), page = Math.min(pages, Math.max(1, Number.parseInt(pageParam, 10) || 1));
  const all = found.slice((page - 1) * PAGE, page * PAGE);
  const shown = new Set(all.map((u) => u.id)), shownIds = [...shown];
  const items = shownIds.length ? db.select().from(checklistItems).where(inArray(checklistItems.userId, shownIds)).all() : [];
  const notes = shownIds.length ? db.select().from(handovers).where(inArray(handovers.userId, shownIds)).all() : [];
  const trackName = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).all().map((t) => [t.id, t.name]));
  const enrolledIn = new Map<number, number[]>();
  if (shownIds.length) for (const e of db.select({ u: enrollments.userId, t: enrollments.trackId }).from(enrollments).where(inArray(enrollments.userId, shownIds)).all()) enrolledIn.set(e.u, [...(enrolledIn.get(e.u) ?? []), e.t]);
  const options = limitOptions(scopeOptions(), reach);
  // team links this person made (the platform owner sees all of them), newest first
  const optionSet = scopeOptions();
  const linkRows: LinkRow[] = db.select().from(joinLinks).orderBy(sql`${joinLinks.id} desc`).limit(30).all()
    .filter((l) => l.createdBy === me.id || isGlobal(reachOf(me.id)))
    .map((l) => ({ id: l.id, label: l.label, role: l.jobRole, where: scopeLabels(parseScopes(l.scopes), optionSet).join(", "), uses: l.uses, max: l.maxUses, state: stateOfLink(l), expires: new Date(l.expiresAt * 1000).toISOString().slice(0, 10), url: linkPath(l.id) }));
  const origin = await siteUrl();
  const grantable = LEVELS.filter((l) => grantableLevels(me).includes(l.key as "manager" | "admin")); // what this person may hand out; empty for a manager
  const owner = isGlobal(reachOf(me.id)); // only the platform owner changes an admin
  const cat = catalog();
  const roles = knownRoles(cat);
  const onboarding = { cat, prog: loadProgress(shown) };
  const active = everyone.filter((u) => u.status === "active").length;
  const inScope = (id: number) => !mine || mine.has(id);
  const openTasks = db.select({ u: checklistItems.userId, n: sql<number>`count(*)` }).from(checklistItems).where(eq(checklistItems.done, false)).groupBy(checklistItems.userId).all().filter((r) => inScope(r.u)).reduce((a, r) => a + r.n, 0);
  const noteCount = db.select({ u: handovers.userId, n: sql<number>`count(*)` }).from(handovers).groupBy(handovers.userId).all().filter((r) => inScope(r.u)).reduce((a, r) => a + r.n, 0);
  const pageHref = (n: number) => `/admin/people?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;
  const tiles = [
    { Icon: UserCheck, label: "Active", value: active, cls: "text-emerald-300" },
    { Icon: UserMinus, label: "Offboarded", value: everyone.length - active, cls: "text-rose-300" },
    { Icon: ClipboardList, label: "Open tasks", value: openTasks, cls: "text-amber-300" },
    { Icon: NotebookPen, label: "Handover notes", value: noteCount, cls: "text-sky-300" },
  ];
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

  return (
    <div className="space-y-8">
      <PageHero Icon={Users} title="People" sub="Invite, assign and offboard. Each person's company, brands and projects decide what they must learn.">
        <Link href="/admin/compliance" className="btn btn-ghost !py-1 text-sm"><ShieldCheck size={15} />Who is up to date</Link>
      </PageHero>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, value }, i) => <StatTile key={label} i={i} Icon={Icon} label={label} value={value} color={[PALETTE.emerald, PALETTE.rose, PALETTE.amber, PALETTE.sky][i]} />)}
      </div>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Mail size={17} /></span>Invite someone</h2>
        <InvitePerson options={options} roles={roles} access={grantable} mailReady={mailConfigured()} />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Users size={17} /></span>Or share one link with a whole team</h2>
        <TeamLinks options={options} roles={roles} links={linkRows} origin={origin} />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><UserPlus size={17} /></span>Or create their account yourself</h2>
        <NewPerson options={options} roles={roles} access={grantable} />
      </section>
      <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><Users size={17} /></span>Everyone <span className="text-sm font-normal text-slate-400">{found.length.toLocaleString("en-GB")}{needle && ` of ${everyone.length.toLocaleString("en-GB")}`}</span></h2>
      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder="Search by name, email or role" aria-label="Search people" className={`${input} min-w-64 flex-1`} />
        <button className="btn btn-ghost !px-3 !py-1">Search</button>
        {needle && <Link href="/admin/people" className="text-xs text-sky-300 underline">Clear</Link>}
      </form>
      {all.length === 0 && <p className="card p-4 text-sm text-slate-400">Nobody matches.</p>}
      <ul className="space-y-4">
        {all.map((u, ui) => {
          const mine = items.filter((i) => i.userId === u.id);
          const myNotes = notes.filter((n) => n.userId === u.id);
          const done = mine.filter((c) => c.done).length;
          const off = u.status === "offboarded";
          const myScopes = scopesOf(u.id);
          const labels = scopeLabels(myScopes, options);
          const phases = off ? null : onboardingFor(u, myScopes, onboarding);
          const mayJudge = canSignOff(me, u.id);
          return (
            <li key={u.id} className={`card rise p-4 ${off ? "opacity-70" : ""}`} style={{ "--i": Math.min(ui, 10) } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <Initials name={u.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{u.name}
                    {u.guest === "yes" && <span title="Joined a contest from its invite link" className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">guest</span>}
                    {u.audience === "customer" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">customer</span>}
                    {u.role !== "learner" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300">{u.role === "admin" ? <Shield size={10} /> : <UserCog size={10} />}{u.role}</span>}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${off ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>{off ? <UserMinus size={10} /> : <UserCheck size={10} />}{u.status}</span>
                  </div>
                  <div className="truncate text-sm text-slate-400">{u.email} · {u.jobRole}{u.audience === "staff" && u.status === "active" && hasNoRolePath(coverageFor(u.jobRole, cat)) && <span title={`Nothing is set up for the role "${u.jobRole}", so they only get company-wide learning. Change their role, or add learning for it.`} className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">no role learning</span>}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">{labels.length ? labels.map((l) => <span key={l} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-slate-300"><Building2 size={10} />{l}</span>) : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">Not assigned to any company, brand or project yet</span>}</div>
                </div>
                {u.status === "active" && u.id !== me.id && (me.role === "admin" || u.role === "learner") && (
                  <form action={offboard}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25"><UserMinus size={14} />Offboard</button>
                  </form>
                )}
              </div>
              {!off && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-slate-400 hover:text-white">Role, access level, where {u.name.split(" ")[0]} belongs, or reset their password</summary>
                  {u.id !== me.id && u.status === "active" && <Link href={`/admin/role-change?user=${u.id}`} className="mt-2 inline-block text-sm text-sky-300 underline">Change role: promote, demote or move, with the learning and tool access it changes</Link>}
                  {u.id !== me.id && u.status === "active" && <Link href={`/admin/starting-points?user=${u.id}`} className="ml-3 mt-2 inline-block text-sm text-sky-300 underline">Starting points</Link>}
                  {u.id !== me.id && (me.role === "admin" || u.role === "learner") && <ResetPassword userId={u.id} name={u.name} />}
                  {grantable.length > 0 && u.id !== me.id && u.status === "active" && u.audience === "staff" && (u.role !== "admin" || owner) && (
                    <ActionForm action={setAccess} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select key={u.role} name="access" defaultValue={u.role} aria-label={`Access level for ${u.name}`} className={input}>
                        {[LEVELS[0], ...grantable].map((l) => <option key={l.key} value={l.key}>Access: {l.label}</option>)}
                      </select>
                      <button className="btn btn-ghost !px-3 !py-1"><Shield size={14} />Save access</button>
                      <span className="text-xs text-slate-400">Manager: runs the people in their company. Admin: also tracks, rewards and tool access.</span>
                    </ActionForm>
                  )}
                  <form action={updateScopes} className="mt-2 space-y-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <ScopePicker options={options} selected={myScopes} />
                    <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save and enrol in what is required</button>
                  </form>
                </details>
              )}
              {phases && phases.gated && phases.phases.length > 0 && (
                <details className="mt-3 text-sm" open={phases.phases.some((p) => p.state === "ready")}>
                  <summary className="cursor-pointer text-slate-400 hover:text-white">Onboarding phases{phases.phases.some((p) => p.state === "ready") && <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-400">waiting for sign-off</span>}</summary>
                  <div className="mt-2"><OnboardingPhases o={phases} sign={mayJudge ? { userId: u.id } : undefined} /></div>
                </details>
              )}
              {mine.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span className="flex items-center gap-1"><ClipboardList size={13} />Checklist</span><span>{done}/{mine.length}</span></div>
                  <div className="bar !h-1.5"><i style={{ width: `${(done / mine.length) * 100}%`, background: done === mine.length ? "#34d399" : undefined }} /></div>
                  {/* one form per person, the item in the button, instead of a form (and its encoded action) for every item */}
                  <form action={toggleChecklistItem}>
                    <ul className="mt-2 space-y-1 text-sm">
                      {mine.map((c) => (
                        <li key={c.id}>
                          <button name="id" value={c.id} className={`flex items-center gap-2 text-left transition hover:text-white ${c.done ? "text-slate-500 line-through" : ""}`}>
                            {c.done ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} className="text-slate-500" />}
                            <span className="rounded bg-white/10 px-1.5 text-[10px] uppercase text-slate-400 no-underline">{c.kind}</span>{c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </form>
                </div>
              )}
              {myNotes.map((n) => <p key={n.id} className="mt-2 flex gap-2 whitespace-pre-wrap rounded-lg bg-sky-500/10 p-2.5 text-sm"><NotebookPen size={15} className="mt-0.5 shrink-0 text-sky-300" /><span>{n.notes}</span></p>)}
              <form action={addHandover} className="mt-3 flex flex-wrap gap-2 text-sm">
                <input type="hidden" name="userId" value={u.id} />
                <select name="trackId" className={input} defaultValue="" aria-label={`Track the handover note for ${u.name} is about`}>
                  <option value="">General</option>
                  {(enrolledIn.get(u.id) ?? []).map((id) => <option key={id} value={id}>{trackName.get(id)}</option>)}
                </select>
                <input name="notes" required placeholder="Handover note: what only this person knows" className={`${input} min-w-64 flex-1`} />
                <button className="btn btn-ghost !px-3 !py-1"><Plus size={14} />Add note</button>
              </form>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn-ghost !px-3 !py-1">Previous</Link> : <span />}
          <span className="text-slate-400">Page {page} of {pages} · {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, found.length)} of {found.length.toLocaleString("en-GB")}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="btn btn-ghost !px-3 !py-1">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

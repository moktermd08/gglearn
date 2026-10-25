import { Initials, PageHero, PALETTE, StatTile } from "@/components/charts";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { checklistItems, db, enrollments, handovers, joinLinks, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addHandover, offboard, toggleChecklistItem } from "@/app/actions";
import { LEVELS, grantableLevels } from "@/lib/accessLevel";
import { mailConfigured } from "@/lib/mail";
import { catalog, loadProgress, parseScopes, scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";
import { coverageFor, hasNoRolePath, knownRoles } from "@/lib/roles";
import { Building2, CheckSquare, ClipboardList, NotebookPen, Pencil, Plus, Search, Shield, ShieldCheck, Square, UserCheck, UserCog, UserMinus, Users } from "lucide-react";
import AddPeople from "./add-people";
import TeamLinkList, { type LinkRow } from "./team-link-list";
import { linkPath, stateOfLink } from "@/lib/joinLinks";
import { siteUrl } from "@/lib/share";
import ResetPassword from "./reset-password";
import { Drawer } from "./drawer";
import { AccessEditor, PlaceEditor, RoleEditor } from "./person-editor";
import { OnboardingPhases } from "@/components/OnboardingPhases";
import { canSignOff, onboardingFor } from "@/lib/onboarding";
import { isGlobal, reachFor, reachOf, usersInReach } from "@/lib/tenancy";
import { adminScopeOf } from "@/lib/adminScope";
import { mayChangeRole } from "@/lib/roleChange";
import { placeTree } from "@/lib/placeTree";

const PAGE = 50;
type Params = { q?: string; page?: string; company?: string; brand?: string; role?: string; access?: string; status?: string; edit?: string; add?: string };
const input = "rounded border border-white/20 bg-[#fff] px-2 py-1.5";
const ACCESS = ["learner", "manager", "admin"];

export default async function People({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireManager();
  const { q = "", page: pageParam = "1", company = "", brand = "", role = "", access = "", status = "", edit = "", add = "" } = await searchParams;
  const reach = (await adminScopeOf(me)).reach, mine = usersInReach(reach);
  const tree = placeTree(reachOf(me.id)); // what this person may place people in: all of what they run, whatever the switcher shows
  const everyone = db.select().from(users).orderBy(users.name).all().filter((u) => !mine || mine.has(u.id));

  // company and brand mean "belongs to it, or to something under it" (the same reading of scopes as everywhere); only ones this person runs are honoured
  const inCompany = company && tree.companies.some((c) => c.id === Number(company)) ? usersInReach(reachFor([{ kind: "company", id: Number(company) }])) : null;
  const inBrand = brand && tree.brands.some((b) => b.id === Number(brand)) ? usersInReach(reachFor([{ kind: "brand", id: Number(brand) }])) : null;
  const needle = q.trim().toLowerCase();
  const found = everyone.filter((u) =>
    (!needle || `${u.name} ${u.email} ${u.jobRole}`.toLowerCase().includes(needle))
    && (!inCompany || inCompany.has(u.id)) && (!inBrand || inBrand.has(u.id))
    && (!role || u.jobRole === role) && (!ACCESS.includes(access) || u.role === access)
    && (status !== "active" && status !== "offboarded" || u.status === status));
  const filtered = !!(needle || inCompany || inBrand || role || ACCESS.includes(access) || status === "active" || status === "offboarded");
  const pages = Math.max(1, Math.ceil(found.length / PAGE)), page = Math.min(pages, Math.max(1, Number.parseInt(pageParam, 10) || 1));
  const all = found.slice((page - 1) * PAGE, page * PAGE);
  const editing = edit ? everyone.find((u) => u.id === Number(edit)) ?? null : null;
  const shownIds = [...new Set([...all.map((u) => u.id), ...(editing ? [editing.id] : [])])];

  // only the people on this page (and the one being edited) get their onboarding worked out; the checklist, notes and enrolments are for the one being edited
  const items = editing ? db.select().from(checklistItems).where(eq(checklistItems.userId, editing.id)).all() : [];
  const notes = editing ? db.select().from(handovers).where(eq(handovers.userId, editing.id)).all() : [];
  const trackName = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).all().map((t) => [t.id, t.name]));
  const enrolledIn = editing ? db.select({ t: enrollments.trackId }).from(enrollments).where(eq(enrollments.userId, editing.id)).all().map((e) => e.t) : [];
  const options = scopeOptions();
  const cat = catalog();
  const roles = knownRoles(cat);
  const onboarding = { cat, prog: loadProgress(new Set(shownIds)) };

  // team links this person made (the platform owner sees all of them), newest first
  const linkRows: LinkRow[] = db.select().from(joinLinks).orderBy(sql`${joinLinks.id} desc`).limit(30).all()
    .filter((l) => l.createdBy === me.id || isGlobal(reachOf(me.id)))
    .map((l) => ({ id: l.id, label: l.label, role: l.jobRole, where: scopeLabels(parseScopes(l.scopes), options).join(", "), uses: l.uses, max: l.maxUses, state: stateOfLink(l), expires: new Date(l.expiresAt * 1000).toISOString().slice(0, 10), url: linkPath(l.id) }));
  const origin = await siteUrl();
  const grantable = LEVELS.filter((l) => grantableLevels(me).includes(l.key as "manager" | "admin")).map((l) => ({ key: l.key, label: l.label, blurb: l.blurb })); // what this person may hand out; empty for a manager
  const owner = isGlobal(reachOf(me.id)); // only the platform owner changes an admin

  const active = everyone.filter((u) => u.status === "active").length;
  const inScope = (id: number) => !mine || mine.has(id);
  const openTasks = db.select({ u: checklistItems.userId, n: sql<number>`count(*)` }).from(checklistItems).where(eq(checklistItems.done, false)).groupBy(checklistItems.userId).all().filter((r) => inScope(r.u)).reduce((a, r) => a + r.n, 0);
  const noteCount = db.select({ u: handovers.userId, n: sql<number>`count(*)` }).from(handovers).groupBy(handovers.userId).all().filter((r) => inScope(r.u)).reduce((a, r) => a + r.n, 0);
  const keep: Record<string, string> = { ...(q ? { q } : {}), ...(company ? { company } : {}), ...(brand ? { brand } : {}), ...(role ? { role } : {}), ...(access ? { access } : {}), ...(status ? { status } : {}) };
  const url = (p: Record<string, string>) => { const s = new URLSearchParams(p).toString(); return s ? `/admin/people?${s}` : "/admin/people"; };
  const pageHref = (n: number) => url({ ...keep, ...(n > 1 ? { page: String(n) } : {}) });
  const editHref = (id: number) => url({ ...keep, ...(page > 1 ? { page: String(page) } : {}), edit: String(id) });
  const closeHref = pageHref(page);
  const tiles = [
    { Icon: UserCheck, label: "Active", value: active },
    { Icon: UserMinus, label: "Offboarded", value: everyone.length - active },
    { Icon: ClipboardList, label: "Open tasks", value: openTasks },
    { Icon: NotebookPen, label: "Handover notes", value: noteCount },
  ];
  const distinctRoles = [...new Set(everyone.map((u) => u.jobRole))].sort();
  const label = "block text-xs font-semibold text-slate-400";

  return (
    <div className="space-y-6">
      <PageHero Icon={Users} title="People" sub="Add people, give them a role and a place, and keep it up to date. Each person's company, brands and projects decide what they must learn.">
        <Link href="/admin/compliance" className="btn btn-ghost !py-1 text-sm"><ShieldCheck size={15} />Who is up to date</Link>
      </PageHero>
      <AddPeople tree={tree} roles={roles} access={grantable} mailReady={mailConfigured()} origin={origin} defaultOpen={add === "1"} />
      <TeamLinkList links={linkRows} origin={origin} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label: l, value }, i) => <StatTile key={l} i={i} Icon={Icon} label={l} value={value} color={[PALETTE.emerald, PALETTE.rose, PALETTE.amber, PALETTE.sky][i]} />)}
      </div>

      <section aria-labelledby="everyone" className="space-y-3">
        <h2 id="everyone" className="flex items-center gap-2.5 text-lg font-bold">Everyone <span className="text-sm font-normal text-slate-400">{found.length.toLocaleString("en-GB")}{filtered && ` of ${everyone.length.toLocaleString("en-GB")}`}</span></h2>
        <form role="search" className="card flex flex-wrap items-end gap-2 p-3 text-sm">
          <label className="block min-w-56 flex-1 space-y-1"><span className={label}>Search</span><input name="q" defaultValue={q} placeholder="Name, email or role" className={`${input} w-full`} /></label>
          {tree.companies.length > 0 && <label className="block space-y-1"><span className={label}>Company</span><select name="company" defaultValue={company} className={input}><option value="">Any</option>{tree.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {tree.brands.length > 0 && <label className="block space-y-1"><span className={label}>Brand</span><select name="brand" defaultValue={brand} className={input}><option value="">Any</option>{tree.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
          <label className="block space-y-1"><span className={label}>Job role</span><select name="role" defaultValue={role} className={input}><option value="">Any</option>{distinctRoles.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
          <label className="block space-y-1"><span className={label}>Access</span><select name="access" defaultValue={access} className={input}><option value="">Any</option><option value="learner">Learner</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label>
          <label className="block space-y-1"><span className={label}>Status</span><select name="status" defaultValue={status} className={input}><option value="">Any</option><option value="active">Active</option><option value="offboarded">Offboarded</option></select></label>
          <button className="btn !py-1.5"><Search size={14} aria-hidden />Search</button>
          {filtered && <Link href="/admin/people" className="py-2 text-xs text-sky-700 underline">Clear</Link>}
        </form>
        {all.length === 0 && <p className="card p-4 text-sm text-slate-400">Nobody matches. {filtered ? "Try fewer filters." : <>Use <b>Add people</b> above.</>}</p>}
        <ul className="space-y-2">
          {all.map((u, ui) => {
            const off = u.status === "offboarded";
            const myScopes = scopesOf(u.id);
            const labels = scopeLabels(myScopes, options);
            const phases = off ? null : onboardingFor(u, myScopes, onboarding);
            const waiting = !!phases?.gated && phases.phases.some((p) => p.state === "ready");
            return (
              <li key={u.id} className={`card rise p-3 ${off ? "opacity-70" : ""}`} style={{ "--i": Math.min(ui, 10) } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Initials name={u.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">{u.name}
                      {u.guest === "yes" && <span title="Joined a contest from its invite link" className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">guest</span>}
                      {u.audience === "customer" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">customer</span>}
                      {u.role !== "learner" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800">{u.role === "admin" ? <Shield size={10} aria-hidden /> : <UserCog size={10} aria-hidden />}{u.role}</span>}
                      {off && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800"><UserMinus size={10} aria-hidden />offboarded</span>}
                      {waiting && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800">waiting for sign-off</span>}
                    </div>
                    <div className="truncate text-sm text-slate-400">{u.email} · {u.jobRole}{u.audience === "staff" && u.status === "active" && hasNoRolePath(coverageFor(u.jobRole, cat)) && <span title={`Nothing is set up for the role "${u.jobRole}", so they only get company-wide learning. Change their role, or add learning for it.`} className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">no role learning</span>}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">{labels.length ? labels.slice(0, 4).map((l) => <span key={l} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-slate-300"><Building2 size={10} aria-hidden />{l}</span>) : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-800">Not placed in any company, brand or project yet</span>}{labels.length > 4 && <span className="px-1 py-0.5 text-slate-400">+{labels.length - 4} more</span>}</div>
                  </div>
                  <Link href={editHref(u.id)} scroll={false} aria-label={`Edit ${u.name}`} className="btn btn-ghost !px-3 !py-1.5 text-sm"><Pencil size={14} aria-hidden /><span className="hidden sm:inline">Edit</span></Link>
                </div>
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
      </section>

      {edit && !editing && <p className="card p-4 text-sm text-amber-800">That person is not someone you run. <Link href={closeHref} className="underline">Close</Link></p>}
      {editing && (() => {
        const u = editing, off = u.status === "offboarded", self = u.id === me.id, first = u.name.split(" ")[0];
        const myScopes = scopesOf(u.id);
        const inTree = myScopes.filter((s) => (s.kind === "company" ? tree.companies : s.kind === "brand" ? tree.brands : tree.projects).some((x) => x.id === s.id));
        const outside = scopeLabels(myScopes.filter((s) => !inTree.includes(s)), options);
        const phases = off ? null : onboardingFor(u, myScopes, onboarding);
        const done = items.filter((c) => c.done).length;
        const canTouch = !self && (me.role === "admin" || u.role === "learner");
        const roleWhy = mayChangeRole(me, u);
        const accessWhy = me.role !== "admin" || !grantable.length ? "Only an admin can change access." : self ? "Nobody changes their own access." : u.audience !== "staff" ? "Customers can only be learners." : u.role === "admin" && !owner ? "Only the platform owner can change an admin's access." : undefined;
        const sec = "card space-y-3 p-4", h = "text-base font-bold";
        return (
          <Drawer title={u.name} sub={`${u.email} · ${u.jobRole} · ${u.role}${off ? " · offboarded" : ""}`} closeHref={closeHref}>
            {off ? <p className="card p-4 text-sm text-slate-300">{first} has been offboarded, so their role, access and place can no longer be changed. Their notes are below.</p> : (
              <>
                <section className={sec} aria-labelledby="ed-role">
                  <h3 id="ed-role" className={h}>Job role</h3>
                  {roleWhy ? <p className="text-sm text-slate-400">{roleWhy}</p> : <RoleEditor key={u.id} userId={u.id} name={u.name} jobRole={u.jobRole} roles={roles} />}
                  {!self && <p className="text-sm"><Link href={`/admin/role-change?user=${u.id}`} className="text-sky-700 underline">Open the full Change a role page</Link> · <Link href={`/admin/starting-points?user=${u.id}`} className="text-sky-700 underline">Starting points</Link></p>}
                </section>
                <section className={sec} aria-labelledby="ed-access">
                  <h3 id="ed-access" className={h}>Access level</h3>
                  <AccessEditor key={u.id} userId={u.id} name={u.name} current={u.role} choices={grantable} blockedWhy={accessWhy} />
                </section>
                <section className={sec} aria-labelledby="ed-place">
                  <h3 id="ed-place" className={h}>Where {first} belongs</h3>
                  {outside.length > 0 && <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-900">They are also in {outside.join(", ")}, which you do not run. Saving keeps only the places you run.</p>}
                  <PlaceEditor key={u.id} userId={u.id} tree={tree} selected={inTree} />
                </section>
                {canTouch && (
                  <section className={sec} aria-labelledby="ed-account">
                    <h3 id="ed-account" className={h}>Account</h3>
                    <div><p className="text-sm font-semibold">Locked out? Set a temporary password</p><ResetPassword userId={u.id} name={u.name} /></div>
                    <form action={offboard} className="border-t border-black/10 pt-3">
                      <input type="hidden" name="userId" value={u.id} />
                      <p className="mb-2 text-sm text-slate-300">Offboarding ends their access now. Their notes and progress are kept.</p>
                      <button className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-500/25"><UserMinus size={14} aria-hidden />Offboard {first}</button>
                    </form>
                  </section>
                )}
                {phases && phases.gated && phases.phases.length > 0 && (
                  <section className={sec} aria-labelledby="ed-phases">
                    <h3 id="ed-phases" className={h}>Onboarding phases</h3>
                    <OnboardingPhases o={phases} sign={canSignOff(me, u.id) ? { userId: u.id } : undefined} />
                  </section>
                )}
              </>
            )}
            <section className={sec} aria-labelledby="ed-notes">
              <h3 id="ed-notes" className={h}>Checklist and notes</h3>
              {items.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span className="flex items-center gap-1"><ClipboardList size={13} aria-hidden />Checklist</span><span>{done}/{items.length}</span></div>
                  <div className="bar !h-1.5"><i style={{ width: `${(done / items.length) * 100}%`, background: done === items.length ? "#34d399" : undefined }} /></div>
                  {/* one form, the item in the button, instead of a form (and its encoded action) for every item */}
                  <form action={toggleChecklistItem}>
                    <ul className="mt-2 space-y-1 text-sm">
                      {items.map((c) => (
                        <li key={c.id}>
                          <button name="id" value={c.id} className={`flex items-center gap-2 text-left transition hover:text-black ${c.done ? "text-slate-500 line-through" : ""}`}>
                            {c.done ? <CheckSquare size={16} className="text-emerald-600" aria-hidden /> : <Square size={16} className="text-slate-500" aria-hidden />}
                            <span className="rounded bg-black/10 px-1.5 text-[10px] uppercase text-slate-300 no-underline">{c.kind}</span>{c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </form>
                </div>
              )}
              {notes.map((n) => <p key={n.id} className="flex gap-2 whitespace-pre-wrap rounded-lg bg-sky-500/10 p-2.5 text-sm"><NotebookPen size={15} className="mt-0.5 shrink-0 text-sky-700" aria-hidden /><span>{n.notes}</span></p>)}
              <form action={addHandover} className="flex flex-wrap gap-2 text-sm">
                <input type="hidden" name="userId" value={u.id} />
                <select name="trackId" className={input} defaultValue="" aria-label={`Track the handover note for ${u.name} is about`}>
                  <option value="">General</option>
                  {enrolledIn.map((id) => <option key={id} value={id}>{trackName.get(id)}</option>)}
                </select>
                <input name="notes" required placeholder="Handover note: what only this person knows" aria-label="Handover note" className={`${input} min-w-56 flex-1`} />
                <button className="btn btn-ghost !px-3 !py-1.5"><Plus size={14} aria-hidden />Add note</button>
              </form>
            </section>
          </Drawer>
        );
      })()}
    </div>
  );
}

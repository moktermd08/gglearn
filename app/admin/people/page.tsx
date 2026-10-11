import { PageHero, PALETTE, StatTile } from "@/components/charts";
import Link from "next/link";
import { checklistItems, db, enrollments, handovers, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addHandover, offboard, toggleChecklist, updateScopes } from "@/app/actions";
import { catalog, scopeLabels, scopeOptions, scopesOf } from "@/lib/paths";
import { coverageFor, hasNoRolePath, knownRoles } from "@/lib/roles";
import { ScopePicker } from "@/components/ScopePicker";
import { CheckSquare, ClipboardList, NotebookPen, Plus, Save, Shield, ShieldCheck, Square, UserCheck, UserMinus, UserPlus, Users, UserCog, Mail } from "lucide-react";
import NewPerson from "./new-person";
import InvitePerson from "./invite-person";
import RoleForm from "./role-form";

export default async function People() {
  const me = await requireManager();
  const all = db.select().from(users).orderBy(users.name).all();
  const items = db.select().from(checklistItems).all();
  const notes = db.select().from(handovers).all();
  const trackName = new Map(db.select({ id: tracks.id, name: tracks.name }).from(tracks).all().map((t) => [t.id, t.name]));
  const enrolledIn = new Map<number, number[]>();
  for (const e of db.select({ u: enrollments.userId, t: enrollments.trackId }).from(enrollments).all()) enrolledIn.set(e.u, [...(enrolledIn.get(e.u) ?? []), e.t]);
  const options = scopeOptions();
  const cat = catalog();
  const roles = knownRoles(cat);
  const active = all.filter((u) => u.status === "active").length;
  const openTasks = items.filter((i) => !i.done).length;
  const tiles = [
    { Icon: UserCheck, label: "Active", value: active, cls: "text-emerald-300" },
    { Icon: UserMinus, label: "Offboarded", value: all.length - active, cls: "text-rose-300" },
    { Icon: ClipboardList, label: "Open tasks", value: openTasks, cls: "text-amber-300" },
    { Icon: NotebookPen, label: "Handover notes", value: notes.length, cls: "text-sky-300" },
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
        <h2 className="flex items-center gap-2 font-semibold"><Mail size={18} className="text-sky-300" />Invite someone</h2>
        <InvitePerson options={options} roles={roles} />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold"><UserPlus size={18} className="text-emerald-300" />Or create their account yourself</h2>
        <NewPerson options={options} roles={roles} />
      </section>
      <ul className="space-y-4">
        {all.map((u, ui) => {
          const mine = items.filter((i) => i.userId === u.id);
          const myNotes = notes.filter((n) => n.userId === u.id);
          const done = mine.filter((c) => c.done).length;
          const off = u.status === "offboarded";
          const myScopes = scopesOf(u.id);
          const labels = scopeLabels(myScopes, options);
          return (
            <li key={u.id} className={`card rise p-4 ${off ? "opacity-70" : ""}`} style={{ "--i": Math.min(ui, 10) } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-extrabold text-[#fff]" style={{ background: `hsl(${(u.id * 47) % 360} 55% 40%)` }} aria-hidden>{u.name.trim().charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{u.name}
                    {u.audience === "customer" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">customer</span>}
                    {u.role !== "learner" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300">{u.role === "admin" ? <Shield size={10} /> : <UserCog size={10} />}{u.role}</span>}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${off ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>{off ? <UserMinus size={10} /> : <UserCheck size={10} />}{u.status}</span>
                  </div>
                  <div className="truncate text-sm text-slate-400">{u.email} · {u.jobRole}{u.audience === "staff" && u.status === "active" && hasNoRolePath(coverageFor(u.jobRole, cat)) && <span title={`Nothing is set up for the role "${u.jobRole}", so they only get company-wide learning. Change their role, or add learning for it.`} className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">no role learning</span>}</div>
                  <div className="truncate text-xs text-slate-500">{labels.length ? labels.join(" · ") : "Not assigned to any company, brand or project yet"}</div>
                </div>
                {u.status === "active" && u.id !== me.id && (me.role === "admin" || u.role === "learner") && (
                  <form action={offboard}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25"><UserMinus size={14} />Offboard (ends access now)</button>
                  </form>
                )}
              </div>
              {!off && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-slate-400 hover:text-white">Change role or where {u.name.split(" ")[0]} belongs</summary>
                  <RoleForm userId={u.id} jobRole={u.jobRole} roles={roles} />
                  <form action={updateScopes} className="mt-2 space-y-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <ScopePicker options={options} selected={myScopes} />
                    <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save and enrol in what is required</button>
                  </form>
                </details>
              )}
              {mine.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span className="flex items-center gap-1"><ClipboardList size={13} />Checklist</span><span>{done}/{mine.length}</span></div>
                  <div className="bar !h-1.5"><i style={{ width: `${(done / mine.length) * 100}%`, background: done === mine.length ? "#34d399" : undefined }} /></div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {mine.map((c) => (
                      <li key={c.id}>
                        <form action={toggleChecklist.bind(null, c.id)}>
                          <button className={`flex items-center gap-2 text-left transition hover:text-white ${c.done ? "text-slate-500 line-through" : ""}`}>
                            {c.done ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} className="text-slate-500" />}
                            <span className="rounded bg-white/10 px-1.5 text-[10px] uppercase text-slate-400 no-underline">{c.kind}</span>{c.label}
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {myNotes.map((n) => <p key={n.id} className="mt-2 flex gap-2 whitespace-pre-wrap rounded-lg bg-sky-500/10 p-2.5 text-sm"><NotebookPen size={15} className="mt-0.5 shrink-0 text-sky-300" /><span>{n.notes}</span></p>)}
              <form action={addHandover} className="mt-3 flex flex-wrap gap-2 text-sm">
                <input type="hidden" name="userId" value={u.id} />
                <select name="trackId" className={input} defaultValue="">
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
    </div>
  );
}

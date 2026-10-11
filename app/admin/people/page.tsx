import { checklistItems, db, handovers, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addHandover, offboard, toggleChecklist } from "@/app/actions";
import { CheckSquare, ClipboardList, NotebookPen, Plus, Shield, Square, UserCheck, UserMinus, UserPlus, Users, UserCog, Mail } from "lucide-react";
import NewPerson from "./new-person";
import InvitePerson from "./invite-person";

export default async function People() {
  const me = await requireManager();
  const all = db.select().from(users).orderBy(users.name).all();
  const items = db.select().from(checklistItems).all();
  const notes = db.select().from(handovers).all();
  const allTracks = db.select().from(tracks).orderBy(tracks.name).all();
  const active = all.filter((u) => u.status === "active").length;
  const openTasks = items.filter((i) => !i.done).length;
  const tiles = [
    { Icon: UserCheck, label: "Active", value: active, cls: "text-emerald-300" },
    { Icon: UserMinus, label: "Offboarded", value: all.length - active, cls: "text-rose-300" },
    { Icon: ClipboardList, label: "Open tasks", value: openTasks, cls: "text-amber-300" },
    { Icon: NotebookPen, label: "Handover notes", value: notes.length, cls: "text-sky-300" },
  ];
  const input = "rounded border border-white/20 bg-black/30 px-2 py-1";

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="text-indigo-300" />People</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, value, cls }, i) => (
          <div key={label} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
            <Icon size={22} className={`mx-auto ${cls}`} />
            <div className="mt-1 text-2xl font-extrabold">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold"><Mail size={18} className="text-sky-300" />Invite someone</h2>
        <InvitePerson />
      </section>
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold"><UserPlus size={18} className="text-emerald-300" />Or create their account yourself</h2>
        <NewPerson />
      </section>
      <ul className="space-y-4">
        {all.map((u, ui) => {
          const mine = items.filter((i) => i.userId === u.id);
          const myNotes = notes.filter((n) => n.userId === u.id);
          const done = mine.filter((c) => c.done).length;
          const off = u.status === "offboarded";
          return (
            <li key={u.id} className={`card rise p-4 ${off ? "opacity-70" : ""}`} style={{ "--i": Math.min(ui, 10) } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-extrabold text-white" style={{ background: `hsl(${(u.id * 47) % 360} 55% 40%)` }} aria-hidden>{u.name.trim().charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{u.name}
                    {u.role !== "learner" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300">{u.role === "admin" ? <Shield size={10} /> : <UserCog size={10} />}{u.role}</span>}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${off ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>{off ? <UserMinus size={10} /> : <UserCheck size={10} />}{u.status}</span>
                  </div>
                  <div className="truncate text-sm text-slate-400">{u.email} · {u.jobRole}</div>
                </div>
                {u.status === "active" && u.id !== me.id && (me.role === "admin" || u.role === "learner") && (
                  <form action={offboard}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25"><UserMinus size={14} />Offboard (ends access now)</button>
                  </form>
                )}
              </div>
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
                  {allTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

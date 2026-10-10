import { checklistItems, db, handovers, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addHandover, offboard, toggleChecklist } from "@/app/actions";
import NewPerson from "./new-person";
import InvitePerson from "./invite-person";

export default async function People() {
  const me = await requireManager();
  const all = db.select().from(users).orderBy(users.name).all();
  const items = db.select().from(checklistItems).all();
  const notes = db.select().from(handovers).all();
  const allTracks = db.select().from(tracks).orderBy(tracks.name).all();
  const input = "rounded border border-white/20 bg-black/30 px-2 py-1";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">People</h1>
      <section className="space-y-2">
        <h2 className="font-semibold">Invite someone</h2>
        <InvitePerson />
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Or create their account yourself</h2>
        <NewPerson />
      </section>
      <ul className="space-y-4">
        {all.map((u) => {
          const mine = items.filter((i) => i.userId === u.id);
          const myNotes = notes.filter((n) => n.userId === u.id);
          return (
            <li key={u.id} className="rounded-lg border border-white/15 p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{u.name} <span className="text-sm text-slate-400">· {u.email} · {u.jobRole}</span></div>
                  <div className={`text-xs ${u.status === "offboarded" ? "text-red-600" : "text-green-600"}`}>{u.status}</div>
                </div>
                {u.status === "active" && u.id !== me.id && (me.role === "admin" || u.role === "learner") && (
                  <form action={offboard}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="text-sm text-red-600 underline">Offboard (ends access now)</button>
                  </form>
                )}
              </div>
              {mine.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {mine.map((c) => (
                    <li key={c.id}>
                      <form action={toggleChecklist.bind(null, c.id)}>
                        <button className="text-left">{c.done ? "☑" : "☐"} <span className="text-xs text-slate-400">{c.kind}</span> {c.label}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {myNotes.map((n) => <p key={n.id} className="mt-2 whitespace-pre-wrap rounded bg-white/10 p-2 text-sm">{n.notes}</p>)}
              <form action={addHandover} className="mt-3 flex flex-wrap gap-2 text-sm">
                <input type="hidden" name="userId" value={u.id} />
                <select name="trackId" className={input} defaultValue="">
                  <option value="">General</option>
                  {allTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input name="notes" required placeholder="Handover note: what only this person knows" className={`${input} min-w-64 flex-1`} />
                <button className="underline">Add note</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

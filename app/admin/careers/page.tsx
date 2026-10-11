import { eq } from "drizzle-orm";
import { ROLE_CHECK_VALID_DAYS } from "@/lib/roleCheck";
import { db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addCareerLevel, addCareerStep, promote, removeCareerStep, saveCareerLevel } from "@/app/actions";
import { careerFor, ladderFor, rolesWithLadders } from "@/lib/careers";
import { catalog } from "@/lib/paths";
import { MAX_LEVEL } from "@/lib/levels";
import { ArrowUpRight, CircleDashed, Plus, Save, Trash2, TrendingUp } from "lucide-react";

export const metadata = { title: "Careers — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function Careers() {
  const me = await requireManager();
  const isAdmin = me.role === "admin";
  const cat = catalog();
  const people = db.select().from(users).where(eq(users.status, "active")).orderBy(users.name).all();
  const rows = people.map((p) => ({ p, c: careerFor(p, cat) })).filter((r): r is { p: typeof r.p; c: NonNullable<typeof r.c> } => !!r.c);
  const noLadder = people.filter((p) => p.audience === "staff" && !rows.some((r) => r.p.id === p.id));
  const ready = rows.filter((r) => r.c.ready);
  const roles = rolesWithLadders();
  const trackOptions = [...cat].sort((a, b) => a.name.localeCompare(b.name));
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><TrendingUp className="text-violet-300" />Careers</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">People <span className="text-xs font-normal text-slate-500">{ready.length} ready for promotion review</span></h2>
        <ul className="space-y-3">
          {rows.map(({ p, c }) => (
            <li key={p.id} className={`card p-4 ${c.ready ? "border-emerald-400/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name} <span className="text-xs text-slate-500">{c.role}</span></div>
                  <div className="text-sm text-slate-400">{c.current.title}{c.next && <> <ArrowUpRight size={12} className="inline" /> {c.next.title}</>}</div>
                </div>
                {c.next && c.total > 0 && (
                  <div className="w-40 text-right text-xs text-slate-400">{c.done}/{c.total} steps
                    <div className="bar !h-1.5 mt-1"><i style={{ width: `${(c.done / c.total) * 100}%`, background: c.ready ? "#34d399" : undefined }} /></div>
                  </div>
                )}
                {!c.next && <span className="text-xs text-slate-500">Top of the path</span>}
              </div>
              {c.hold === "role-check" && <p className="mt-2 text-sm text-amber-300">Every step is met, but there is no passing role check from the last {ROLE_CHECK_VALID_DAYS} days.</p>}
              {c.hold === "overdue" && <p className="mt-2 text-sm text-amber-300">Every step is met, but required learning is overdue.</p>}
              {c.hold === "nothing-to-measure" && c.next && <p className="mt-2 text-sm text-slate-400">No passable steps for {c.next.title} yet, so this needs a manager decision.</p>}
              {c.next && p.id !== me.id && (c.ready || isAdmin) && (
                <form action={promote} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="userId" value={p.id} />
                  <input name="note" placeholder={c.ready ? "Note (optional)" : "Why promote without every step? (required)"} required={!c.ready} className={`${input} min-w-64 flex-1`} />
                  <button className="btn !px-3 !py-1">{c.ready ? <>Promote to {c.next.title}</> : <>Promote anyway</>}</button>
                </form>
              )}
              {c.history.length > 0 && <p className="mt-2 text-xs text-slate-500">{c.history.map((h) => `${h.title} (${date(h.at)}${h.overridden ? ", override" : ""})`).join(" · ")}</p>}
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-slate-400">No staff have a role with a career ladder yet.</li>}
        </ul>
        {noLadder.length > 0 && <p className="text-xs text-slate-500">No ladder for their role: {noLadder.map((p) => `${p.name} (${p.jobRole})`).join(", ")}.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Ladders {!isAdmin && <span className="text-xs font-normal text-slate-500">view only; admins edit</span>}</h2>
        {roles.map((role) => {
          const ladder = ladderFor(role, cat);
          return (
            <details key={role} className="card p-4">
              <summary className="cursor-pointer font-semibold capitalize">{role} <span className="text-xs font-normal normal-case text-slate-500">{ladder.map((r) => r.title).join(" → ")}</span></summary>
              <ol className="mt-3 space-y-4">
                {ladder.map((r) => (
                  <li key={r.id} className="space-y-2">
                    {isAdmin ? (
                      <form action={saveCareerLevel} className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="hidden" name="id" value={r.id} />
                        <span className="w-14 text-xs text-slate-500">Level {r.level}</span>
                        <input name="title" defaultValue={r.title} required className={`${input} w-56`} aria-label="Title" />
                        <input name="summary" defaultValue={r.summary} className={`${input} min-w-64 flex-1`} aria-label="Summary" />
                        <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save</button>
                      </form>
                    ) : <div className="text-sm"><b>Level {r.level}: {r.title}</b> <span className="text-slate-400">{r.summary}</span></div>}
                    {r.level === 1 ? <p className="text-xs text-slate-500">Starting point. Nothing to pass.</p> : (
                      <ul className="space-y-1 pl-4 text-sm">
                        {r.steps.map((st) => (
                          <li key={st.reqId} className="flex flex-wrap items-center gap-2">
                            <span className={st.countable ? "" : "text-slate-500"}>{st.track.name}</span>
                            <span className="text-xs text-slate-500">pass level {st.need}</span>
                            {!st.countable && <span className="inline-flex items-center gap-1 text-xs text-amber-300"><CircleDashed size={12} />questions reach level {st.track.reach}</span>}
                            {isAdmin && <form action={removeCareerStep.bind(null, st.reqId)}><button className="text-slate-500 hover:text-rose-300" aria-label={`Remove ${st.track.name}`}><Trash2 size={13} /></button></form>}
                          </li>
                        ))}
                        {isAdmin && (
                          <li>
                            <form action={addCareerStep} className="flex flex-wrap items-center gap-2 pt-1">
                              <input type="hidden" name="levelId" value={r.id} />
                              <select name="trackId" className={`${input} max-w-64`} aria-label="Track">{trackOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                              <label className="flex items-center gap-1 text-xs text-slate-400">pass level<input name="requiredLevel" type="number" min={1} max={MAX_LEVEL} defaultValue={5} className={`${input} w-16`} /></label>
                              <button className="btn btn-ghost !px-3 !py-1"><Plus size={14} />Add step</button>
                            </form>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {isAdmin && (
                <form action={addCareerLevel} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="role" value={role} />
                  <input name="title" placeholder="Title of the next level" required className={input} />
                  <button className="btn btn-ghost !px-3 !py-1"><Plus size={14} />Add level</button>
                </form>
              )}
            </details>
          );
        })}
        {isAdmin && (
          <form action={addCareerLevel} className="card flex flex-wrap items-center gap-2 p-4 text-sm">
            <span className="text-slate-400">Start a ladder for another role:</span>
            <input name="role" placeholder="Role (as on people, e.g. marketing)" required className={input} />
            <input name="title" placeholder="Title of level 1" required className={input} />
            <button className="btn btn-ghost !px-3 !py-1"><Plus size={14} />Create</button>
          </form>
        )}
      </section>
    </div>
  );
}

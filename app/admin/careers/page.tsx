import { Chain, EmptyState, Initials, PageHero, PALETTE, StatTile } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { SubjectArt } from "@/components/SubjectArt";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ROLE_CHECK_VALID_DAYS } from "@/lib/roleCheck";
import { db, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addCareerLevel, addCareerStep, promote, removeCareerStep, saveCareerLevel } from "@/app/actions";
import { careerFor, ladderFor, rolesWithLadders } from "@/lib/careers";
import { catalog } from "@/lib/paths";
import { MAX_LEVEL } from "@/lib/levels";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, CircleDashed, Medal, Plus, Save, Trash2, TrendingUp } from "lucide-react";

export const metadata = { title: "Careers — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function Careers({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const me = await requireManager();
  const openRole = ((await searchParams).role ?? "").toLowerCase(); // only the ladder being looked at is drawn in full: all 28 at once was a 7 MB page
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
      <PageHero Icon={TrendingUp} tone="violet" title="Careers" sub="Promotion ladders for every role, and who is ready to move up." />

      <div className="grid grid-cols-3 gap-3">
        <StatTile i={0} Icon={TrendingUp} label="Ladders" value={roles.length} color={PALETTE.violet} />
        <StatTile i={1} Icon={CheckCircle2} label="Ready for review" value={ready.length} color={PALETTE.emerald} />
        <StatTile i={2} Icon={CircleDashed} label="Staff tracked" value={rows.length} color={PALETTE.sky} />
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Medal size={17} /></span>Who is moving up <span className="text-sm font-normal text-slate-400">{ready.length} ready for promotion review</span></h2>
        <ul className="grid gap-3 lg:grid-cols-2">
          {[...rows].sort((a, b) => Number(b.c.ready) - Number(a.c.ready)).map(({ p, c }) => (
            <li key={p.id} className={`card flex flex-col gap-3 p-4 ${c.ready ? "border-emerald-400/50 shadow-[0_0_30px_-12px_rgba(16,185,129,.8)]" : ""}`}>
              <div className="flex items-center gap-3">
                <Initials name={p.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">{p.name}{c.ready && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-300"><CheckCircle2 size={11} />ready</span>}</div>
                  <div className="text-xs capitalize text-slate-400">{c.role}</div>
                </div>
                {c.next && c.total > 0 && <Ring pct={c.done / c.total} label={`${c.done}/${c.total}`} sub="steps" size={72} color={c.ready ? "#10b981" : "#8b5cf6"} />}
              </div>
              {c.next ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-black/5 px-3 py-1 font-semibold">{c.current.title}</span><ArrowUpRight size={15} className="text-slate-400" /><span className="rounded-full bg-violet-500/15 px-3 py-1 font-semibold text-violet-300">{c.next.title}</span>
                </div>
              ) : <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-semibold text-amber-300"><Medal size={14} />{c.current.title} · top of the path</span>}
              {c.hold === "role-check" && <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-sm text-amber-300"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Every step is met, but there is no passing role check from the last {ROLE_CHECK_VALID_DAYS} days.</p>}
              {c.hold === "overdue" && <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-sm text-amber-300"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Every step is met, but required learning is overdue.</p>}
              {c.hold === "nothing-to-measure" && c.next && <p className="rounded-xl bg-black/[.04] p-2.5 text-sm text-slate-400">No passable steps for {c.next.title} yet, so this needs a manager decision.</p>}
              {c.next && p.id !== me.id && (c.ready || isAdmin) && (
                c.ready ? (
                  <form action={promote} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="userId" value={p.id} />
                    <input name="note" placeholder="Note (optional)" className={`${input} min-w-48 flex-1`} />
                    <button className="btn !px-3 !py-1.5"><Medal size={14} />Promote to {c.next.title}</button>
                  </form>
                ) : (
                  <details className="text-sm"><summary className="cursor-pointer text-xs text-slate-400 hover:text-white">Promote without every step</summary>
                    <form action={promote} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={p.id} />
                      <input name="note" placeholder="Why promote without every step? (required)" required className={`${input} min-w-48 flex-1`} />
                      <button className="btn btn-ghost !px-3 !py-1.5">Promote anyway</button>
                    </form></details>
                )
              )}
              {c.history.length > 0 && (
                <ol className="flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-2 text-[11px] text-slate-400" aria-label="Promotion history">
                  {c.history.map((h, i) => <li key={i} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5"><Medal size={10} />{h.title} · {date(h.at)}{h.overridden ? " · override" : ""}</li>)}
                </ol>
              )}
            </li>
          ))}
        </ul>
        {rows.length === 0 && <EmptyState Icon={TrendingUp} tone="violet" title="No staff on a ladder yet">When people have a job role that matches a career ladder, their progress shows here.</EmptyState>}
        {noLadder.length > 0 && <p className="text-xs text-slate-500">No ladder for their role: {noLadder.map((p) => `${p.name} (${p.jobRole})`).join(", ")}.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><TrendingUp size={17} /></span>Ladders {!isAdmin && <span className="text-sm font-normal text-slate-400">view only; admins edit</span>}</h2>
        {roles.map((role) => {
          const ladder = ladderFor(role, cat);
          const stairs = ladder.length;
          const isOpen = role.toLowerCase() === openRole;
          if (!isOpen) return (
            <Link key={role} href={`/admin/careers?role=${encodeURIComponent(role)}#ladder-${encodeURIComponent(role)}`} scroll className="card card-hover flex flex-wrap items-center gap-4 p-4" aria-label={`Open the ${role} ladder`}>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2"><span className="text-lg font-bold capitalize">{role}</span><span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-300">{stairs} levels</span></div>
                <div className="font-normal normal-case"><Chain steps={ladder.map((r) => r.title)} /></div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300">View steps{isAdmin ? " and edit" : ""}<ArrowUpRight size={14} /></span>
            </Link>
          );
          return (
            <details key={role} id={`ladder-${role}`} open className="card group scroll-mt-24 p-4 open:shadow-md">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 [&::-webkit-details-marker]:hidden">
                <svg viewBox="0 0 64 40" width="56" height="35" aria-hidden className="shrink-0">
                  {ladder.map((_, i) => { const w = 60 / stairs, h = 8 + ((i + 1) / stairs) * 28; return <rect key={i} x={2 + i * w} y={38 - h} width={Math.max(3, w - 2)} height={h} rx="2" fill={`hsl(${265 + i * (50 / Math.max(1, stairs))} 70% ${62 - i * 3}%)`} />; })}
                </svg>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2"><span className="text-lg font-bold capitalize">{role}</span><span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-300">{stairs} level{stairs === 1 ? "" : "s"}</span></div>
                  <div className="font-normal normal-case"><Chain steps={ladder.map((r) => r.title)} /></div>
                </div>
                <ChevronDown size={18} className="text-slate-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <ol className="mt-4 space-y-3 border-t border-black/5 pt-4">
                {ladder.map((r) => (
                  <li key={r.id} className="flex gap-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-[#fff]" style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>L{r.level}</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      {isAdmin ? (
                        <form action={saveCareerLevel} className="flex flex-wrap items-center gap-2 text-sm">
                          <input type="hidden" name="id" value={r.id} />
                          <input name="title" defaultValue={r.title} required className={`${input} w-52 font-semibold`} aria-label="Title" />
                          <input name="summary" defaultValue={r.summary} className={`${input} min-w-48 flex-1`} aria-label="Summary" />
                          <button className="btn btn-ghost !px-3 !py-1"><Save size={14} />Save</button>
                        </form>
                      ) : <div className="text-sm"><b>{r.title}</b> <span className="text-slate-400">{r.summary}</span></div>}
                      {r.level === 1 ? <p className="text-xs text-slate-500">Starting point. Nothing to pass.</p> : (
                        <ul className="flex flex-wrap gap-2">
                          {r.steps.map((st) => (
                            <li key={st.reqId} className={`inline-flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2.5 text-xs ${st.countable ? "border-black/10 bg-[#fff]" : "border-dashed border-amber-400/50 bg-amber-500/5"}`}>
                              <SubjectArt slug={st.track.slug} name={st.track.name} kind={st.track.kind} size={24} />
                              <span className="font-semibold">{st.track.name}</span>
                              <span className="rounded-full bg-violet-500/12 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">L{st.need}</span>
                              {!st.countable && <span className="inline-flex items-center gap-1 text-amber-300" title={`Questions reach level ${st.track.reach}`}><CircleDashed size={11} />coming soon</span>}
                              {isAdmin && <form action={removeCareerStep.bind(null, st.reqId)} className="flex"><button className="text-slate-400 hover:text-rose-400" aria-label={`Remove ${st.track.name}`}><Trash2 size={12} /></button></form>}
                            </li>
                          ))}
                          {r.steps.length === 0 && <li className="text-xs text-slate-500">No steps yet.</li>}
                        </ul>
                      )}
                      {isAdmin && r.level > 1 && (
                        <form action={addCareerStep} className="flex flex-wrap items-center gap-2 text-xs">
                          <input type="hidden" name="levelId" value={r.id} />
                          <select name="trackId" className={`${input} max-w-56`} aria-label="Track">{trackOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                          <label className="flex items-center gap-1 text-slate-400">pass level<input name="requiredLevel" type="number" min={1} max={MAX_LEVEL} defaultValue={5} className={`${input} w-16`} /></label>
                          <button className="btn btn-ghost !px-3 !py-1"><Plus size={13} />Add step</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {isAdmin && (
                <form action={addCareerLevel} className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-4 text-sm">
                  <input type="hidden" name="role" value={role} />
                  <input name="title" placeholder="Title of the next level" required className={input} />
                  <button className="btn btn-ghost !px-3 !py-1"><Plus size={14} />Add level</button>
                </form>
              )}
            </details>
          );
        })}
        {isAdmin && (
          <form action={addCareerLevel} className="card flex flex-wrap items-center gap-2 border-dashed p-4 text-sm">
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

import { EmptyState, PALETTE, StatTile } from "@/components/charts";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, knowledgeAcks, knowledgeChanges, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { pendingFor, REVIEW_DAYS } from "@/lib/freshness";
import { now } from "@/lib/competitions";
import { acknowledgeChange } from "@/app/actions";
import { SubjectArt } from "@/components/SubjectArt";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Clock, Quote, Sparkles } from "lucide-react";

export const metadata = { title: "What changed — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function Updates() {
  const user = await requireUser();
  // overdue first, then the soonest due
  const pending = pendingFor(user.id).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueAt - b.dueAt);
  const t = now();
  const confirmed = db.select({ c: knowledgeChanges, t: tracks, at: knowledgeAcks.at }).from(knowledgeAcks)
    .innerJoin(knowledgeChanges, eq(knowledgeChanges.id, knowledgeAcks.changeId)).innerJoin(tracks, eq(tracks.id, knowledgeChanges.trackId))
    .where(eq(knowledgeAcks.userId, user.id)).orderBy(desc(knowledgeAcks.at)).limit(40).all();
  const recent = [...new Map(confirmed.map((r) => [r.c.itemId, r])).values()].slice(0, 4); // one line per item, newest first
  const overdueN = pending.filter((p) => p.overdue).length;
  const next = pending.find((p) => !p.overdue) ?? pending[0];
  const daysLeft = (sec: number) => Math.ceil((sec - t) / 86400);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="card pop relative overflow-hidden p-6" style={{ background: "linear-gradient(125deg, rgba(245,158,11,.2), rgba(251,191,36,.08) 55%, #fff 85%)" }}>
        <svg className="pointer-events-none absolute -right-8 -top-12 h-64 w-64" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="90" fill="none" stroke="#f59e0b" strokeOpacity=".2" /><circle cx="120" cy="80" r="58" fill="none" stroke="#f59e0b" strokeOpacity=".3" strokeDasharray="4 6" className="march" /></svg>
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500 text-[#fff] shadow-lg"><BellRing size={28} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold sm:text-3xl">What changed</h1>
            <p className="max-w-xl text-sm text-slate-400">Company knowledge you have studied has been updated. Read each change, then confirm so your team knows you are current.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile i={0} Icon={BellRing} label="To read" value={pending.length} color={pending.length ? PALETTE.amber : PALETTE.emerald} />
        <StatTile i={1} Icon={AlertTriangle} label="Overdue" value={overdueN} color={overdueN ? PALETTE.rose : PALETTE.slate} />
        <StatTile i={2} Icon={CheckCircle2} label="Confirmed" value={new Set(confirmed.map((r) => r.c.itemId)).size} color={PALETTE.emerald} />
      </div>

      {pending.length > 0 && next && (
        <p className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${overdueN ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300"}`} role={overdueN ? "alert" : undefined}>
          {overdueN ? <AlertTriangle size={16} className="shrink-0" /> : <Clock size={16} className="shrink-0" />}
          {overdueN ? <span><b>{overdueN} update{overdueN === 1 ? " is" : "s are"} overdue.</b> Please read {overdueN === 1 ? "it" : "them"} first.</span> : <span>Next due <b>{date(next.dueAt)}</b> ({daysLeft(next.dueAt) <= 0 ? "today" : `${daysLeft(next.dueAt)} day${daysLeft(next.dueAt) === 1 ? "" : "s"} left`}). Updates are due {REVIEW_DAYS} days after they change.</span>}
        </p>
      )}

      {pending.length === 0 && (
        <EmptyState Icon={CheckCircle2} tone="emerald" title="You are up to date">Nothing new to read. Company updates you need to confirm will show up here.</EmptyState>
      )}

      <ol className="space-y-5">
        {pending.map(({ change, track, dueAt, overdue }, idx) => {
          const left = daysLeft(dueAt);
          return (
            <li key={change.id}>
              <article className={`card overflow-hidden border-l-4 ${overdue ? "!border-l-rose-400" : left <= 2 ? "!border-l-amber-400" : "!border-l-sky-400"}`}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2 p-5 pb-3">
                  <SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Update {idx + 1} of {pending.length}</div>
                    <h2 className="text-lg font-extrabold leading-snug">{change.title}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400"><Link href={`/tracks/${track.slug}`} className="underline">{track.name}</Link><span>· v{change.version} · changed {date(change.createdAt)}</span></div>
                  </div>
                  <span className="max-sm:order-last max-sm:basis-full"><span className={`inline-flex  items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${overdue ? "bg-rose-500/20 text-rose-300" : left <= 2 ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/15 text-sky-300"}`}>
                    {overdue ? <><AlertTriangle size={12} />{Math.abs(left)} day{Math.abs(left) === 1 ? "" : "s"} overdue</> : <><Clock size={12} />{left <= 0 ? "Due today" : `${left} day${left === 1 ? "" : "s"} left`}</>}
                  </span></span>
                </div>

                {change.note && <p className="mx-5 mb-3 flex gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300"><Quote size={15} className="mt-0.5 shrink-0" /><span><b>What changed:</b> {change.note}</span></p>}

                <div className={`mx-5 grid gap-3 ${change.before ? "md:grid-cols-2" : ""}`}>
                  {change.before && (
                    <div className="rounded-2xl border border-rose-400/25 bg-rose-500/5 p-4">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-300"><AlertTriangle size={12} />Before · no longer correct</div>
                      <p className="whitespace-pre-wrap text-sm text-slate-500 line-through decoration-rose-300/60">{change.before}</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300"><Sparkles size={12} />Now</div>
                    <p className="whitespace-pre-wrap text-sm">{change.after}</p>
                  </div>
                </div>

                <form action={acknowledgeChange.bind(null, change.id)} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <span className="text-xs text-slate-400">Confirming tells your manager you have read it.</span>
                  <button className="btn !px-5 !py-2.5"><CheckCircle2 size={17} />I have read this</button>
                </form>
              </article>
            </li>
          );
        })}
      </ol>

      {recent.length > 0 && (
        <section className="card p-5" aria-label="Recently confirmed">
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={17} /></span>Recently confirmed</h2>
          <ul className="divide-y divide-black/5">
            {recent.map((r) => (
              <li key={r.c.id} className="flex items-center gap-3 py-2.5">
                <SubjectArt slug={r.t.slug} name={r.t.name} kind={r.t.kind} size={30} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{r.c.title}</div><div className="truncate text-xs text-slate-400">{r.t.name}</div></div>
                <span className="shrink-0 text-xs text-emerald-300">Read {date(r.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length === 0 && <div className="text-center"><Link href="/dashboard" className="btn btn-ghost">Back to my quest<ArrowRight size={16} /></Link></div>}
    </div>
  );
}

import { EmptyState, Initials, PageHero, PALETTE, StatTile } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { SubjectArt } from "@/components/SubjectArt";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { brands, db, knowledgeItems, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { REVIEW_DAYS, changeReport } from "@/lib/freshness";
import { ChangeForm } from "./form";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileText, HelpCircle, Newspaper, PenLine, Quote, Search } from "lucide-react";

export const metadata = { title: "Is everyone current — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function Freshness({ searchParams }: { searchParams: Promise<{ item?: string; track?: string }> }) {
  const me = await requireManager();
  const sp = await searchParams;
  const report = changeReport();
  const item = me.role === "admin" && /^\d+$/.test(sp.item ?? "") ? db.select().from(knowledgeItems).where(eq(knowledgeItems.id, Number(sp.item))).get() : undefined;
  const itemTrack = item && db.select().from(tracks).where(eq(tracks.id, item.trackId)).get();
  const picker = me.role === "admin" && !item
    ? db.select({ t: tracks, b: brands }).from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).all().filter((r) => r.t.slug === sp.track)[0]
    : undefined;
  const items = picker ? db.select().from(knowledgeItems).where(eq(knowledgeItems.trackId, picker.t.id)).all() : [];
  // the tracks that have company knowledge to change, so nobody has to remember a slug
  const withItems = me.role === "admin" && !item && !picker
    ? db.select({ slug: tracks.slug, name: tracks.name, kind: tracks.kind, brand: brands.name, n: sql<number>`count(${knowledgeItems.id})` }).from(knowledgeItems)
      .innerJoin(tracks, eq(tracks.id, knowledgeItems.trackId)).innerJoin(brands, eq(brands.id, tracks.brandId)).groupBy(tracks.id).orderBy(brands.name, tracks.name).all()
    : [];
  const overdueN = report.filter((r) => r.change.material && r.overdue && r.affected.some((a) => !a.read)).length;
  const currentN = report.filter((r) => r.change.material && r.affected.every((a) => a.read)).length;
  const stepNow = item ? 3 : picker ? 2 : 1;

  return (
    <div className="space-y-8">
      <PageHero Icon={Newspaper} tone="amber" title="Is everyone current" sub={<>
          When company knowledge changes (a brand moto, tone, policy), people enrolled in that track are asked to read it within {REVIEW_DAYS} days.
          People who joined after the change are not asked.
        </>} />

      <div className="grid grid-cols-3 gap-3">
        <StatTile i={0} Icon={Newspaper} label="Changes recorded" value={report.length} color={PALETTE.amber} />
        <StatTile i={1} Icon={CheckCircle2} label="Everyone current" value={currentN} color={PALETTE.emerald} />
        <StatTile i={2} Icon={AlertTriangle} label="Overdue" value={overdueN} color={PALETTE.rose} />
      </div>

      {me.role === "admin" && (
        <section className="card space-y-4 p-5">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><PenLine size={17} /></span>Record a change</h2>
          <ol className="grid grid-cols-3 gap-1 text-center text-[11px] font-semibold" aria-label="Steps">
            {["Pick the track", "Pick the item", "Write the change"].map((t, i) => (
              <li key={t} className="relative flex flex-col items-center gap-1" aria-current={i + 1 === stepNow ? "step" : undefined}>
                {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i + 1 <= stepNow ? "bg-amber-400" : "bg-black/10"}`} aria-hidden />}
                <span className={`relative grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-extrabold ${i + 1 < stepNow ? "border-emerald-500 bg-emerald-500 text-[#fff]" : i + 1 === stepNow ? "border-amber-500 bg-amber-500 text-[#fff]" : "border-black/15 bg-[#fff] text-slate-400"}`}>{i + 1 < stepNow ? "✓" : i + 1}</span>
                <span className={i + 1 === stepNow ? "text-amber-300" : "text-slate-400"}>{t}</span>
              </li>
            ))}
          </ol>

          {item && itemTrack ? (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-black/[.03] p-3">
                <SubjectArt slug={itemTrack.slug} name={itemTrack.name} kind={itemTrack.kind} size={40} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.title}</div><div className="text-xs text-slate-400">{itemTrack.name} · version {item.version}</div></div>
                <Link href="/admin/freshness" className="inline-flex items-center gap-1 text-xs text-slate-400 underline"><ArrowLeft size={12} />cancel</Link>
              </div>
              <ChangeForm itemId={item.id} body={item.body} />
            </>
          ) : picker ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl bg-black/[.03] p-3">
                <SubjectArt slug={picker.t.slug} name={picker.t.name} kind={picker.t.kind} size={40} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{picker.t.name}</div><div className="text-xs text-slate-400">{picker.b.name} · {items.length} item{items.length === 1 ? "" : "s"}</div></div>
                <Link href="/admin/freshness" className="inline-flex items-center gap-1 text-xs text-slate-400 underline"><ArrowLeft size={12} />change track</Link>
              </div>
              {items.length === 0 ? <p className="text-sm text-slate-400">{picker.t.name} has no knowledge items yet; import some first.</p> : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {items.map((i) => (
                    <li key={i.id} className="min-w-0"><Link href={`/admin/freshness?item=${i.id}`} className="group flex min-w-0 items-center gap-3 rounded-xl border border-black/10 bg-[#fff] p-3 transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/12 text-amber-300"><FileText size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{i.title}</span><span className="text-[11px] text-slate-400">v{i.version} · updated {date(i.updatedAt)}</span></span>
                      <ArrowRight size={15} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                    </Link></li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {withItems.length > 0 ? (
                <ul className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {withItems.map((t) => (
                    <li key={t.slug} className="min-w-0"><Link href={`/admin/freshness?track=${t.slug}`} className="group flex min-w-0 items-center gap-3 rounded-xl border border-black/10 bg-[#fff] p-3 transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md">
                      <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={36} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.name}</span><span className="text-[11px] text-slate-400">{t.brand} · {t.n} item{t.n === 1 ? "" : "s"}</span></span>
                    </Link></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-400">No track has company knowledge to change yet. Import some first.</p>}
              <form className="flex flex-wrap items-center gap-2 text-sm">
                <Search size={15} className="text-slate-400" /><label className="text-xs text-slate-400" htmlFor="track">Or type a track slug</label>
                <input id="track" name="track" defaultValue={sp.track} placeholder="e.g. moksy-product" className="rounded border border-black/15 bg-[#fff] px-2 py-1" />
                <button className="btn btn-ghost !py-1">Find items</button>
              </form>
            </>
          )}
        </section>
      )}

      <section aria-label="Changes">
        {report.length === 0 && <EmptyState Icon={Newspaper} tone="amber" title="No changes recorded yet">{me.role === "admin" ? "When company knowledge changes, record it above and everyone enrolled is asked to read it." : "When company knowledge changes, an admin records it and everyone enrolled is asked to read it. You will see who has read it here."}</EmptyState>}
        {report.length > 0 && (
          <ul className="relative space-y-4 pl-9 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-0.5 before:bg-gradient-to-b before:from-amber-300 before:to-black/10">
            {report.map((r) => {
              const read = r.affected.filter((a) => a.read).length, waiting = r.affected.filter((a) => !a.read);
              const state = !r.change.material ? "fix" : waiting.length === 0 ? "current" : r.overdue ? "overdue" : "progress";
              const dot = { fix: "bg-slate-300", current: "bg-emerald-500", overdue: "bg-rose-500", progress: "bg-sky-500" }[state];
              return (
                <li key={r.change.id} className="relative">
                  <span className={`absolute -left-9 top-5 grid h-6 w-6 place-items-center rounded-full border-4 border-[#f7f5ef] ${dot}`} aria-hidden>{state === "current" && <CheckCircle2 size={12} className="text-[#fff]" />}{state === "overdue" && <AlertTriangle size={11} className="text-[#fff]" />}</span>
                  <div className={`card space-y-3 border-l-4 p-4 ${state === "fix" ? "!border-l-slate-300" : state === "current" ? "!border-l-emerald-400" : state === "overdue" ? "!border-l-rose-400" : "!border-l-sky-400"}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <SubjectArt slug={r.track.slug} name={r.track.name} kind={r.track.kind} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold">{r.change.title}</span>
                          {state === "fix" && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-300">wording fix</span>}
                          {state === "current" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-300"><CheckCircle2 size={11} />everyone current</span>}
                          {state === "progress" && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-sky-300">in progress</span>}
                          {state === "overdue" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-rose-300"><AlertTriangle size={11} />overdue</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">{r.brand} · {r.track.name} · v{r.change.version} · {date(r.change.createdAt)}{r.by && ` · by ${r.by}`}</div>
                      </div>
                      {state !== "fix" && r.affected.length > 0 && <Ring pct={read / r.affected.length} label={`${read}/${r.affected.length}`} sub="read" size={72} color={state === "current" ? "#10b981" : state === "overdue" ? "#f43f5e" : "#0ea5e9"} />}
                    </div>
                    {r.change.note && <p className="flex gap-2 rounded-xl bg-black/[.03] p-3 text-sm text-slate-300"><Quote size={14} className="mt-0.5 shrink-0 text-slate-400" />{r.change.note}</p>}
                    {!!r.change.material && r.affected.length === 0 && <p className="text-xs text-slate-400">Nobody was enrolled when this changed.</p>}
                    {waiting.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold">Still to read:</span>
                        {waiting.slice(0, 8).map((a) => <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-black/5 py-0.5 pl-0.5 pr-2 text-slate-300"><Initials name={a.name} size={20} />{a.name}</span>)}
                        {waiting.length > 8 && <span>+{waiting.length - 8} more</span>}
                      </div>
                    )}
                    {!!r.change.material && r.linkedQuestions > 0 && (
                      <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-300">
                        <HelpCircle size={15} className="shrink-0" />
                        <span>{r.linkedQuestions} active question{r.linkedQuestions === 1 ? " is" : "s are"} linked to this item and may now be out of date. <Link href={`/admin/review/${r.track.slug}`} className="font-semibold underline">Review {r.track.name}</Link></span>
                      </p>
                    )}
                    {me.role === "admin" && <Link href={`/admin/freshness?item=${r.change.itemId}`} className="inline-flex items-center gap-1 text-xs text-slate-400 underline">Change it again</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

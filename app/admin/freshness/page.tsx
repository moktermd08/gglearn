import Link from "next/link";
import { eq } from "drizzle-orm";
import { brands, db, knowledgeItems, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { REVIEW_DAYS, changeReport } from "@/lib/freshness";
import { ChangeForm } from "./form";
import { AlertTriangle, CheckCircle2, Newspaper } from "lucide-react";

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
  const input = "rounded border border-white/20 bg-[#fff] px-2 py-1 text-slate-900";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Newspaper className="text-amber-300" />Is everyone current</h1>
        <p className="mt-1 text-sm text-slate-400">
          When company knowledge changes (a brand moto, tone, policy), people enrolled in that track are asked to read it within {REVIEW_DAYS} days.
          People who joined after the change are not asked.
        </p>
      </div>

      {me.role === "admin" && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Record a change</h2>
          {item && itemTrack ? (
            <>
              <p className="text-sm text-slate-400">{itemTrack.name} · <b className="text-slate-200">{item.title}</b> · version {item.version} · <Link href="/admin/freshness" className="underline">cancel</Link></p>
              <ChangeForm itemId={item.id} body={item.body} />
            </>
          ) : (
            <form className="flex flex-wrap items-end gap-2 text-sm">
              <label>Track slug <input name="track" defaultValue={sp.track} placeholder="e.g. moksy-product" className={input} /></label>
              <button className="btn btn-ghost !py-1">Find items</button>
            </form>
          )}
          {picker && (
            <ul className="space-y-1 text-sm">
              {items.length === 0 && <li className="text-slate-400">{picker.t.name} has no knowledge items yet; import some first.</li>}
              {items.map((i) => (
                <li key={i.id}><Link href={`/admin/freshness?item=${i.id}`} className="underline">{i.title}</Link> <span className="text-xs text-slate-500">v{i.version} · updated {date(i.updatedAt)}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {report.length === 0 && <p className="text-sm text-slate-400">No changes recorded yet.</p>}
      <ul className="space-y-3">
        {report.map((r) => {
          const read = r.affected.filter((a) => a.read).length, waiting = r.affected.filter((a) => !a.read);
          return (
            <li key={r.change.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.change.title}</span>
                <span className="text-xs text-slate-500">{r.brand} · {r.track.name} · v{r.change.version} · {date(r.change.createdAt)}{r.by && ` · by ${r.by}`}</span>
                {!r.change.material
                  ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">wording fix</span>
                  : waiting.length === 0
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300"><CheckCircle2 size={11} />everyone current</span>
                    : <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.overdue ? "bg-rose-500/20 text-rose-300" : "bg-sky-500/20 text-sky-300"}`}>{r.overdue && <AlertTriangle size={11} />}{r.overdue ? "overdue" : "in progress"}</span>}
              </div>
              {r.change.note && <p className="text-sm text-slate-300">{r.change.note}</p>}
              {r.change.material ? (
                <p className="text-xs text-slate-400">{read}/{r.affected.length} read{r.affected.length === 0 && " (nobody was enrolled when this changed)"}</p>
              ) : null}
              {!!r.change.material && r.affected.length > 0 && <div className="bar !h-1.5"><i style={{ width: `${(read / r.affected.length) * 100}%`, background: waiting.length === 0 ? "#34d399" : r.overdue ? "#fb7185" : undefined }} /></div>}
              {waiting.length > 0 && <p className="text-xs text-slate-400">Still to read: {waiting.map((a) => a.name).join(", ")}</p>}
              {!!r.change.material && r.linkedQuestions > 0 && (
                <p className="text-xs text-amber-300">
                  {r.linkedQuestions} active question{r.linkedQuestions === 1 ? " is" : "s are"} linked to this item and may now be out of date. <Link href={`/admin/review/${r.track.slug}`} className="underline">Review {r.track.name}</Link>
                </p>
              )}
              {me.role === "admin" && <Link href={`/admin/freshness?item=${r.change.itemId}`} className="text-xs underline text-slate-400">Change it again</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

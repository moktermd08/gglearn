import Link from "next/link";
import { redirect } from "next/navigation";
import { Lightbulb, MousePointerClick, SearchX, Route } from "lucide-react";
import { EmptyState, PageHero, PALETTE, StatTile } from "@/components/charts";
import { requireManager } from "@/lib/auth";
import { problemReport } from "@/lib/problemLog";
import { isGlobal, reachOf } from "@/lib/tenancy";

export const metadata = { title: "What people ask the map — gglearn" };

const PERIODS = [7, 30, 90];

/**
 * What people pick in the problem finder of each map, as anonymous counts. Shared by every company, so only the platform owner sees it.
 * Shows which problems people really have, which entries nobody picks (reword or drop them) and how often a search finds nothing.
 */
export default async function Problems({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireManager();
  if (me.role !== "admin" || !isGlobal(reachOf(me.id))) redirect("/admin/compliance");
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const report = problemReport(days);

  return (
    <div className="space-y-4">
      <PageHero Icon={Lightbulb} title="What people ask the map" sub={<>Which problems people pick in each map&apos;s finder, over the last {days} days. Only daily counts are kept: no account, no address and nothing anyone typed. Use it to add the problems people really have and to reword or drop the ones nobody picks.</>}>
        <nav aria-label="Period" className="mt-3 inline-flex overflow-hidden rounded-full border border-black/15 bg-[#fff] text-[13px] font-semibold">
          {PERIODS.map((d) => <Link key={d} href={`/admin/problems?days=${d}`} aria-current={d === days ? "page" : undefined} className={`px-3 py-1 ${d === days ? "bg-[#14161f] text-[#fff]" : "hover:bg-black/5"}`}>{d} days</Link>)}
        </nav>
      </PageHero>

      {"error" in report ? (
        <EmptyState Icon={Lightbulb} title="Nothing is being counted yet">The table that holds the counts has not been created yet. The next deploy creates it (the deploy script pushes the schema), or run <code>npm run db:push</code> on this server now, then come back.</EmptyState>
      ) : report.maps.every((m) => m.total === 0) ? (
        <EmptyState Icon={Lightbulb} title="No picks yet">Nobody has used the finder in the last {days} days. Counts appear here as people pick a problem, jump to a stop or search for something the map cannot match.</EmptyState>
      ) : report.maps.map((m) => {
        const picks = m.picks.reduce((s, p) => s + p.n, 0), jumps = m.stops.reduce((s, p) => s + p.n, 0);
        return (
          <section key={m.id} className="space-y-3" aria-label={m.label}>
            <h2 className="text-lg font-bold">{m.label}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile Icon={MousePointerClick} label="Problems picked" value={picks} color={PALETTE.indigo} i={0} />
              <StatTile Icon={Route} label="Jumps to a named stop" value={jumps} color={PALETTE.sky} i={1} />
              <StatTile Icon={SearchX} label="Searches that found nothing" value={m.nomatch} color={m.nomatch > picks ? PALETTE.rose : PALETTE.amber} i={2} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="text-sm font-semibold">Most picked</h3>
                {m.picks.length ? (
                  <ol className="mt-2 space-y-1.5 text-sm">
                    {m.picks.slice(0, 15).map((p) => <li key={p.id} className="flex items-baseline gap-3"><b className="w-10 shrink-0 text-right tabular-nums">{p.n}</b><span>{p.say}</span></li>)}
                  </ol>
                ) : <p className="mt-2 text-sm text-slate-400">Nothing picked yet.</p>}
              </div>
              <div className="card p-4">
                <h3 className="text-sm font-semibold">Never picked in {days} days <span className="font-normal text-slate-400">({m.unpicked.length} of {m.picks.length + m.unpicked.length})</span></h3>
                <p className="mt-0.5 text-[12.5px] text-slate-400">Reword these, move them into the common situations, or drop them.</p>
                <ul className="mt-2 max-h-72 space-y-1 overflow-auto text-sm">
                  {m.unpicked.map((p) => <li key={p.id}>{p.say}</li>)}
                </ul>
              </div>
            </div>
            {m.stops.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold">Stops people went straight to</h3>
                <p className="mt-0.5 text-[12.5px] text-slate-400">Someone typed a stop&apos;s name. A frequent one may deserve a problem of its own.</p>
                <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                  {m.stops.slice(0, 20).map((s) => <li key={s.id} className="rounded-full border border-black/15 px-3 py-1"><b>{s.n}</b> {s.name}</li>)}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

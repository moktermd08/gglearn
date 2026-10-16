import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { certificates, db, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { certState, signatureStatus } from "@/lib/certs";
import { revocationLog } from "@/lib/certsAdmin";
import { certTitle } from "@/lib/levels";
import { reachOf, usersInReach } from "@/lib/tenancy";
import { ReinstateForm, RevokeForm } from "./forms";

export const metadata = { title: "Certificates — gglearn" };
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const SHOWN = 100;

export default async function Certificates({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const { q = "", show = "" } = await searchParams;
  const mine = usersInReach(reachOf(me.id)), needle = q.trim().toLowerCase();
  const all = db.select({ c: certificates, who: users.name, email: users.email, track: tracks.name }).from(certificates)
    .innerJoin(users, eq(users.id, certificates.userId)).innerJoin(tracks, eq(tracks.id, certificates.trackId))
    .orderBy(desc(certificates.issuedAt)).all().filter((r) => !mine || mine.has(r.c.userId));
  const rows = all.filter((r) => (!needle || `${r.who} ${r.email} ${r.c.code} ${r.track}`.toLowerCase().includes(needle)) && (show !== "revoked" || r.c.revokedAt));
  const revokedCount = all.filter((r) => r.c.revokedAt).length;
  const ids = new Set(all.map((r) => r.c.id));
  const log = revocationLog(200).filter((x) => ids.has(x.e.certificateId)).slice(0, 15);
  const byCert = new Map(all.map((r) => [r.c.id, r]));
  const h2 = "mb-2 text-lg font-semibold";

  return (
    <div className="space-y-8">
      <PageHero Icon={Award} title="Certificates" sub="Revoke a certificate that was issued in error or should no longer stand, or reinstate one. People in the companies you run only. The holder is told why; the public page shows it as revoked without the reason." />
      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder="Search by name, email, code or subject" aria-label="Search certificates" className="min-w-64 flex-1 rounded border border-white/20 bg-[#fff] px-2 py-1" />
        <select name="show" defaultValue={show} aria-label="Filter" className="rounded border border-white/20 bg-[#fff] px-2 py-1"><option value="">All</option><option value="revoked">Revoked only ({revokedCount})</option></select>
        <button className="btn btn-ghost !px-3 !py-1">Search</button>
      </form>

      <section>
        <h2 className={h2}>{rows.length.toLocaleString("en-GB")} certificate{rows.length === 1 ? "" : "s"}{rows.length > SHOWN && <span className="text-sm font-normal text-slate-400"> · newest {SHOWN} shown, search to narrow</span>}</h2>
        {rows.length === 0 ? <p className="card p-4 text-sm text-slate-400">Nothing matches.</p> : (
          <ul className="card divide-y divide-black/5 text-sm">
            {rows.slice(0, SHOWN).map(({ c, who, track }) => {
              const life = certState(c), sig = signatureStatus(c), revoked = !!c.revokedAt;
              return (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-40 font-semibold">{who}</span>
                    <span>{certTitle(c.level)} · {track}</span>
                    <span className="text-xs text-slate-400">level {c.level} · issued {day(c.issuedAt)}{life.expiresAt != null && ` · ${life.state === "expired" ? "expired" : "expires"} ${day(life.expiresAt)}`}</span>
                    {revoked && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-500">Revoked {day(c.revokedAt!)}</span>}
                    {sig === "altered" && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">Does not match signature</span>}
                    <Link href={`/cert/${c.code}`} className="ml-auto font-mono text-xs text-sky-300 underline">{c.code}</Link>
                  </div>
                  {revoked ? (
                    <>
                      <p className="mt-1 text-xs text-slate-400">Reason: {c.revokedReason}</p>
                      <ReinstateForm id={c.id} />
                    </>
                  ) : (
                    <details className="mt-1"><summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Revoke…</summary><RevokeForm id={c.id} who={who.split(" ")[0]} /></details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className={h2}>Recent changes</h2>
        {log.length === 0 ? <p className="text-sm text-slate-400">No certificate has been revoked yet.</p> : (
          <ul className="card divide-y divide-black/5 text-sm">
            {log.map(({ e, by }) => { const r = byCert.get(e.certificateId); return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${e.kind === "revoked" ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-600"}`}>{e.kind}</span>
                <span>{r?.who} · {r?.track}, level {r?.c.level}</span>
                <span className="text-xs text-slate-400">by {by} on {day(e.at)}{e.reason && ` · ${e.reason}`}</span>
              </li>); })}
          </ul>
        )}
      </section>
    </div>
  );
}

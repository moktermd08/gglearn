import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { brands, companies, db, rewardAwards, rewardRules, tracks, users } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { CURRENCIES, money } from "@/lib/competitions-shared";
import { describe } from "@/lib/rewards";
import { scopeInReach, trackInReach } from "@/lib/tenancy";
import { adminScopeOf } from "@/lib/adminScope";
import { deleteRewardRule } from "./actions";
import { RuleForm, SettleForm } from "./forms";

export const metadata = { title: "Rewards — gglearn" };

export default async function Rewards() {
  const me = await requireManager();
  if (me.role !== "admin") redirect("/admin/compliance");
  const reach = (await adminScopeOf(me)).reach;
  const cos = db.select().from(companies).orderBy(companies.name).all().filter((c) => scopeInReach(reach, { kind: "company", id: c.id }));
  const coName = new Map(cos.map((c) => [c.id, c.name]));
  const bs = db.select().from(brands).orderBy(brands.name).all().filter((b) => b.kind === "company" && b.companyId != null && coName.has(b.companyId));
  const brandName = new Map(bs.map((b) => [b.id, b.name]));
  const ts = db.select().from(tracks).orderBy(tracks.name).all().filter((t) => trackInReach(reach, t) && brandName.has(t.brandId));
  const trackName = new Map(ts.map((t) => [t.id, t.name]));
  const targets = [
    ...cos.map((c) => ({ scope: "company" as const, id: c.id, label: `Company · ${c.name}` })),
    ...bs.map((b) => ({ scope: "brand" as const, id: b.id, label: `Brand · ${coName.get(b.companyId!)} · ${b.name}` })),
    ...ts.map((t) => ({ scope: "track" as const, id: t.id, label: `Track · ${brandName.get(t.brandId)} · ${t.name}` })),
  ];
  const rules = db.select().from(rewardRules).orderBy(rewardRules.scope, rewardRules.refId, rewardRules.level).all().filter((r) =>
    r.scope === "company" ? coName.has(r.refId) : r.scope === "brand" ? brandName.has(r.refId) : trackName.has(r.refId));
  const where = (r: (typeof rules)[number]) => r.scope === "company" ? `Company · ${coName.get(r.refId)}` : r.scope === "brand" ? `Brand · ${brandName.get(r.refId)}` : `Track · ${trackName.get(r.refId)}`;
  const what = (r: (typeof rules)[number]) => r.enabled === "off" ? "Switched off" : r.kind === "certificate" ? "Certificate" : r.kind === "xp" ? `${r.amount} bonus XP` : r.kind === "voucher" ? `Voucher: ${r.label}` : money(r.amount, r.currency);

  const awards = db.select({ a: rewardAwards, who: users.name, track: tracks.name }).from(rewardAwards)
    .innerJoin(users, eq(users.id, rewardAwards.userId)).innerJoin(tracks, eq(tracks.id, rewardAwards.trackId))
    .orderBy(desc(rewardAwards.createdAt)).limit(400).all().filter((x) => trackName.has(x.a.trackId) && (x.a.kind === "voucher" || x.a.kind === "money"));
  const pending = awards.filter((x) => x.a.status === "pending"), settled = awards.filter((x) => x.a.status !== "pending").slice(0, 20);
  const h2 = "mb-2 text-lg font-semibold";

  return (
    <div className="space-y-8">
      <PageHero Icon={Gift} title="Rewards" sub="What people earn the first time they pass a level of your content: a certificate, bonus XP, a voucher or money. gglearn records who is owed what; you send vouchers and pay money yourself, then mark it sent." />

      <section>
        <h2 className={h2}>Add or change a rule</h2>
        {targets.length ? <RuleForm targets={targets} currencies={Object.keys(CURRENCIES)} /> : <p className="card p-4 text-sm text-slate-400">Add a company, brand and track on Set up first.</p>}
        <p className="mt-2 text-xs text-slate-400">With no rule, the academy default applies: a certificate at levels 5, 10, 15 and 20. Vouchers and money always need a limit, so the total cost is capped.</p>
      </section>

      <section>
        <h2 className={h2}>Current rules</h2>
        {rules.length === 0 ? <p className="text-sm text-slate-400">None yet: only the default certificates are given.</p> : (
          <div className="card divide-y divide-black/5 text-sm">
            {rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="min-w-56 font-semibold">{where(r)}</span>
                <span>Level {r.level}</span>
                <span className="text-slate-300">{what(r)}</span>
                {r.maxAwards > 0 && <span className="text-xs text-slate-400">up to {r.maxAwards.toLocaleString("en-GB")} people</span>}
                <form action={deleteRewardRule} className="ml-auto"><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost !py-1 text-xs">Remove</button></form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className={h2}>To send {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">{pending.length}</span>}</h2>
        {pending.length === 0 ? <p className="text-sm text-slate-400">Nothing waiting.</p> : (
          <div className="space-y-2">
            {pending.map(({ a, who, track }) => (
              <div key={a.id} className="card space-y-2 p-3 text-sm">
                <div><b>{who}</b> earned {describe(a)} <span className="text-slate-400">· {track}, level {a.level} · {new Date(a.createdAt * 1000).toISOString().slice(0, 10)}</span></div>
                <SettleForm awardId={a.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className={h2}>Recently settled</h2>
          <div className="card divide-y divide-black/5 text-sm">
            {settled.map(({ a, who, track }) => (
              <div key={a.id} className="flex flex-wrap gap-x-4 px-4 py-2"><b>{who}</b><span>{describe(a)}</span><span className="text-slate-400">{track} · level {a.level}</span><span className={a.status === "fulfilled" ? "text-emerald-300" : "text-slate-400"}>{a.status === "fulfilled" ? `Sent · ${a.reference}` : "Void"}</span></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

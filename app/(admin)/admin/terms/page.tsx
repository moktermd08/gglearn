import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { db, terms, users } from "@/lib/db";
import { realUser, requireManager, viewAsState } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import { allBanks, termsAvailable } from "@/lib/terms";
import { RANKS } from "@/lib/termsCore";
import { PageHero } from "@/components/charts";
import { BankForm, PromoteForm, TermForm, type TermRow } from "./forms";

export const metadata = { title: "Terms — gglearn" };

/** The shared vocabulary: banks of terms at five ranks. Only a super admin edits it; candidates' own terms wait here until one is promoted. */
export default async function AdminTerms({ searchParams }: { searchParams: Promise<{ bank?: string }> }) {
  await requireManager();
  const real = await realUser();
  if (!isSuperAdmin(real) || (await viewAsState())) redirect("/admin");
  if (!termsAvailable()) {
    return <p className="card p-4 text-sm text-slate-500">The term bank tables are not in this database yet. Run <code>npm run db:push</code>, then <code>npm run import:terms</code>.</p>;
  }
  const { bank: slug = "" } = await searchParams;
  const banks = allBanks();
  const current = banks.find((b) => b.slug === slug) ?? banks[0] ?? null;
  const bankOptions = banks.map((b) => ({ id: b.id, name: b.name }));

  const counts = new Map(db.select({ bankId: terms.bankId, n: sql<number>`count(*)` }).from(terms).where(and(isNotNull(terms.bankId), sql`${terms.ownerUserId} is null`)).groupBy(terms.bankId).all().map((r) => [r.bankId, r.n]));
  const rows = current
    ? db.select().from(terms).where(and(eq(terms.bankId, current.id), sql`${terms.ownerUserId} is null`)).orderBy(asc(terms.sortOrder), asc(terms.id)).all()
    : [];
  const groups = new Map<string, typeof rows>();
  for (const r of rows) { const g = r.groupName || "No group"; groups.set(g, [...(groups.get(g) ?? []), r]); }
  const perTier = RANKS.map((_, i) => rows.filter((r) => r.tier === i + 1 && r.status === "active").length);

  const own = db.select({ t: terms, who: users.name }).from(terms).innerJoin(users, eq(users.id, terms.ownerUserId))
    .where(and(eq(terms.status, "active"), isNotNull(terms.ownerUserId))).orderBy(asc(terms.term)).limit(200).all();
  const h2 = "mb-2 text-lg font-semibold";

  return (
    <div className="space-y-8">
      <PageHero Icon={BookOpen} title="Terms" sub="The words people at work need to know, in banks, each term at one of five ranks. Candidates are tested on these; you keep them accurate. Terms candidates add for themselves stay private until you add one to a bank." />

      <section>
        <h2 className={h2}>Banks</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {banks.map((b) => (
            <Link key={b.id} href={`/admin/terms?bank=${b.slug}`} className={`rounded-full border px-3 py-1 ${b.id === current?.id ? "border-indigo-500 bg-indigo-50 font-semibold" : "border-black/15"}`}>
              {b.name} <span className="text-slate-500">{counts.get(b.id) ?? 0}</span>
            </Link>
          ))}
        </div>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Add a bank</summary><div className="mt-2"><BankForm /></div></details>
      </section>

      {current && (
        <>
          <section>
            <h2 className={h2}>{current.name}</h2>
            <p className="mb-2 text-xs text-slate-500">Terms per rank (shown only): {perTier.map((n, i) => `${RANKS[i]} ${n}`).join(" · ")}. Roles: {current.roles || "everyone"}.</p>
            <details><summary className="cursor-pointer text-sm font-semibold">Edit this bank</summary><div className="mt-2"><BankForm bank={current} /></div></details>
          </section>

          <section>
            <h2 className={h2}>Add a term</h2>
            <TermForm banks={bankOptions} bankId={current.id} />
          </section>

          <section className="space-y-4">
            <h2 className={h2}>Terms in {current.name}</h2>
            {[...groups].map(([g, list]) => (
              <details key={g} className="card p-3" open={groups.size === 1}>
                <summary className="cursor-pointer text-sm font-semibold">{g} <span className="font-normal text-slate-500">({list.length})</span></summary>
                <div className="mt-2">
                  {list.map((t) => <TermForm key={t.id} banks={bankOptions} bankId={current.id} term={{ id: t.id, bankId: current.id, term: t.term, meaning: t.meaning, groupName: t.groupName, tier: t.tier, similar: t.similar, status: t.status } satisfies TermRow} />)}
                </div>
              </details>
            ))}
            {rows.length === 0 && <p className="card p-4 text-sm text-slate-500">No terms in this bank yet. Add one above, or run <code>npm run import:terms</code> for the card files.</p>}
          </section>
        </>
      )}

      <section>
        <h2 className={h2}>Added by candidates ({own.length})</h2>
        {own.length === 0 ? <p className="card p-4 text-sm text-slate-500">Nothing yet. When a candidate adds a term of their own it appears here, still private to them, until you add it to a bank.</p> : (
          <div className="card divide-y divide-black/10">
            {own.map(({ t, who }) => (
              <div key={t.id} className="space-y-1 p-3">
                <p className="text-sm"><b>{t.term}</b> <span className="text-slate-500">· {RANKS[t.tier - 1]} · added by {who}</span></p>
                <p className="text-sm text-slate-600">{t.meaning}</p>
                <PromoteForm id={t.id} banks={bankOptions} bankId={current?.id ?? bankOptions[0]?.id ?? 0} groupName={t.groupName} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { BookOpen, Flag, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHero } from "@/components/charts";
import { TermPicker, type PickBank } from "@/components/TermPicker";
import { AddTermForm } from "@/components/AddTermForm";
import { RolePicker } from "@/components/RolePicker";
import { myStudyRoles, roleLabel, roleList, roleOptions, roleSummary } from "@/lib/termStudy";
import { termUrl } from "@/lib/termUrls";
import { allBanks, bankFitsRole, goalNeed, myTerms, recentChecks, sharedTerms, standingFor, termsAvailable, type BankStanding } from "@/lib/terms";
import { MIN_TIER_TESTED, RANKS, rankName } from "@/lib/termsCore";
import { removeOwnTermAction, removeStudyRoleAction } from "@/app/terms-actions";
import { TermNextStep } from "@/components/TermNextStep";
import { nextStep } from "@/lib/termJourney";

export const metadata = { title: "Terms — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Standing({ s, need }: { s: BankStanding; need: number | null }) {
  const reached = s.rank, there = need != null && reached >= need;
  return (
    <div className="card space-y-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{s.bank.name}</h3>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{s.asked === 0 ? "Not tested yet" : reached > 0 ? rankName(reached) : Object.values(s.stats).some((t) => t.tested >= MIN_TIER_TESTED) ? "Not yet at Initiate" : "Not enough tested yet"}</span>
      </div>
      <p className="text-xs text-slate-500">{s.known} known · {s.asked} asked · {s.total} in the bank</p>
      <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
        {RANKS.map((r, i) => {
          const t = s.stats[i + 1], pct = t ? Math.round((t.right / t.tested) * 100) : null;
          return (
            <div key={r} className="rounded border border-black/10 p-1" title={t ? `${t.right} of ${t.tested} right` : "Not asked yet"}>
              <div className="text-slate-500">{r}</div>
              <div className={`font-semibold ${pct == null ? "text-slate-300" : pct >= 80 ? "text-emerald-700" : "text-amber-700"}`}>{pct == null ? "–" : `${pct}%`}</div>
            </div>
          );
        })}
      </div>
      {need != null && (
        <p className={`flex items-center gap-1.5 text-xs ${there ? "text-emerald-700" : "text-slate-300"}`}>
          <Flag size={12} />Your goal needs <b>{rankName(need)}</b>: {!s.asked ? "not tested yet" : there ? "you are there" : `${need - reached} rank${need - reached === 1 ? "" : "s"} to go`}.
        </p>
      )}
    </div>
  );
}

export default async function Terms() {
  const user = await requireUser();
  if (!termsAvailable()) {
    return <div className="mx-auto max-w-2xl"><EmptyState Icon={BookOpen} tone="violet" title="Terms are not set up yet">The term bank is not available in this database yet.</EmptyState></div>;
  }
  const { banks, mine } = standingFor(user.id);
  const goal = goalNeed(user.id);
  const bankRows = allBanks();
  const relevant = new Set(bankRows.filter((b) => bankFitsRole(b.roles, user.jobRole) || (goal && bankFitsRole(b.roles, goal.role))).map((b) => b.id));
  const shared = sharedTerms(), own = myTerms(user.id);

  const order = [...bankRows].sort((a, b) => Number(relevant.has(b.id)) - Number(relevant.has(a.id)) || a.sortOrder - b.sortOrder);
  const pickBanks: PickBank[] = order.map((b, i) => {
    const groups = new Map<string, { id: number; term: string; tier: number }[]>();
    for (const t of shared.filter((t) => t.bankId === b.id)) groups.set(t.groupName || "Other", [...(groups.get(t.groupName || "Other") ?? []), { id: t.id, term: t.term, tier: t.tier }]);
    return { key: `b${b.id}`, name: b.name, groups: [...groups].map(([name, terms]) => ({ name, terms })), open: i === 0 };
  }).filter((b) => b.groups.length);
  if (own.length) pickBanks.unshift({ key: "mine", name: "My own terms", groups: [{ name: "Added by me", terms: own.map((t) => ({ id: t.id, term: t.term, tier: t.tier })) }], open: true });
  const checks = recentChecks(user.id);

  // learning a role: pick a role and level, and the list of terms for it is made; the roles already chosen show their progress
  const roles = roleOptions();
  const studying = myStudyRoles(user.id).map((r) => ({ r, list: roleList(r.role, r.level) })).filter((x) => x.list !== null)
    .map(({ r, list }) => ({ r, list: list!, sum: roleSummary(user.id, list!) }));
  const pickRoles = roles.map((o) => ({ role: o.role, label: roleLabel(o.role), hasTerms: o.hasTerms, levels: o.levels }));
  const startRole = goal && roles.some((o) => o.role === goal.role) ? goal.role : roles.some((o) => o.role === user.jobRole.toLowerCase()) ? user.jobRole.toLowerCase() : "";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHero Icon={BookOpen} tone="violet" title="Terms" sub="The words people in your kind of work need to know, at five ranks from Initiate to Titan. Choose a role to get its list, study the terms, then test yourself, or pick your own terms and see where you really stand." />

      <TermNextStep step={nextStep(user.id)} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Learn the terms for a role</h2>
        <p className="text-sm text-slate-300">Choose a role and the level you are aiming at. You get the list of terms you must know to do that job, to study and then be tested on.</p>
        <RolePicker roles={pickRoles} defaultRole={startRole} defaultLevel={goal?.role === startRole ? goal.level : 1} />
        {studying.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {studying.map(({ r, list, sum }) => (
              <div key={r.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{roleLabel(r.role)}</h3><span className="text-xs text-slate-500">{list.title}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${sum.total ? Math.round((sum.counts.known / sum.total) * 100) : 0}%` }} /></div>
                <p className="text-xs text-slate-300">{sum.counts.known} of {sum.total} known{sum.due ? ` · ${sum.due} due to see again` : ""}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={termUrl("study", r.role, r.level)} className="btn">Study</Link>
                  <Link href={termUrl("role", r.role, r.level)} className="underline">Open the list</Link>
                  <form action={removeStudyRoleAction} className="ml-auto"><input type="hidden" name="role" value={r.role} /><button className="text-xs text-rose-600 underline" aria-label={`Stop learning ${roleLabel(r.role)}`}>Remove</button></form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Where you stand</h2>
        {goal ? <p className="text-sm text-slate-300">Your goal is <b>{goal.title}</b>, which asks for <b>{rankName(goal.rank)}</b> terms. <Link href="/goal" className="underline">Change goal</Link></p>
          : <p className="text-sm text-slate-300">No career goal yet, so there is nothing to compare with. <Link href="/goal" className="underline">Set one</Link> to see how far you are from it.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {banks.filter((s) => relevant.has(s.bank.id!)).map((s) => <Standing key={s.bank.slug} s={s} need={goal ? goal.rank : null} />)}
          {own.length > 0 && <Standing s={mine} need={null} />}
        </div>
        {banks.some((s) => !relevant.has(s.bank.id!) && s.asked > 0) && (
          <details className="text-sm"><summary className="cursor-pointer font-semibold">Other banks you have been tested on</summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2">{banks.filter((s) => !relevant.has(s.bank.id!) && s.asked > 0).map((s) => <Standing key={s.bank.slug} s={s} need={null} />)}</div>
          </details>
        )}
        <p className="text-xs text-slate-500">A rank counts when you know at least 80% of the terms you have been asked at that rank (and every rank below it that you have been asked), with at least three asked. Your latest answer for each term is the one that counts.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Make a check</h2>
        {pickBanks.length ? <TermPicker banks={pickBanks} defaultClaim={Math.min(5, Math.max(1, goal?.rank ?? 2))} /> : <p className="card p-4 text-sm text-slate-500">There are no terms to pick yet.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add a term of your own</h2>
        <p className="text-sm text-slate-300">Add words from your own work. They are private to you and you can be tested on them. A super admin may add a good one to a shared bank.</p>
        <AddTermForm />
        {own.length > 0 && (
          <ul className="card divide-y divide-black/10 text-sm">
            {own.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 p-3">
                <b>{t.term}</b><span className="text-xs text-slate-500">{rankName(t.tier)}</span>
                <span className="min-w-0 flex-1 text-slate-300">{t.meaning}</span>
                <form action={removeOwnTermAction}><input type="hidden" name="id" value={t.id} /><button className="inline-flex items-center gap-1 text-xs text-rose-600 underline" aria-label={`Remove ${t.term}`}><Trash2 size={12} />Remove</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {checks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your checks</h2>
          <ul className="card divide-y divide-black/10 text-sm">
            {checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                <Link href={`/terms/check/${c.id}`} className="font-semibold underline">{date(c.startedAt)}</Link>
                <span className="text-slate-500">claimed {rankName(c.claimedTier)}</span>
                <span className="ml-auto">{c.finishedAt ? `${Math.round((c.score ?? 0) * 100)}%` : "not finished"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

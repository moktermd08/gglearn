import Link from "next/link";
import { BookOpen, Brain, CheckCircle2, ClipboardCheck, Clock, Flag, Gauge, History, Medal, PenLine, Plus, Sprout, Trash2, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHero, PALETTE, StackBar, StatTile } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { TermPicker, type PickBank } from "@/components/TermPicker";
import { AddTermForm } from "@/components/AddTermForm";
import { RolePicker } from "@/components/RolePicker";
import { Tabs, type Tab } from "@/components/Tabs";
import { Pips, RANK_COLOR, TopicIcon, topicHue } from "@/components/TermVisuals";
import { TermNextStep } from "@/components/TermNextStep";
import { myStudyRoles, roleLabel, roleList, roleOptions, roleSummary, studyTotals } from "@/lib/termStudy";
import { termUrl } from "@/lib/termUrls";
import { allBanks, bankFitsRole, goalNeed, myTerms, recentChecks, sharedTerms, standingFor, termsAvailable, type BankStanding } from "@/lib/terms";
import { MIN_TIER_TESTED, RANKS, TERM_PASS, rankName } from "@/lib/termsCore";
import { removeOwnTermAction, removeStudyRoleAction } from "@/app/terms-actions";
import { nextStep } from "@/lib/termJourney";

export const metadata = { title: "Terms — gglearn" };

const date = (sec: number) => new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const rankWords = (s: BankStanding) => (s.asked === 0 ? "Not tested yet" : s.rank > 0 ? rankName(s.rank) : Object.values(s.stats).some((t) => t.tested >= MIN_TIER_TESTED) ? "Not yet at Initiate" : "Not enough tested yet");

/** One set of terms: how much of it has been asked, the rank the answers support, and a column for each rank. */
function Standing({ s, need }: { s: BankStanding; need: number | null }) {
  const reached = s.rank, there = need != null && reached >= need, hue = topicHue(s.bank.name);
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#fff]" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}cc)` }} aria-hidden><TopicIcon group={s.bank.name} bank={s.bank.name} size={22} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{s.bank.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: reached ? RANK_COLOR[reached - 1] : undefined }}><Medal size={13} aria-hidden />{rankWords(s)}</p>
        </div>
        <span title={`${s.asked} of ${s.total} terms asked`}><Ring pct={s.total ? s.asked / s.total : 0} size={52} label={`${s.asked}`} color={hue} /><span className="sr-only">{s.asked} of {s.total} terms asked, {s.known} known</span></span>
      </div>
      <div className="flex items-end gap-1.5">
        {RANKS.map((r, i) => {
          const t = s.stats[i + 1], pct = t ? Math.round((t.right / t.tested) * 100) : null;
          return (
            <div key={r} className="min-w-0 flex-1 text-center" title={t ? `${t.right} of ${t.tested} right` : "Not asked yet"}>
              <div className={`text-[11px] font-bold ${pct == null ? "text-slate-400" : pct >= 80 ? "text-emerald-300" : "text-amber-300"}`}>{pct == null ? "–" : `${pct}%`}</div>
              <div className="mx-auto mt-1 flex h-16 w-full max-w-9 items-end overflow-hidden rounded-md bg-black/5" aria-hidden><div className="w-full" style={{ height: `${pct ?? 0}%`, background: (pct ?? 0) >= 80 ? "#059669" : "#d97706" }} /></div>
              <div className="mt-1 truncate text-[10px] text-slate-400">{r}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">{s.known} known · {s.asked} asked · {s.total} in the set</p>
      {need != null && (
        <p className={`flex items-center gap-1.5 text-xs ${there ? "text-emerald-300" : "text-slate-300"}`}>
          <Flag size={12} aria-hidden />Your goal needs <b>{rankName(need)}</b>: {!s.asked ? "not tested yet" : there ? "you are there" : `${need - reached} rank${need - reached === 1 ? "" : "s"} to go`}.
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
  if (own.length) pickBanks.push({ key: "mine", name: "My own terms", groups: [{ name: "Added by me", terms: own.map((t) => ({ id: t.id, term: t.term, tier: t.tier })) }], open: false });
  const checks = recentChecks(user.id);
  const finished = checks.filter((c) => c.finishedAt != null).reverse(); // oldest first, as a chart reads

  // learning a role: pick a role and level, and the list of terms for it is made; the roles already chosen show their progress
  const roles = roleOptions();
  const studying = myStudyRoles(user.id).map((r) => ({ r, list: roleList(r.role, r.level) })).filter((x) => x.list !== null)
    .map(({ r, list }) => ({ r, list: list!, sum: roleSummary(user.id, list!) }));
  const pickRoles = roles.map((o) => ({ role: o.role, label: roleLabel(o.role), hasTerms: o.hasTerms, levels: o.levels }));
  const startRole = goal && roles.some((o) => o.role === goal.role) ? goal.role : roles.some((o) => o.role === user.jobRole.toLowerCase()) ? user.jobRole.toLowerCase() : "";

  const totals = studyTotals(user.id);
  const last = finished[finished.length - 1];
  const mineShown = banks.filter((s) => relevant.has(s.bank.id!));
  const others = banks.filter((s) => !relevant.has(s.bank.id!) && s.asked > 0);

  const learning = (
    <>
      {studying.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {studying.map(({ r, list, sum }) => {
            const hue = topicHue(r.role), pct = sum.total ? Math.round((sum.counts.known / sum.total) * 100) : 0;
            const most = Math.max(1, ...Object.values(sum.byRank).map((b) => b.total));
            return (
              <li key={r.id} className="card flex flex-col gap-3 p-4" style={{ borderTop: `4px solid ${hue}` }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#fff]" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}cc)` }} aria-hidden><TopicIcon group={r.role} bank={list.banks[0]?.name ?? ""} size={22} /></span>
                  <div className="min-w-0 flex-1"><h3 className="font-bold leading-tight">{roleLabel(r.role)}</h3><p className="text-xs text-slate-400">{list.title} · {sum.total} terms</p></div>
                  <Ring pct={pct / 100} size={60} label={`${pct}%`} color={hue} />
                </div>
                <StackBar parts={[{ label: "Known", value: sum.counts.known, color: PALETTE.emerald }, { label: "Learning", value: sum.counts.learning, color: PALETTE.amber }, { label: "Not started", value: sum.counts.new, color: "#d6d3c9" }]} />
                <div className="flex items-end gap-1.5" role="img" aria-label={RANKS.slice(0, list.ceiling).map((name, i) => `${name}: ${sum.byRank[i + 1]?.known ?? 0} of ${sum.byRank[i + 1]?.total ?? 0} known`).join(", ")}>
                  {RANKS.map((name, i) => {
                    const b = sum.byRank[i + 1];
                    return (
                      <div key={name} className="min-w-0 flex-1 text-center" aria-hidden>
                        <div className="mx-auto flex h-14 w-full max-w-9 flex-col justify-end">
                          <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md" style={{ height: b ? `${(b.total / most) * 100}%` : "3px", background: "#ece9e0" }}><div style={{ height: b ? `${(b.known / b.total) * 100}%` : 0, background: RANK_COLOR[i] }} /></div>
                        </div>
                        <div className="mt-1 truncate text-[10px] text-slate-400">{name}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 text-sm">
                  <Link href={termUrl("study", r.role, r.level)} className="btn"><BookOpen size={15} aria-hidden />Study{sum.due ? ` (${sum.due} due)` : ""}</Link>
                  <Link href={termUrl("role", r.role, r.level)} className="btn btn-ghost">Explore the list</Link>
                  <form action={removeStudyRoleAction} className="ml-auto"><input type="hidden" name="role" value={r.role} /><button className="inline-flex items-center gap-1 text-xs text-rose-300 underline" aria-label={`Stop learning ${roleLabel(r.role)}`}><Trash2 size={12} aria-hidden />Remove</button></form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <div className="card flex flex-col items-center gap-2 p-6 text-center"><Sprout size={30} className="text-emerald-300" aria-hidden /><p className="font-bold">You are not learning a role yet</p><p className="text-sm text-slate-400">Choose one below to get its list of terms.</p></div>}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-bold"><Plus size={16} aria-hidden />Add a role to learn</h2>
        <RolePicker roles={pickRoles} defaultRole={startRole} defaultLevel={goal?.role === startRole ? goal.level : 1} />
      </section>
    </>
  );

  const standing = (
    <>
      <div className="card space-y-3 p-4">
        <h2 className="font-bold">How much of each set you have shown you know</h2>
        <ul className="space-y-2.5">
          {mineShown.map((x) => {
            const share = (n: number) => (x.total ? (n / x.total) * 100 : 0);
            return (
              <li key={x.bank.slug} className="grid items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[14rem_1fr_6rem]">
                <span className="font-semibold">{x.bank.name}</span>
                <span className="flex h-3.5 overflow-hidden rounded-full bg-black/5" role="img" aria-label={`${x.known} known, ${x.asked - x.known} missed, ${x.total - x.asked} not asked yet`}>
                  <i className="block h-full" style={{ width: `${share(x.known)}%`, background: PALETTE.emerald }} />
                  <i className="block h-full" style={{ width: `${share(x.asked - x.known)}%`, background: PALETTE.amber }} />
                </span>
                <span className="text-xs text-slate-400 sm:text-right">{x.known} of {x.total}</span>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE.emerald }} />Right when last asked</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE.amber }} />Missed when last asked</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-black/10" />Not asked yet</span></p>
        <div className="space-y-1 border-t border-black/10 pt-3 text-sm text-slate-300">
          {goal ? <p><Flag size={13} className="mr-1 inline" aria-hidden />Your goal is <b>{goal.title}</b>, which asks for <b>{rankName(goal.rank)}</b> terms. <Link href="/goal" className="underline">Change goal</Link></p>
            : <p>No career goal yet, so there is nothing to compare with. <Link href="/goal" className="underline">Set one</Link> to see how far you are from it.</p>}
          <p className="text-xs text-slate-400">A rank counts when you know at least {TERM_PASS * 100}% of the terms you have been asked at it, and at the ranks below that you have been asked. Your latest answer for each term is the one that counts.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {mineShown.map((s) => <Standing key={s.bank.slug} s={s} need={goal ? goal.rank : null} />)}
        {own.length > 0 && <Standing s={mine} need={null} />}
      </div>
      {others.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer font-semibold">Other sets you have been tested on ({others.length})</summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">{others.map((s) => <Standing key={s.bank.slug} s={s} need={null} />)}</div>
        </details>
      )}
    </>
  );

  const words = (
    <>
      <p className="text-sm text-slate-300">Add words from your own work. They are private to you and you can be tested on them. A super admin may add a good one to a shared bank.</p>
      <AddTermForm />
      {own.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {own.map((t) => (
            <li key={t.id} className="card flex flex-col gap-2 p-3 text-sm" style={{ borderTop: `4px solid ${RANK_COLOR[t.tier - 1]}` }}>
              <div className="flex items-center gap-2"><b className="min-w-0 flex-1 break-words">{t.term}</b><Pips tier={t.tier} /></div>
              <p className="text-slate-300">{t.meaning}</p>
              <form action={removeOwnTermAction} className="mt-auto"><input type="hidden" name="id" value={t.id} /><button className="inline-flex items-center gap-1 text-xs text-rose-300 underline" aria-label={`Remove ${t.term}`}><Trash2 size={12} aria-hidden />Remove</button></form>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const past = (
    <>
      {finished.length > 0 && (
        <figure className="card space-y-2 p-4">
          <figcaption className="font-bold">Your latest scores <span className="text-xs font-normal text-slate-400">oldest to newest · the line is the {TERM_PASS * 100}% pass mark · tap a bar to open it</span></figcaption>
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-emerald-400" style={{ top: `calc(1.25rem + ${(1 - TERM_PASS) * 8}rem)` }} aria-hidden />
            <ol className="flex items-end gap-2">
              {finished.map((c) => {
                const pct = Math.round((c.score ?? 0) * 100), passed = (c.score ?? 0) >= TERM_PASS;
                return (
                  <li key={c.id} className="min-w-0 flex-1">
                    <Link href={`/terms/check/${c.id}`} className="block text-center" aria-label={`${date(c.startedAt)}: ${pct}% at ${rankName(c.claimedTier)}${passed ? ", passed" : ""}`}>
                      <span className="block h-5 text-xs font-bold">{pct}%</span>
                      <span className="mx-auto flex h-32 w-full max-w-12 items-end"><span className="block w-full rounded-t-md" style={{ height: `${Math.max(3, pct)}%`, background: passed ? "#059669" : "#d97706" }} /></span>
                      <span className="mt-1 block truncate text-[10px] text-slate-400">{date(c.startedAt)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </figure>
      )}
      <ul className="card divide-y divide-black/10 text-sm">
        {checks.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
            {c.finishedAt ? ((c.score ?? 0) >= TERM_PASS ? <Trophy size={18} className="text-emerald-300" aria-hidden /> : <CheckCircle2 size={18} className="text-amber-300" aria-hidden />) : <Clock size={18} className="text-slate-400" aria-hidden />}
            <Link href={`/terms/check/${c.id}`} className="font-semibold underline">{date(c.startedAt)}</Link>
            <span className="inline-flex items-center gap-2 text-slate-400"><Pips tier={c.claimedTier} />{rankName(c.claimedTier)}</span>
            <span className="ml-auto font-bold">{c.finishedAt ? `${Math.round((c.score ?? 0) * 100)}%` : "not finished"}</span>
          </li>
        ))}
      </ul>
    </>
  );

  const tabs: Tab[] = [
    { id: "learn", label: "My learning", icon: <BookOpen size={15} />, count: studying.length || undefined, content: learning },
    { id: "stand", label: "Where I stand", icon: <Gauge size={15} />, content: standing },
    { id: "test", label: "Test myself", icon: <ClipboardCheck size={15} />, content: pickBanks.length ? <TermPicker banks={pickBanks} defaultClaim={Math.min(5, Math.max(1, goal?.rank ?? 2))} /> : <p className="card p-4 text-sm text-slate-400">There are no terms to pick yet.</p> },
    { id: "words", label: "My words", icon: <PenLine size={15} />, count: own.length || undefined, content: words },
    ...(checks.length ? [{ id: "history", label: "History", icon: <History size={15} />, content: past }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero Icon={BookOpen} tone="violet" title="Terms" sub="The words your work expects you to know, at five ranks from Initiate to Titan. Learn them, test yourself, and watch your rank climb." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile i={0} Icon={CheckCircle2} label="Terms known" value={totals.known} color={PALETTE.emerald} />
        <StatTile i={1} Icon={Brain} label="Learning" value={totals.learning} color={PALETTE.amber} />
        <StatTile i={2} Icon={Clock} label="Due to see again" value={totals.due} color={PALETTE.violet} />
        <StatTile i={3} Icon={Trophy} label="Latest score" value={last ? `${Math.round((last.score ?? 0) * 100)}%` : "–"} color={PALETTE.indigo} />
      </div>

      <TermNextStep step={nextStep(user.id)} />

      <Tabs items={tabs} label="Terms" />
    </div>
  );
}

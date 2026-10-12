import Link from "next/link";
import { ArrowRight, Award, Clock, Coins, Flame, Gift, Search, Swords, Target, Trophy, Users, X } from "lucide-react";
import { PageHero, PALETTE, StatTile } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import { SETS, campaignViews, type CampaignView, type RewardKind, type SetKey } from "@/lib/campaigns";

export const metadata = { title: "Campaigns — gglearn", description: "300 public campaigns: careers, general leagues and AI races. Everyone can join. Certificates by default, prizes for the best." };
export const dynamic = "force-dynamic";

const PAGE = 24;
const REWARDS: { key: RewardKind; label: string }[] = [{ key: "cash", label: "Cash prize" }, { key: "voucher", label: "Amazon voucher" }, { key: "certificate", label: "Certificate" }];
const LENGTHS = [{ key: "sprint", label: "Sprint · up to 7 days", ok: (d: number) => d <= 7 }, { key: "month", label: "Month · 8 to 31 days", ok: (d: number) => d > 7 && d <= 31 }, { key: "long", label: "Marathon · 32+ days", ok: (d: number) => d > 31 }];
const SET_TONE: Record<SetKey, string> = { career: "bg-violet-500/15 text-violet-300", general: "bg-sky-500/15 text-sky-300", ai: "bg-pink-500/15 text-pink-300" };
const REWARD_TONE: Record<RewardKind, string> = { cash: "bg-amber-400/20 text-amber-300", voucher: "bg-emerald-500/20 text-emerald-300", certificate: "bg-slate-500/20 text-slate-300" };

type Q = { set?: string; reward?: string; len?: string; q?: string; limit?: string };

function href(q: Q, patch: Partial<Q>) {
  const m = { ...q, ...patch, limit: undefined, ...("limit" in patch ? { limit: patch.limit } : {}) };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/campaigns?${s}` : "/campaigns";
}

const Chip = ({ to, on, children }: { to: string; on: boolean; children: React.ReactNode }) => (
  <Link href={to} scroll={false} aria-current={on ? "true" : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-pink-400 bg-pink-500/20 text-pink-300" : "border-slate-600/50 text-slate-300 hover:border-slate-400"}`}>{children}</Link>
);

function Card({ v, i }: { v: CampaignView; i: number }) {
  const set = v.kind as SetKey, live = v.state === "live", open = v.state !== "soon";
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-bold ${SET_TONE[set]}`}>{SETS[set]}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${REWARD_TONE[v.rewardKind]}`}>{v.rewardKind === "cash" ? <Coins size={11} /> : v.rewardKind === "voucher" ? <Gift size={11} /> : <Award size={11} />}{v.headline}</span>
        {live && <span className="ml-auto inline-flex items-center gap-1 font-bold text-emerald-300"><i className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />Live</span>}
        {v.state === "finished" && <span className="ml-auto font-bold text-slate-400">Finished</span>}
        {v.state === "soon" && <span className="ml-auto font-bold text-slate-400">Coming soon</span>}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <SubjectArt slug={v.track} name={v.trackName} kind={v.trackKind as never} size={44} />
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{v.title}</h3>
          <p className="mt-0.5 text-sm text-slate-300">{v.hook}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex min-w-0 items-center gap-1"><Target size={12} className="shrink-0 text-pink-300" /><span className="truncate">{v.trackName}</span></span>
        <span>Gain {v.goal} level{v.goal === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1"><Clock size={12} />{v.days} days</span>
        {open && <span className="inline-flex items-center gap-1"><Users size={12} />{v.humans} joined</span>}
      </div>
    </>
  );
  const cls = "card rise block min-w-0 p-4";
  const style = { "--i": Math.min(i, 8) } as React.CSSProperties;
  return open ? <Link href={`/competitions/${v.slug}`} className={`${cls} card-hover`} style={style}>{body}</Link> : <div className={`${cls} opacity-70`} style={style}>{body}</div>;
}

export default async function Campaigns({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const all = campaignViews();
  const needle = (q.q ?? "").trim().toLowerCase().slice(0, 60);
  const len = LENGTHS.find((l) => l.key === q.len);
  const set = q.set && q.set in SETS ? (q.set as SetKey) : undefined;
  const reward = REWARDS.find((r) => r.key === q.reward)?.key;
  const shown = all.filter((v) =>
    (!set || v.kind === set) && (!reward || v.rewardKind === reward) && (!len || len.ok(v.days)) &&
    (!needle || `${v.title} ${v.hook} ${v.trackName}`.toLowerCase().includes(needle)));
  const limit = Math.min(Math.max(Number(q.limit) || PAGE, PAGE), all.length);
  const flagships = all.filter((v) => v.reward.cash >= 10000);
  const filtered = !!(set || reward || len || needle);

  return (
    <div className="space-y-8">
      <PageHero Icon={Flame} tone="pink" title="Campaigns" sub="300 public campaigns for every career and every curiosity. Pick one, climb the leaderboard and earn a certificate. The best of each campaign also win prizes.">
        <Link href="#browse" className="btn"><Swords size={16} />Find my campaign</Link>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile i={0} Icon={Flame} label="Campaigns" value={all.length} color={PALETTE.pink} />
        <StatTile i={1} Icon={Trophy} label="Open to join" value={all.filter((v) => v.state === "live" || v.state === "upcoming").length} color={PALETTE.emerald} />
        <StatTile i={2} Icon={Gift} label="With a prize" value={all.filter((v) => v.rewardKind !== "certificate").length} color={PALETTE.amber} />
        <StatTile i={3} Icon={Users} label="People racing" value={all.reduce((s, v) => s + v.humans, 0)} color={PALETTE.sky} />
      </div>

      {flagships.length > 0 && (
        <section aria-label="Flagship campaigns">
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Trophy size={17} /></span>Flagship races <span className="text-sm font-normal text-slate-400">$100 prize pools</span></h2>
          <div className="grid gap-3 md:grid-cols-3">{flagships.map((v, i) => <Card key={v.id} v={v} i={i} />)}</div>
        </section>
      )}

      <section id="browse" className="scroll-mt-24 space-y-4" aria-label="Browse campaigns">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Campaign set">
          <Chip to={href(q, { set: undefined })} on={!set}>All {all.length}</Chip>
          {(Object.keys(SETS) as SetKey[]).map((k) => <Chip key={k} to={href(q, { set: k })} on={set === k}>{SETS[k]} {all.filter((v) => v.kind === k).length}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          {REWARDS.map((r) => <Chip key={r.key} to={href(q, { reward: reward === r.key ? undefined : r.key })} on={reward === r.key}>{r.label}</Chip>)}
          <span className="mx-1 hidden h-5 w-px bg-slate-600/50 sm:block" />
          {LENGTHS.map((l) => <Chip key={l.key} to={href(q, { len: len?.key === l.key ? undefined : l.key })} on={len?.key === l.key}>{l.label}</Chip>)}
        </div>
        <form action="/campaigns" className="flex gap-2" role="search">
          {set && <input type="hidden" name="set" value={set} />}{reward && <input type="hidden" name="reward" value={reward} />}{len && <input type="hidden" name="len" value={len.key} />}
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search campaigns</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={needle} maxLength={60} placeholder="Search by role, skill or tool, e.g. CTO, Python, Claude" className="w-full rounded-lg border border-white/15 bg-[#fff] py-2 pl-9 pr-3" /></label>
          <button className="btn" type="submit">Search</button>
          {filtered && <Link href="/campaigns#browse" className="btn-ghost inline-flex items-center gap-1 text-sm"><X size={14} />Clear</Link>}
        </form>

        <p className="text-sm text-slate-400" aria-live="polite">{shown.length} campaign{shown.length === 1 ? "" : "s"}{filtered ? " match" : ""}</p>
        {shown.length === 0
          ? <div className="card p-8 text-center text-slate-300">No campaign matches. Try fewer filters or a different word.</div>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.slice(0, limit).map((v, i) => <Card key={v.id} v={v} i={i} />)}</div>}
        {shown.length > limit && <div className="text-center"><Link scroll={false} href={href(q, { limit: String(limit + PAGE) })} className="btn">Show {Math.min(PAGE, shown.length - limit)} more</Link></div>}
      </section>

      <section aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
        {[{ Icon: Target, t: "Fair for everyone", d: "You race on levels you gain, not the level you started at. Beginners and experts compete on equal terms.", tone: "bg-pink-500/15 text-pink-300" },
          { Icon: Award, t: "Certificate by default", d: "Reach the goal and claim your certificate. First place is Champion. No fee, no catch.", tone: "bg-amber-500/15 text-amber-300" },
          { Icon: Gift, t: "Prizes for the best", d: "Selected campaigns add Amazon vouchers or a cash pool for the top places, paid by the organiser.", tone: "bg-emerald-500/15 text-emerald-300" }].map(({ Icon, t, d, tone }, i) => (
          <div key={t} className="card rise flex items-start gap-3 p-4" style={{ "--i": i } as React.CSSProperties}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
            <div><div className="text-sm font-bold">{t}</div><p className="mt-0.5 text-xs text-slate-400">{d}</p></div>
          </div>))}
      </section>
      <p className="text-center text-sm text-slate-400">Want your own race with friends or a team? <Link href="/competitions/new" className="inline-flex items-center gap-1 font-bold text-pink-300">Start a contest<ArrowRight size={14} /></Link></p>
    </div>
  );
}

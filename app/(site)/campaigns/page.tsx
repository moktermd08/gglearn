import Link from "next/link";
import { ArrowRight, Award, Briefcase, CalendarDays, Clock, Coins, Compass, Flame, Gift, Mountain, Search, Sparkles, Swords, Target, Trophy, Users, X, Zap, RefreshCw } from "lucide-react";
import { now, span } from "@/lib/competitions";
import { PageHero, PALETTE, StatTile } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import { currentUser } from "@/lib/auth";
import { isOwner } from "@/lib/contestAdmin";
import { SETS, campaignStatus, campaignViews, type CampaignView, type RewardKind, type SetKey } from "@/lib/campaigns";

export const metadata = { title: "Campaigns — gglearn", description: "300 public campaigns: careers, general leagues and AI races. Everyone can join. Certificates by default, prizes for the best." };
export const dynamic = "force-dynamic";

const PAGE = 24;
const REWARDS: { key: RewardKind; label: string }[] = [{ key: "cash", label: "Cash prize" }, { key: "voucher", label: "Amazon voucher" }, { key: "certificate", label: "Certificate" }];
const LENGTHS = [{ key: "sprint", label: "Sprint · up to 7 days", ok: (d: number) => d <= 7 }, { key: "month", label: "Month · 8 to 31 days", ok: (d: number) => d > 7 && d <= 31 }, { key: "long", label: "Marathon · 32+ days", ok: (d: number) => d > 31 }];
const SET_ICON = { career: Briefcase, general: Compass, ai: Sparkles } as const;
const SET_HUE: Record<SetKey, string> = { career: "#8b5cf6", general: "#0ea5e9", ai: "#ec4899" };
const LENGTH_ICON = { sprint: Zap, month: CalendarDays, long: Mountain } as const;
const REWARD_ICON = { cash: Coins, voucher: Gift, certificate: Award } as const;
const SET_TONE: Record<SetKey, string> = { career: "bg-violet-500/15 text-violet-300", general: "bg-sky-500/15 text-sky-300", ai: "bg-pink-500/15 text-pink-300" };
const REWARD_TONE: Record<RewardKind, string> = { cash: "bg-amber-400/20 text-amber-300", voucher: "bg-emerald-500/20 text-emerald-300", certificate: "bg-slate-500/20 text-slate-300" };

type Q = { set?: string; reward?: string; len?: string; rep?: string; q?: string; limit?: string };
const REPEATS = [{ key: "weekly", label: "Every week" }, { key: "monthly", label: "Every month" }] as const;

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
  const hue = SET_HUE[set], Rw = REWARD_ICON[v.rewardKind], SetIcon = SET_ICON[set];
  const t = now();
  const left = v.endsAt ? v.endsAt - t : 0;
  const elapsed = live && v.endsAt ? Math.min(1, Math.max(0, 1 - left / (v.days * 86400))) : v.state === "finished" ? 1 : 0;
  const body = (
    <>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${hue}, ${hue}66)` }} aria-hidden />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${SET_TONE[set]}`}><SetIcon size={11} />{SETS[set]}</span>
        {v.cadence !== "rolling" && <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 font-bold text-slate-300"><RefreshCw size={11} />{v.cadence === "weekly" ? "Weekly" : "Monthly"}</span>}
        {v.round && <span className="rounded-full bg-black/5 px-2 py-0.5 font-bold text-slate-400">{v.round}</span>}
        {live && <span className="ml-auto inline-flex items-center gap-1 font-bold text-emerald-300"><i className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />Live</span>}
        {v.state === "upcoming" && <span className="ml-auto font-bold text-sky-300">Starting soon</span>}
        {v.state === "finished" && <span className="ml-auto font-bold text-slate-400">Finished</span>}
        {v.state === "soon" && <span className="ml-auto font-bold text-slate-400">Coming soon</span>}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <SubjectArt slug={v.track} name={v.trackName} kind={v.trackKind as never} size={52} className="shadow-md" />
        <div className="min-w-0">
          <h3 className="font-bold leading-snug">{v.title}</h3>
          <p className="mt-0.5 text-sm text-slate-300">{v.hook}</p>
        </div>
      </div>
      <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold ${REWARD_TONE[v.rewardKind]}`}><Rw size={16} />{v.headline}{v.rewardKind !== "certificate" && <span className="ml-auto text-[11px] font-semibold">+ certificates</span>}</div>
      {live && v.endsAt && (
        <div className="mt-3" title={`${Math.round(elapsed * 100)}% of the time has passed`}>
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-400"><span>Ends in {span(left)}</span><span>{Math.round(elapsed * 100)}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full" style={{ width: `${elapsed * 100}%`, background: hue }} /></div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-300">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-black/5 px-2 py-0.5"><Target size={11} className="shrink-0 text-pink-300" /><span className="truncate">{v.trackName}</span></span>
        <span className="rounded-full bg-black/5 px-2 py-0.5">Gain {v.goal} level{v.goal === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5"><Clock size={11} />{v.days} days</span>
        {open && <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5"><Users size={11} />{v.humans} joined</span>}
      </div>
    </>
  );
  const cls = "card rise relative block min-w-0 overflow-hidden p-4 pt-5";
  const style = { "--i": Math.min(i, 8) } as React.CSSProperties;
  return open ? <Link href={`/competitions/${v.slug}`} className={`${cls} card-hover`} style={style}>{body}</Link> : <div className={`${cls} opacity-70`} style={style}>{body}</div>;
}

/** The big three at the top: the prize is the headline. */
function Flagship({ v, i }: { v: CampaignView; i: number }) {
  const set = v.kind as SetKey, hue = SET_HUE[set], live = v.state === "live";
  return (
    <Link href={`/competitions/${v.slug}`} className="card card-hover rise group relative block min-w-0 overflow-hidden p-5" style={{ "--i": i, background: `linear-gradient(140deg, ${hue}2e, #ffffff 65%)` } as React.CSSProperties}>
      <svg className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 transition group-hover:rotate-12" viewBox="0 0 200 200" aria-hidden><circle cx="120" cy="80" r="85" fill="none" stroke={hue} strokeOpacity=".2" /><circle cx="120" cy="80" r="52" fill="none" stroke={hue} strokeOpacity=".3" strokeDasharray="4 6" className="march" /></svg>
      <div className="relative flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-bold ${SET_TONE[set]}`}>{SETS[set]}</span>
        {live && <span className="ml-auto inline-flex items-center gap-1 font-bold text-emerald-300"><i className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />Live</span>}
      </div>
      <div className="relative mt-3 flex items-center gap-3">
        <SubjectArt slug={v.track} name={v.trackName} kind={v.trackKind as never} size={60} className="shadow-lg" />
        <div className="min-w-0"><h3 className="text-lg font-extrabold leading-tight">{v.title}</h3><p className="mt-0.5 text-sm text-slate-300">{v.hook}</p></div>
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div><div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300">Prize pool</div><div className="text-4xl font-black leading-none" style={{ color: "#b45309" }}>${v.reward.cash / 100}</div></div>
        <span className="mb-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-amber-950 shadow-lg"><Trophy size={24} /></span>
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-300">
        <span className="rounded-full bg-black/5 px-2 py-0.5">Gain {v.goal} level{v.goal === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5"><Clock size={11} />{v.days} days</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5"><Users size={11} />{v.humans} joined</span>
        <span className="ml-auto inline-flex items-center gap-1 font-bold" style={{ color: hue }}>Join the race<ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

export default async function Campaigns({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const all = campaignViews(), status = campaignStatus(), me = await currentUser(), admin = !!me && isOwner(me); // the setup notes below concern the whole site, so only the platform owner sees them
  const needle = (q.q ?? "").trim().toLowerCase().slice(0, 60);
  const len = LENGTHS.find((l) => l.key === q.len);
  const set = q.set && q.set in SETS ? (q.set as SetKey) : undefined;
  const reward = REWARDS.find((r) => r.key === q.reward)?.key;
  const rep = REPEATS.find((r) => r.key === q.rep)?.key;
  const shown = all.filter((v) =>
    (!set || v.kind === set) && (!reward || v.rewardKind === reward) && (!len || len.ok(v.days)) && (!rep || v.cadence === rep) &&
    (!needle || `${v.title} ${v.hook} ${v.trackName}`.toLowerCase().includes(needle)));
  const limit = Math.min(Math.max(Number(q.limit) || PAGE, PAGE), all.length);
  const flagships = all.filter((v) => v.reward.cash >= 10000);
  const filtered = !!(set || reward || len || rep || needle);
  const byTrack = new Map<string, { track: string; trackName: string; trackKind: string; n: number }>();
  for (const v of all) { const e = byTrack.get(v.track); if (e) e.n++; else byTrack.set(v.track, { track: v.track, trackName: v.trackName, trackKind: v.trackKind, n: 1 }); }
  const popular = [...byTrack.values()].sort((a, b) => b.n - a.n).slice(0, 12);

  return (
    <div className="space-y-8">
      <PageHero Icon={Flame} tone="pink" title="Campaigns" sub={`${all.length} public campaigns for every career and every curiosity. Pick one, climb the leaderboard and earn a certificate. The best of each campaign also win prizes.`}>
        <Link href="#browse" className="btn"><Swords size={16} />Find my campaign</Link>
      </PageHero>

      {admin && (status.noOrganiser || status.waiting.length > 0) && (
        <div role="note" className="card border border-amber-400/50 p-4 text-sm">
          {status.noOrganiser
            ? <><b>No contests can be created here yet.</b> This database has no active admin user to own them. Create an admin and reload.</>
            : <><b>{status.waiting.length} campaigns are hidden</b> because their subjects are not in this database yet. Run <code>deploy/seed-content.sh</code> on the server to load them.</>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile i={0} Icon={Flame} label="Campaigns" value={all.length} color={PALETTE.pink} />
        <StatTile i={1} Icon={Trophy} label="Open to join" value={all.filter((v) => v.state === "live" || v.state === "upcoming").length} color={PALETTE.emerald} />
        <StatTile i={2} Icon={Gift} label="With a prize" value={all.filter((v) => v.rewardKind !== "certificate").length} color={PALETTE.amber} />
        <StatTile i={3} Icon={Users} label="People racing" value={all.reduce((s, v) => s + v.humans, 0)} color={PALETTE.sky} />
      </div>

      {flagships.length > 0 && (
        <section aria-label="Flagship campaigns">
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Trophy size={17} /></span>Flagship races <span className="text-sm font-normal text-slate-400">$100 prize pools</span></h2>
          <div className="grid gap-3 md:grid-cols-3">{flagships.map((v, i) => <Flagship key={v.id} v={v} i={i} />)}</div>
        </section>
      )}

      {popular.length > 0 && (
        <section aria-label="Popular topics" className="space-y-3">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Flame size={17} /></span>Popular topics</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {popular.map((p) => (
              <Link key={p.track} href={href(q, { q: p.trackName })} scroll={false} className="card-hover group flex w-28 shrink-0 flex-col items-center gap-2 rounded-2xl border border-black/10 bg-[#fff] p-3 text-center">
                <SubjectArt slug={p.track} name={p.trackName} kind={p.trackKind as never} size={52} className="shadow-md transition group-hover:-translate-y-0.5" />
                <span className="line-clamp-2 text-xs font-semibold leading-tight">{p.trackName.replace(/: Novice to Titan$/, "")}</span>
                <span className="text-[10px] text-slate-400">{p.n} campaigns</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="browse" className="scroll-mt-24 space-y-4" aria-label="Browse campaigns">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Campaign set">
          <Chip to={href(q, { set: undefined })} on={!set}><Flame size={13} />All {all.length}</Chip>
          {(Object.keys(SETS) as SetKey[]).map((k) => { const I = SET_ICON[k]; return <Chip key={k} to={href(q, { set: k })} on={set === k}><I size={13} />{SETS[k]} {all.filter((v) => v.kind === k).length}</Chip>; })}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          {REWARDS.map((r) => { const I = REWARD_ICON[r.key]; return <Chip key={r.key} to={href(q, { reward: reward === r.key ? undefined : r.key })} on={reward === r.key}><I size={13} />{r.label}</Chip>; })}
          <span className="mx-1 hidden h-5 w-px bg-slate-600/50 sm:block" />
          {LENGTHS.map((l) => { const I = LENGTH_ICON[l.key as keyof typeof LENGTH_ICON]; return <Chip key={l.key} to={href(q, { len: len?.key === l.key ? undefined : l.key })} on={len?.key === l.key}><I size={13} />{l.label}</Chip>; })}
          <span className="mx-1 hidden h-5 w-px bg-slate-600/50 sm:block" />
          {REPEATS.map((r) => <Chip key={r.key} to={href(q, { rep: rep === r.key ? undefined : r.key })} on={rep === r.key}><RefreshCw size={13} />{r.label}</Chip>)}
        </div>
        <form action="/campaigns" className="flex gap-2" role="search">
          {set && <input type="hidden" name="set" value={set} />}{reward && <input type="hidden" name="reward" value={reward} />}{len && <input type="hidden" name="len" value={len.key} />}{rep && <input type="hidden" name="rep" value={rep} />}
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

      <section aria-label="How it works" className="space-y-3">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Swords size={17} /></span>How campaigns work</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[{ Icon: Target, t: "Fair for everyone", d: "You race on levels you gain, not the level you started at. Beginners and experts compete on equal terms.", hue: "#ec4899" },
            { Icon: Award, t: "Certificate by default", d: "Reach the goal and claim your certificate. First place is Champion. No fee, no catch.", hue: "#f59e0b" },
            { Icon: Gift, t: "Prizes for the best", d: "Selected campaigns add Amazon vouchers or a cash pool for the top places, paid by the organiser.", hue: "#10b981" }].map(({ Icon, t, d, hue }, i) => (
            <li key={t} className="card rise relative flex items-start gap-3 p-4" style={{ "--i": i } as React.CSSProperties}>
              {i < 2 && <span className="pointer-events-none absolute -right-3.5 top-9 z-10 hidden h-7 w-7 place-items-center rounded-full border border-black/10 bg-[#fff] text-slate-400 shadow-sm sm:grid" aria-hidden><ArrowRight size={14} /></span>}
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#fff] shadow" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}aa)` }}><Icon size={22} /></span>
              <div><div className="text-sm font-bold"><span className="mr-1 text-slate-400">{i + 1}.</span>{t}</div><p className="mt-0.5 text-xs text-slate-400">{d}</p></div>
            </li>))}
        </ol>
      </section>
      <p className="text-center text-sm text-slate-400">Want your own race with friends or a team? <Link href="/competitions/new" className="inline-flex items-center gap-1 font-bold text-pink-300">Start a contest<ArrowRight size={14} /></Link></p>
    </div>
  );
}

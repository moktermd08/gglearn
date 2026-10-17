import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowUp, Building2, CalendarDays, Clock, Crown, Flame, Info, Medal, Sparkles, Target, Trophy, UserRound, Users } from "lucide-react";
import { EmptyState, PageHero, PALETTE, StatTile } from "@/components/charts";
import { Competitor } from "@/components/Competitor";
import { requireUser } from "@/lib/auth";
import { MIN_MEMBERS, groupsOf, rankGroups, type GroupKind } from "@/lib/groups";
import { ShareButton } from "@/components/ShareButton";
import { db, enrollments, seasonResults, tracks, users } from "@/lib/db";
import { POINTS_PER_DAY, POINTS_PER_LEVEL, type Kind, type Period, type Row, closedPeriods, medalOf, periodAt, periodByKey, resultsFor, settleRecent, shortName, standings, timeLeft, winnersOf } from "@/lib/seasons";
import { arenaMap, arenaOf, arenaOfUser, type Arena } from "@/lib/arena";

export const metadata = { title: "Seasons — gglearn" };
export const dynamic = "force-dynamic";

type Q = { kind?: string; p?: string; track?: string; view?: string; g?: string };
const TOP = 25;
const now = () => Math.floor(Date.now() / 1000);

function href(q: Q, patch: Partial<Q>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...q, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/seasons?${s}` : "/seasons";
}
const Chip = ({ to, on, children }: { to: string; on: boolean; children: React.ReactNode }) => (
  <Link href={to} scroll={false} aria-current={on ? "true" : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-pink-400 bg-pink-500/20 text-pink-300" : "border-slate-600/50 text-slate-300 hover:border-slate-400"}`}>{children}</Link>
);

const PED = [
  { h: 92, grad: "linear-gradient(180deg,#fde68a,#f59e0b)", ring: "#f59e0b", ink: "#78350f" },
  { h: 68, grad: "linear-gradient(180deg,#e2e8f0,#94a3b8)", ring: "#94a3b8", ink: "#334155" },
  { h: 52, grad: "linear-gradient(180deg,#fed7aa,#ea8a3c)", ring: "#ea8a3c", ink: "#7c2d12" },
] as const;

/** Top three on pedestals, first in the middle; a season with two scorers shows two. */
function SeasonPodium({ rows, meId }: { rows: Row[]; meId: number }) {
  const order = [rows[1], rows[0], rows[2]].filter((r): r is Row => !!r);
  return (
    <section aria-label="Top three" className="card overflow-hidden px-4 pt-8" style={{ background: "linear-gradient(180deg, rgba(251,191,36,.10), transparent 70%)" }}>
      <div className="mx-auto grid max-w-lg items-end gap-2 sm:gap-5" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }} role="list">
        {order.map((r, col) => { const st = PED[Math.min(2, r.rank - 1)]; return (
          <div key={`place-${r.rank}`} role="listitem" className="rise flex min-w-0 flex-col items-center text-center" style={{ "--i": col } as React.CSSProperties}>
            <div className="relative">
              {r.rank === 1 && <Crown size={22} className="pulse-glow absolute -top-5 left-1/2 -translate-x-1/2 text-amber-400" fill="#fbbf24" aria-hidden />}
              <div className="rounded-full p-0.5" style={{ boxShadow: `0 0 0 3px ${st.ring}` }}><Competitor isBot={false} seed={`u${r.userId}`} name={shortName(r.name)} size={r.rank === 1 ? 56 : 46} /></div>
            </div>
            <div className="mt-2 w-full truncate px-1 text-sm font-bold">{shortName(r.name)}{r.userId === meId && <span className="ml-1 text-xs text-pink-300">you</span>}</div>
            <div className="mb-1.5 text-[11px] text-slate-400">{r.levels} level{r.levels === 1 ? "" : "s"} · {r.days} day{r.days === 1 ? "" : "s"}</div>
            <div className="grid w-full place-items-center rounded-t-2xl leading-none" style={{ height: st.h, background: st.grad, color: st.ink }}><span className="text-2xl font-black">{r.points}</span><span className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">points</span></div>
          </div>); })}
      </div>
    </section>
  );
}

/** One thin bar per row, scaled to the leader, so the gaps are visible at a glance. */
const Meter = ({ v, max, you }: { v: number; max: number; you?: boolean }) => (
  <span className="block h-1 overflow-hidden rounded-full bg-black/5"><i className="block h-full rounded-full" style={{ width: `${max ? Math.max(4, (v / max) * 100) : 0}%`, background: you ? "linear-gradient(90deg,#ec4899,#9333ea)" : "linear-gradient(90deg,#818cf8,#a78bfa)" }} /></span>
);

/** A finished season reads the stored final standings; a live one (or a subject-filtered one) is computed on read. */
function boardFor(p: Period, audience: "staff" | "customer", arena: Arena, trackId?: number): { rows: Row[]; final: boolean } {
  if (p.end <= now() && !trackId) {
    const arenas = arenaMap();
    const stored = db.select({ r: seasonResults, name: users.name }).from(seasonResults).innerJoin(users, eq(users.id, seasonResults.userId))
      .where(and(eq(seasonResults.kind, p.kind), eq(seasonResults.key, p.key), eq(users.audience, audience), eq(users.seasonBoard, "show"))).orderBy(asc(seasonResults.rank)).all()
      .filter(({ r }) => arenaOf(r.userId, arenas) === arena);
    if (stored.length) return { final: true, rows: stored.map(({ r, name }) => ({ userId: r.userId, name, points: r.points, levels: r.levels, days: r.days, lastAt: 0, rank: r.rank })) };
  }
  return { final: p.end <= now(), rows: standings(p, audience, trackId, arena) };
}

export default async function Seasons({ searchParams }: { searchParams: Promise<Q> }) {
  const me = await requireUser();
  settleRecent();
  const q = await searchParams;
  const kind: Kind = q.kind === "month" ? "month" : "week";
  const current = periodAt(kind), period = (q.p && periodByKey(kind, q.p)) || current;
  const mine = db.select({ t: tracks }).from(enrollments).innerJoin(tracks, eq(tracks.id, enrollments.trackId)).where(eq(enrollments.userId, me.id)).all().map((x) => x.t);
  const track = mine.find((t) => t.slug === q.track);
  const arena = arenaOfUser(me.id);
  const { rows, final } = boardFor(period, me.audience, arena, track?.id);
  const hidden = db.select({ s: users.seasonBoard }).from(users).where(eq(users.id, me.id)).get()?.s === "hide";
  const meRow = rows.find((r) => r.userId === me.id);
  const ahead = meRow ? rows[meRow.rank - 2] : rows[rows.length - 1];
  const past = closedPeriods(kind, kind === "week" ? 6 : 6);
  const top = rows.slice(0, TOP), podium = rows.slice(0, 3);
  const history = resultsFor(me.id, 8);
  const left = period.end - now();
  const elapsed = Math.min(1, Math.max(0, (now() - period.start) / (period.end - period.start)));
  const lead = rows[0]?.points ?? 0;
  const VIEWS = { teams: ["team", "Teams", Users], companies: ["company", "Companies", Building2], roles: ["role", "Roles", UserRound] } as const;
  const view = me.audience === "staff" && q.view && q.view in VIEWS ? (q.view as keyof typeof VIEWS) : undefined;
  const groupKind: GroupKind | null = view ? VIEWS[view][0] : null;
  const groups = groupKind ? groupsOf(groupKind, arena) : [];
  const ranked = groupKind ? rankGroups(groups, rows, me.id) : [];
  const topAvg = Math.max(0, ...ranked.map((g) => g.avg));
  const selected = groups.find((g) => g.key === q.g);
  const members = selected ? rows.filter((r) => selected.memberIds.includes(r.userId)).map((r, i) => ({ ...r, rank: i + 1 })) : [];
  const myGroups = ranked.filter((g) => g.mine);
  const base = { kind: kind === "week" ? undefined : kind, track: track?.slug, view } as Q;

  return (
    <div className="space-y-8">
      <PageHero Icon={CalendarDays} tone="violet" title="Seasons" sub="A fresh leaderboard every week and every month. Gain levels and show up on more days to climb. Finished seasons are final, and the best earn medals and badges.">
        <Link href="/campaigns" className="btn"><Trophy size={16} />Find a campaign</Link>
      </PageHero>

      <div className="card space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Season length">
          <span className="w-full shrink-0 text-[10px] sm:w-16 font-extrabold uppercase tracking-widest text-slate-400">Season</span>
          <Chip to={href({ track: q.track, view }, {})} on={kind === "week"}>Weekly</Chip>
          <Chip to={href({ track: q.track, view }, { kind: "month" })} on={kind === "month"}>Monthly</Chip>
          <span className="mx-1 hidden h-5 w-px bg-slate-600/50 sm:block" />
          <Chip to={href({ ...base }, { p: undefined })} on={period.key === current.key}>This {kind}</Chip>
          {past.map((p) => <Chip key={p.key} to={href({ ...base }, { p: p.key })} on={period.key === p.key}>{kind === "week" ? p.key.slice(5) : p.label.split(" ")[0].slice(0, 3)}</Chip>)}
        </div>
        {me.audience === "staff" && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Who to rank">
            <span className="w-full shrink-0 text-[10px] sm:w-16 font-extrabold uppercase tracking-widest text-slate-400">Rank</span>
            <Chip to={href({ ...base }, { view: undefined, g: undefined })} on={!view}><UserRound size={13} />People</Chip>
            {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((k) => { const Icon = VIEWS[k][2]; return <Chip key={k} to={href({ ...base }, { view: k, g: undefined })} on={view === k}><Icon size={13} />{VIEWS[k][1]}</Chip>; })}
          </div>
        )}
        {mine.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Subject">
            <span className="w-full shrink-0 text-[10px] sm:w-16 font-extrabold uppercase tracking-widest text-slate-400">Subject</span>
            <Chip to={href({ kind: q.kind, p: q.p, view }, { track: undefined })} on={!track}>All subjects</Chip>
            {mine.slice(0, 8).map((t) => <Chip key={t.id} to={href({ kind: q.kind, p: q.p, view }, { track: t.slug })} on={track?.id === t.id}>{t.name.replace(/:.*$/, "")}</Chip>)}
          </div>
        )}
      </div>

      <section className="card relative overflow-hidden p-5" aria-label="This season">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg,#ec4899,#9333ea,#4f46e5)" }} aria-hidden />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{kind === "week" ? "Weekly season" : "Monthly season"}{track ? ` · ${track.name}` : ""}</div>
            <h2 className="text-xl font-extrabold">{period.label}</h2>
          </div>
          <div className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${final ? "bg-slate-500/20 text-slate-300" : "bg-emerald-500/20 text-emerald-300"}`}>
            <Clock size={14} />{final ? "Final standings" : `Ends in ${timeLeft(left)}`}
          </div>
        </div>
        <div className="mt-3" role="img" aria-label={`${Math.round(elapsed * 100)}% of the season has passed`}>
          <div className="bar !h-1.5"><i style={{ width: `${Math.round(elapsed * 100)}%`, background: final ? "#94a3b8" : "linear-gradient(90deg,#ec4899,#9333ea)" }} /></div>
          <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>Start</span><span>{final ? "Finished" : `${Math.round(elapsed * 100)}% done`}</span><span>End</span></div>
        </div>
        {hidden ? (
          <p className="mt-3 text-sm text-slate-300">You are hidden from the boards. <Link href="/profile#season-board" className="font-bold text-pink-300">Show me again</Link> to compete.</p>
        ) : meRow ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile i={0} Icon={Crown} label="Your rank" value={`#${meRow.rank}`} color={PALETTE.amber} />
            <StatTile i={1} Icon={Trophy} label="Points" value={meRow.points} color={PALETTE.violet} />
            <StatTile i={2} Icon={Target} label="Levels gained" value={meRow.levels} color={PALETTE.pink} />
            <StatTile i={3} Icon={Flame} label="Active days" value={meRow.days} color="#ea580c" />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-pink-500/10 p-3 text-sm text-slate-300"><Sparkles size={18} className="shrink-0 text-pink-300" />{final ? "You did not score in this season." : <span>You have no points yet. <b>Pass a level above the one you hold</b> (+{POINTS_PER_LEVEL}) or <b>finish a quest or exam today</b> (+{POINTS_PER_DAY}) to get on the board.</span>}</div>
        )}
        {!final && !hidden && meRow && ahead && ahead.userId !== me.id && (
          <div className="mt-3 rounded-xl bg-indigo-500/10 p-3 text-sm text-slate-300">
            <div className="flex items-center gap-2"><ArrowUp size={16} className="shrink-0 text-indigo-300" /><span><b>{ahead.points - meRow.points + 1} points</b> to pass {shortName(ahead.name)} (#{ahead.rank}). One level is worth {POINTS_PER_LEVEL}.</span></div>
            <div className="bar mt-2 !h-1.5"><i style={{ width: `${Math.min(100, (meRow.points / Math.max(1, ahead.points)) * 100)}%` }} /></div>
          </div>)}
        {!final && !hidden && meRow?.rank === 1 && <p className="mt-3 text-sm font-bold text-amber-300">You are first. Keep going.</p>}
      </section>

      {groupKind && (
        <section aria-label={`${VIEWS[view!][1]} leaderboard`} className="space-y-4">
          {myGroups.length > 0 && !selected && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Yours">
              {myGroups.slice(0, 3).map((g) => (
                <Link key={g.key} href={href({ ...base }, { g: g.key })} className="card card-hover p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-pink-300">Yours</div>
                  <div className="truncate font-bold">{g.name}</div>
                  <div className="text-sm text-slate-400">{g.rank ? `#${g.rank} of ${ranked.filter((x) => x.rank).length}` : `Not ranked (needs ${MIN_MEMBERS}+ members and some points)`} · {g.avg} avg</div>
                </Link>))}
            </div>
          )}
          {selected ? (
            <div className="space-y-3">
              <Link href={href({ ...base }, { g: undefined })} className="text-sm font-bold text-sky-300">All {VIEWS[view!][1].toLowerCase()}</Link>
              <div className="card p-5"><h2 className="text-lg font-extrabold">{selected.name}</h2><p className="text-sm text-slate-400">{selected.sub} · {selected.memberIds.length} members · {members.length} scored this {kind}</p></div>
              {members.length === 0 ? <div className="card p-6 text-center text-slate-300">Nobody in this group has scored yet.</div> : (
                <ol className="card divide-y divide-black/5 overflow-hidden">{members.slice(0, TOP).map((r) => (
                  <li key={r.userId} className={`flex items-center gap-3 px-4 py-2.5 ${r.userId === me.id ? "bg-pink-500/10" : ""}`}>
                    <span className="w-8 shrink-0 text-center text-sm font-extrabold text-slate-400">{medalOf(r.rank) ?? r.rank}</span>
                    <Competitor isBot={false} seed={`u${r.userId}`} name={shortName(r.name)} size={32} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{shortName(r.name)}{r.userId === me.id && <span className="ml-1.5 text-xs font-bold text-pink-300">you</span>}</span><span className="mt-1 block"><Meter v={r.points} max={lead} you={r.userId === me.id} /></span></span>
                    <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{r.levels} lvl · {r.days} day{r.days === 1 ? "" : "s"}</span>
                    <span className="w-16 shrink-0 text-right text-sm font-extrabold">{r.points}</span>
                  </li>))}</ol>
              )}
            </div>
          ) : ranked.length === 0 ? (
            <div className="card p-8 text-center text-slate-300">{view === "roles" ? "No job roles are set yet." : `No ${VIEWS[view!][1].toLowerCase()} are set up yet. An admin assigns people to ${view === "companies" ? "a company" : "a brand or project"} on the People page.`}</div>
          ) : (
            <ol className="card divide-y divide-black/5 overflow-hidden">
              {ranked.map((g) => (
                <li key={g.key}><Link href={href({ ...base }, { g: g.key })} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-black/[.03] ${g.mine ? "bg-pink-500/10" : ""} ${g.rank ? "" : "opacity-60"}`}>
                  <span className="w-8 shrink-0 text-center text-sm font-extrabold text-slate-400">{g.rank ? medalOf(g.rank) ?? g.rank : "·"}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{g.name}{g.mine && <span className="ml-1.5 text-xs font-bold text-pink-300">your group</span>}</span><span className="block truncate text-xs text-slate-400">{g.sub} · {g.members} member{g.members === 1 ? "" : "s"} · {g.active} scored · {g.total} pts total</span><span className="mt-1.5 block"><Meter v={g.avg} max={topAvg} you={g.mine} /></span></span>
                  <span className="shrink-0 text-right"><span className="block text-sm font-extrabold">{g.avg}</span><span className="block text-[10px] uppercase tracking-wider text-slate-400">avg / member</span></span>
                </Link></li>))}
            </ol>
          )}
          <p className="text-xs text-slate-400">Groups are ranked by average points per member, so size does not decide it; members with no points count as zero. A group needs {MIN_MEMBERS}+ members to be ranked.{final && " Past seasons use today's group membership."}</p>
        </section>
      )}

      {!groupKind && (
        <>
      {podium.length > 0 && <SeasonPodium rows={podium} meId={me.id} />}

      <section aria-label="Leaderboard">
        <h2 className="mb-3 text-lg font-bold">Leaderboard <span className="text-sm font-normal text-slate-400">{rows.length} {rows.length === 1 ? "player" : "players"}</span></h2>
        {rows.length === 0 ? (
          <EmptyState Icon={Trophy} tone="violet" title={final ? "Nobody scored in this season" : "Nobody has scored yet"}>{final ? "Pick another season above to see the standings." : <>Be the first on the board: pass a new level for <b>+{POINTS_PER_LEVEL}</b> or finish an exam or daily quest for <b>+{POINTS_PER_DAY}</b>. <Link href="/dashboard" className="font-bold text-indigo-300 underline">Go to my quest</Link></>}</EmptyState>
        ) : (
          <ol className="card divide-y divide-black/5 overflow-hidden">
            {[...top, ...(meRow && meRow.rank > TOP ? [meRow] : [])].map((r) => (
              <li key={r.userId} className={`flex items-center gap-3 px-4 py-2.5 ${r.userId === me.id ? "bg-pink-500/10" : ""}`}>
                <span className="w-8 shrink-0 text-center text-sm font-extrabold text-slate-400">{medalOf(r.rank) ?? r.rank}</span>
                <Competitor isBot={false} seed={`u${r.userId}`} name={shortName(r.name)} size={32} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{shortName(r.name)}{r.userId === me.id && <span className="ml-1.5 text-xs font-bold text-pink-300">you</span>}</span><span className="mt-1 block"><Meter v={r.points} max={lead} you={r.userId === me.id} /></span></span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{r.levels} lvl · {r.days} day{r.days === 1 ? "" : "s"}</span>
                <span className="w-16 shrink-0 text-right text-sm font-extrabold">{r.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

        </>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-5" aria-label="How points work">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Info size={18} className="text-sky-300" />How points work</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-pink-500/10 p-3"><div className="text-2xl font-black text-pink-300">+{POINTS_PER_LEVEL}</div><div className="text-xs font-bold text-slate-300">per new level</div></div>
            <div className="rounded-xl bg-amber-500/10 p-3"><div className="text-2xl font-black text-amber-300">+{POINTS_PER_DAY}</div><div className="text-xs font-bold text-slate-300">per active day</div></div>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li><b>A new level</b> is a level passed this season that is above the level you already held in that subject. Re-passing a level you already had earns nothing, so beginners and experts compete fairly.</li>
            <li><b>An active day</b> is any day you finish an exam or a daily quest.</li>
            <li>Ties go to more levels gained, then to whoever got there first.</li>
            <li>Weeks run Monday to Sunday (UTC), months run from the 1st. You are ranked among {me.audience === "staff" ? "colleagues" : "customers"} only, shown as first name and initial.</li>
          </ul>
        </section>
        <section className="card p-5" aria-label="Your seasons">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Medal size={18} className="text-amber-300" />Your results</h2>
          {history.length === 0 ? <p className="text-sm text-slate-400">Finish a season with points to see your results here.</p> : (
            <ul className="space-y-1.5 text-sm">{history.map((h) => (
              <li key={`${h.kind}${h.key}`} className="flex items-center gap-2"><span className="w-7 text-center" aria-hidden>{medalOf(h.rank) ?? "·"}</span><span className="min-w-0 flex-1 truncate">{h.kind === "week" ? `Week ${h.key.slice(5)} ${h.key.slice(0, 4)}` : h.key}</span><span className="text-slate-400">#{h.rank} of {h.players}</span><span className="w-14 text-right font-bold">{h.points}</span><ShareButton kind="season" refKey={`${h.kind}:${h.key}`} label="Share" /></li>
            ))}</ul>
          )}
          {past[0] && (() => { const w = winnersOf(kind, past[0].key, me.audience, arena); return w.length > 0 ? <p className="mt-3 border-t border-black/5 pt-3 text-xs text-slate-400">Last {kind}&apos;s champion: <b>{shortName(w[0].name)}</b> with {w[0].points} points.</p> : null; })()}
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Ghost, Flame, Gauge, Hourglass, Medal, Rocket, Sparkles, Timer, TrendingUp, Trophy, Users, Zap, Flag, Crown, Check } from "lucide-react";
import { Competitor } from "@/components/Competitor";
import { LiveClock } from "@/components/LiveClock";
import { exact } from "@/lib/competitions-shared";
import type { Competition, Standing, State } from "@/lib/competitions";
import { type AttemptView, type Badge, type Board, type Entry, projection, raceBadges } from "@/lib/records";
import { abandonChallenge, startChallenge } from "../actions";

const TONE = {
  amber: "bg-amber-400/20 text-amber-300", violet: "bg-violet-500/20 text-violet-300", emerald: "bg-emerald-500/20 text-emerald-300",
  sky: "bg-sky-500/20 text-sky-300", pink: "bg-pink-500/20 text-pink-300", rose: "bg-rose-500/20 text-rose-300",
} as const;
const ICON: Record<string, typeof Trophy> = {
  record: Crown, podium: Medal, top10: TrendingUp, top25: TrendingUp, finisher: Flag, breaker: Rocket, improved: Sparkles, speed: Zap, flawless: Check, steady: Flame,
};

export function BadgeChip({ b, long = false }: { b: Badge; long?: boolean }) {
  const I = ICON[b.id] ?? Trophy;
  return <span title={b.blurb} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[b.tone]}`}><I size={11} />{b.label}{long && <span className="ml-1 font-medium normal-case tracking-normal opacity-80">{b.blurb}</span>}</span>;
}

const avatar = (e: Entry, size: number) => <Competitor isBot={false} seed={`u${e.userId}`} name={e.name} size={size} photoUrl={e.hasPhoto ? `/api/avatar/${e.userId}?v=${e.photoVersion}` : null} />;
const utc = (s: number) => `${new Date(s * 1000).toISOString().slice(0, 10)}`;

type Props = {
  c: Competition; state: State; board: Board; rows: Standing[]; t: number;
  userId: number | null; isMember: boolean; canChallengeNow: boolean; trackSlug: string;
  active: AttemptView | null; myAttempts: { status: string; durationSec: number | null; startedAt: number }[];
};

/** Everything about time: the time to beat, who finished how fast, the pool, your splits against the record, and the chance to come back and beat it. */
export function TimeBoard({ c, state, board, rows, t, userId, isMember, canChallengeNow, trackSlug, active, myAttempts }: Props) {
  const { entries } = board;
  const record = entries[0];
  const me = userId !== null ? board.byUser.get(userId) : undefined;
  const myRow = userId !== null ? rows.find((r) => r.userId === userId) : undefined;
  const proj = state === "live" && myRow ? projection(c, myRow, board, t) : null;
  const myBadges = userId !== null ? raceBadges(board, rows, userId) : [];
  const pool = board.participants, rate = pool ? Math.round((board.finishers / pool) * 100) : 0;
  const mySplits = active ? active.splits : me?.splits ?? [];
  const showSplits = !!record && (!!me || !!active) && record.userId !== userId;
  const nextAhead = me && me.rank > 1 ? entries[me.rank - 2] : null;
  const myBucket = me ? board.buckets.findIndex((b, i) => me.seconds >= b.from && (i === board.buckets.length - 1 || me.seconds < b.to)) : -1;
  const maxCount = Math.max(1, ...board.buckets.map((b) => b.count));

  return (
    <section aria-label="Time records" className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Timer size={20} className="text-sky-300" />Time to beat</h2>

      {/* the number everyone is chasing */}
      <div className="card overflow-hidden p-0" style={{ background: "linear-gradient(120deg, rgba(14,165,233,.14), #fff 65%)" }}>
        <div className="grid sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-1 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Record time to reach the goal</div>
            {record ? (
              <>
                <div className="flex items-center gap-3">{avatar(record, 44)}
                  <div><div className="text-3xl font-extrabold tabular-nums">{exact(record.seconds)}</div>
                    <div className="text-sm text-slate-300">{record.name}{record.source === "challenge" ? " · record attempt" : ""}</div></div></div>
              </>
            ) : (
              <p className="py-2 text-sm text-slate-300">{state === "live" ? "Nobody has reached the goal yet. The first finisher sets the time everyone else chases." : "Nobody reached the goal."}</p>
            )}
          </div>
          <Fact Icon={Users} label="Raced" value={pool} sub="people" />
          <Fact Icon={Flag} label="Finished" value={`${board.finishers}`} sub={pool ? `${rate}% of the pool` : ""} />
          <Fact Icon={Gauge} label="Typical time" value={board.median !== null ? exact(board.median) : "—"} sub={board.median !== null ? "median finish" : "no finishers yet"} />
        </div>
      </div>

      {/* where you stand */}
      {(me || proj || myBadges.length > 0) && (
        <div className="card space-y-2 border-sky-400/30 p-4">
          {me && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-lg font-extrabold">You: {exact(me.seconds)}</span>
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-sm font-bold text-sky-300">#{me.rank} of {entries.length}</span>
              {me.beaten !== null && <span className="text-sm font-semibold text-emerald-300">Faster than {me.beaten}% of the others</span>}
              {me.rank > 1 && record && <span className="text-sm text-slate-300">{exact(me.seconds - record.seconds)} off the record{nextAhead && nextAhead !== record ? `, ${exact(me.seconds - nextAhead.seconds)} behind #${me.rank - 1}` : ""}</span>}
              {me.rank === 1 && entries.length > 1 && <span className="text-sm text-amber-300">You hold the record. {exact(entries[1].seconds - me.seconds)} clear of #2.</span>}
            </div>
          )}
          {proj && (
            <p className="flex items-center gap-2 text-sm text-slate-300"><Hourglass size={15} className="shrink-0 text-amber-300" />
              At your pace so far you would reach the goal in about <b>{exact(proj.seconds)}</b>{proj.beats !== null ? <>, faster than <b>{proj.beats}%</b> of current finishers</> : null}. A straight-line estimate, not a promise.</p>
          )}
          {myBadges.length > 0 && <div className="flex flex-wrap gap-1.5">{myBadges.map((b) => <BadgeChip key={b.id} b={b} />)}</div>}
        </div>
      )}

      {/* ghost race against the record while an attempt is running */}
      {active && <GhostRace c={c} v={active} record={record} t={t} trackSlug={trackSlug} />}

      {/* Hall of Fame */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-bold"><Trophy size={17} className="text-amber-300" />Hall of Fame <span className="text-xs font-normal text-slate-400">fastest to the goal · best time per person</span></h3>
          <ol className="space-y-2">
            {entries.slice(0, 25).map((e, i) => (
              <li key={e.key} className={`card rise flex flex-wrap items-center gap-3 p-3 ${e.userId === userId ? "border-sky-400/50" : e.rank === 1 ? "border-amber-400/40" : ""}`} style={{ "--i": i } as React.CSSProperties}>
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black" style={e.rank <= 3 ? { background: ["#fde68a", "#e2e8f0", "#fdba74"][e.rank - 1], color: ["#92400e", "#475569", "#9a3412"][e.rank - 1] } : { color: "#6f7788" }}>{e.rank === 1 ? <Crown size={18} /> : e.rank}</div>
                {avatar(e, 40)}
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{e.name}{e.userId === userId && <span className="ml-1 text-xs text-sky-300">(you)</span>}</span>
                    {e.source === "challenge" && <span className="whitespace-nowrap rounded bg-rose-500/15 px-1.5 text-[10px] font-bold uppercase text-rose-300">Record attempt</span>}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{e.badges.filter((b) => b.id !== "finisher").map((b) => <BadgeChip key={b.id} b={b} />)}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-extrabold tabular-nums">{exact(e.seconds)}</div>
                  <div className="text-[11px] text-slate-400">{e.beaten !== null ? `beats ${e.beaten}%` : "first on the board"} · {utc(e.at)}</div>
                </div>
              </li>
            ))}
          </ol>
          {entries.length > 25 && <p className="text-xs text-slate-500">Showing the fastest 25 of {entries.length}.</p>}
        </div>
      )}

      {/* the pool of people */}
      {board.buckets.length > 0 && (
        <div className="card space-y-2 p-4">
          <h3 className="flex items-center gap-2 font-bold"><Users size={17} className="text-sky-300" />How the pool finished</h3>
          <div className="flex h-24 items-end gap-1" role="img" aria-label="Number of finishers in each time band">
            {board.buckets.map((b, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${exact(b.from)} to ${exact(b.to)}: ${b.count}`}>
                <div className="rounded-t" style={{ height: `${Math.max(b.count ? 8 : 2, (b.count / maxCount) * 100)}%`, background: i === myBucket ? "#0ea5e9" : "#cbd5e1", "--i": i } as React.CSSProperties} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-400"><span>fastest {exact(board.buckets[0].from)}</span>{myBucket >= 0 && <span className="font-semibold text-sky-300">you are in the blue band</span>}<span>slowest {exact(board.buckets[board.buckets.length - 1].to)}</span></div>
        </div>
      )}

      {showSplits && <Splits record={record} mine={mySplits} live={!!active} />}

      {board.levelRecords.length > 0 && (
        <details className="card p-4 text-sm" open={entries.length === 0}>
          <summary className="flex cursor-pointer items-center gap-2 font-bold"><Zap size={17} className="text-sky-300" />Fastest single exam per level</summary>
          <p className="mt-2 text-xs text-slate-400">Start to finish of one passing exam. Question draws differ between people, so treat close times as ties.</p>
          <ul className="mt-2 divide-y divide-white/10">
            {board.levelRecords.map(({ level, holder, runnersUp }) => (
              <li key={level} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>Level {level} <span className="text-slate-400">· {holder.name}{holder.userId === userId ? " (you)" : ""}</span></span>
                <span><b className="tabular-nums">{exact(holder.seconds)}</b> <span className="text-xs text-slate-400">{Math.round(holder.score * 100)}% · {runnersUp + 1} people</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Challenge c={c} state={state} canChallengeNow={canChallengeNow} signedIn={userId !== null} isMember={isMember} active={active} past={myAttempts} record={record} />
    </section>
  );
}

function Fact({ Icon, label, value, sub }: { Icon: typeof Users; label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="space-y-0.5 border-t border-black/5 p-4 sm:border-l sm:border-t-0">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><Icon size={13} />{label}</div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function Splits({ record, mine, live }: { record: Entry; mine: number[]; live: boolean }) {
  const n = Math.max(record.splits.length, mine.length);
  if (!n) return null;
  return (
    <div className="card space-y-2 p-4">
      <h3 className="flex items-center gap-2 font-bold"><Gauge size={17} className="text-pink-300" />Splits against the record <span className="text-xs font-normal text-slate-400">{record.name}&apos;s pace</span></h3>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400"><th className="py-1 font-semibold">Level gained</th><th className="font-semibold">Record</th><th className="font-semibold">{live ? "Your attempt" : "You"}</th><th className="text-right font-semibold">Difference</th></tr></thead>
        <tbody className="divide-y divide-white/10 tabular-nums">
          {Array.from({ length: n }, (_, k) => {
            const r = record.splits[k], m = mine[k], d = r !== undefined && m !== undefined ? m - r : null;
            return (
              <tr key={k}><td className="py-1.5">+{k + 1}</td><td>{r !== undefined ? exact(r) : "—"}</td><td>{m !== undefined ? exact(m) : "—"}</td>
                <td className={`text-right font-semibold ${d === null ? "text-slate-500" : d <= 0 ? "text-emerald-300" : "text-rose-300"}`}>{d === null ? "" : d === 0 ? "level" : `${d < 0 ? "-" : "+"}${exact(Math.abs(d))}`}</td></tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GhostRace({ c, v, record, t, trackSlug }: { c: Competition; v: AttemptView; record?: Entry; t: number; trackSlug: string }) {
  const elapsed = Math.max(0, t - v.attempt.startedAt);
  const ghostLevels = record ? record.splits.filter((s) => s <= elapsed).length : 0;
  const next = record?.splits[ghostLevels];
  const ahead = v.splits.length - ghostLevels;
  return (
    <div className="card space-y-3 border-rose-400/40 p-4" style={{ background: "linear-gradient(120deg, rgba(244,63,94,.1), #fff 70%)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><Ghost size={18} className="text-rose-300" />Your record attempt is running</h3>
        <span className="text-3xl font-extrabold text-rose-300"><LiveClock elapsed={elapsed} /></span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Lane label="You" done={v.splits.length} target={v.attempt.target} hue="#f43f5e" />
        {record && <Lane label={`${record.name} (record, ghost)`} done={ghostLevels} target={v.attempt.target} hue="#94a3b8" />}
      </div>
      <p className="text-sm text-slate-300">
        {record ? (ahead > 0 ? `You are ${ahead} level${ahead === 1 ? "" : "s"} ahead of the record pace.` : ahead < 0 ? `The record pace is ${-ahead} level${-ahead === 1 ? "" : "s"} ahead.` : "Level with the record pace.")
          : "Nobody holds a time yet, so any finish sets the record."}
        {record && next !== undefined ? ` The ghost reaches its next level at ${exact(next)}.` : ""}
        {" "}Pass level exams in <Link href={`/tracks/${trackSlug}`} className="underline">the topic</Link> to move. Time left: {exact(v.secondsLeft)}.
      </p>
      <form action={abandonChallenge.bind(null, c.id)}><button className="text-xs text-slate-400 underline">Stop this attempt</button></form>
    </div>
  );
}

function Lane({ label, done, target, hue }: { label: string; done: number; target: number; hue: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400"><span>{label}</span><span>+{done} of {target}</span></div>
      <div className="bar mt-1"><i style={{ width: `${Math.min(1, done / Math.max(1, target)) * 100}%`, background: hue }} /></div>
    </div>
  );
}

function Challenge({ c, state, canChallengeNow, signedIn, isMember, active, past, record }: {
  c: Competition; state: State; canChallengeNow: boolean; signedIn: boolean; isMember: boolean; active: AttemptView | null;
  past: { status: string; durationSec: number | null; startedAt: number }[]; record?: Entry;
}) {
  const done = past.filter((a) => a.status === "finished" && a.durationSec !== null);
  const bestMine = done.length ? Math.min(...done.map((a) => a.durationSec!)) : null;
  if (state === "live" || state === "upcoming") {
    return <p className="text-xs text-slate-500">When this contest ends, anyone who can see it can come back, start their own clock on the same goal, and try to beat the fastest time.</p>;
  }
  if (state !== "finished") return null;
  return (
    <div className="card space-y-3 border-rose-400/30 p-4">
      <h3 className="flex items-center gap-2 font-bold"><Rocket size={17} className="text-rose-300" />Come back and beat it</h3>
      <p className="text-sm text-slate-300">
        The race is over but the clock is not. Start your own attempt at the same goal (gain {c.goalLevels} level{c.goalLevels === 1 ? "" : "s"}) from wherever you are now,
        with the same exams and the same pass mark. Your time goes on the board above, next to the contest&apos;s.
        {record ? ` The time to beat is ${exact(record.seconds)}.` : " Nobody finished, so any finish sets the record."}
      </p>
      {bestMine !== null && <p className="text-sm text-emerald-300">Your best attempt: <b>{exact(bestMine)}</b> · {done.length} finished attempt{done.length === 1 ? "" : "s"}.</p>}
      {!signedIn ? (
        <p className="text-sm"><Link href="/login" className="underline">Sign in</Link> to start an attempt.</p>
      ) : active ? (
        <p className="text-sm text-slate-300">An attempt is already running, see above.</p>
      ) : !canChallengeNow ? (
        <p className="text-sm text-slate-400">You cannot start an attempt here. Either you are already at Titan in this topic or this topic is not open to you.</p>
      ) : (
        <form action={startChallenge.bind(null, c.id)} className="space-y-2 text-sm">
          {c.visibility === "public" && !isMember && (
            <label className="flex max-w-md items-start gap-2"><input type="checkbox" name="consent" required className="mt-1" />
              <span>I understand my name, photo (if I add one) and time will be visible to anyone.</span></label>
          )}
          {c.visibility === "public" && isMember && <input type="hidden" name="consent" value="on" />}
          <button className="btn">{done.length ? "Try again" : "Start my attempt"}<Timer size={16} /></button>
          <p className="text-xs text-slate-500">Levels you have already passed do not count again, so you gain {c.goalLevels} new level{c.goalLevels === 1 ? "" : "s"} from your current level. You have as long as the contest lasted.</p>
        </form>
      )}
    </div>
  );
}


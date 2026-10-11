import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Bot, CalendarClock, Check, Clock, Coins, Crown, Flag, Globe, GraduationCap, Lock, Radio, Swords, Target, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import { competitionCerts, competitionEmailInvites, competitionMembers, competitions, db, tracks, users } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { canView, finishersOf, modeLabel, now, payouts, span, standings, stateOf, type Standing } from "@/lib/competitions";
import { PRIZE_SPLIT_LABEL, money } from "@/lib/competitions-shared";
import { BOT_STYLES } from "@/lib/bots";
import { XP_PER_LEVEL } from "@/lib/levels";
import { cancelCompetition, claimCertificate, declineInvite, joinCompetition, leaveCompetition, makePrivate, markPrizePaid } from "../actions";
import { Competitor } from "@/components/Competitor";
import { AutoRefresh } from "@/components/AutoRefresh";
import InviteForm from "./invite-form";
import { PALETTE, StatTile } from "@/components/charts";
import { Podium } from "@/components/Podium";
import { Ring } from "@/components/Ring";
import { SubjectArt, artFor } from "@/components/SubjectArt";

const find = (slug: string) => db.select().from(competitions).where(eq(competitions.slug, slug)).get();
const utc = (s: number) => `${new Date(s * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = find((await params).slug);
  // never put a private title in the tab or in link previews
  return { title: c && c.visibility === "public" ? `${c.title} — gglearn` : "Contest — gglearn" };
}

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = find((await params).slug);
  const user = await currentUser();
  if (!c || !canView(c, user)) notFound();

  const track = db.select().from(tracks).where(eq(tracks.id, c.trackId)).get()!;
  const members = db.select().from(competitionMembers).where(eq(competitionMembers.competitionId, c.id)).all();
  const creator = db.select({ name: users.name }).from(users).where(eq(users.id, c.createdBy)).get();
  const t = now(), state = stateOf(c, t);
  const { rows, events } = standings(c, members, t);

  const mine = user ? members.find((m) => m.userId === user.id) : undefined;
  const isOrganiser = !!user && user.id === c.createdBy;
  // the organiser asked these people, so they may see who has not answered yet (everyone else only sees who joined)
  const invitedUsers = isOrganiser ? new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name])) : new Map<number, string>();
  const asked = isOrganiser ? members.filter((m) => m.kind === "human" && m.userId && m.userId !== c.createdBy && m.status !== "joined") : [];
  const waitingEmails = isOrganiser ? db.select({ e: competitionEmailInvites.email }).from(competitionEmailInvites).where(eq(competitionEmailInvites.competitionId, c.id)).all().map((r) => r.e) : [];
  const humans = rows.filter((r) => !r.isBot).length, bots = rows.filter((r) => r.isBot);
  const over = state === "finished" || state === "canceled";
  const full = humans >= c.maxHumans;
  const canJoin = !!user && !over && mine?.status !== "joined" && !full &&
    ((c.visibility === "public" && c.joinPolicy === "open") || mine?.status === "invited");
  const winners = rows.filter((r) => r.rank === 1 && (r.reachedAt !== null || (state === "finished" && r.gained > 0)));
  const reached = rows.filter((r) => r.reachedAt !== null);
  const consent = c.visibility === "public";
  const pay = payouts(c, rows), finishers = finishersOf(rows);
  const myCert = user ? db.select().from(competitionCerts).where(and(eq(competitionCerts.competitionId, c.id), eq(competitionCerts.userId, user.id))).get() : undefined;
  const canClaim = !!user && state === "finished" && !myCert && finishers.some((r) => r.userId === user.id);
  const accent = artFor(track.slug, track.name, track.kind).color;
  const elapsed = state === "finished" ? 1 : Math.min(1, Math.max(0, (t - c.startsAt) / Math.max(1, c.endsAt - c.startsAt)));
  const leader = finishers[0] ?? rows.find((r) => !r.isBot && r.gained > 0);

  return (
    <div className="space-y-6">
      {state === "live" && <AutoRefresh />}

      <header className="card pop relative space-y-2 overflow-hidden p-6" style={{ background: `linear-gradient(120deg, ${accent}26, #ffffff 60%)` }}>
        <div className="absolute right-4 top-4 flex items-center gap-4 sm:right-5 sm:top-5"><SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={56} className="shadow-lg" />{state !== "canceled" && <Ring pct={elapsed} label={`${Math.round(elapsed * 100)}%`} sub="of time" size={84} color={state === "finished" ? "#94a3b8" : "#10b981"} className="hidden sm:inline-grid" />}</div>
        <div className="flex flex-wrap items-center gap-2 pr-20 text-xs sm:pr-48">
          <span className={`rounded-full px-2 py-0.5 font-bold ${state === "live" ? "bg-emerald-500/20 text-emerald-300" : state === "upcoming" ? "bg-sky-500/20 text-sky-300" : state === "canceled" ? "bg-rose-500/20 text-rose-300" : "bg-slate-500/20 text-slate-300"}`}>
            {state === "live" ? <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />Live</span> : state === "upcoming" ? "Starts soon" : state === "canceled" ? "Canceled" : "Finished"}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">{c.visibility === "public" ? <><Globe size={13} />Public: anyone can watch</> : <><Lock size={13} />Private: only people in it can see this</>}</span>
          <span className="ml-auto font-semibold text-indigo-300">{modeLabel(humans, bots.length)}</span>
        </div>
        <h1 className="pr-20 text-3xl font-extrabold sm:pr-48">{c.title}</h1>
        {c.description && <p className="text-slate-300">{c.description}</p>}
        <p className="text-sm text-slate-300">
          Topic <Link href={`/tracks/${track.slug}`} className="underline">{track.name}</Link> · goal: gain <b>{c.goalLevels}</b> level{c.goalLevels === 1 ? "" : "s"} · organised by {creator?.name ?? "someone"}
        </p>
        {c.prizeAmount > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 px-3 py-2.5 text-sm" style={{ background: "linear-gradient(120deg, rgba(251,191,36,.22), rgba(251,191,36,.06))" }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-amber-950"><Coins size={20} /></span>
            <div><div className="text-base font-extrabold text-amber-300">{money(c.prizeAmount, c.prizeCurrency)} prize</div>
              <div className="text-xs text-slate-300">{PRIZE_SPLIT_LABEL[c.prizeSplit]} · people only, and only by reaching the goal.</div>
              <div className="text-[11px] text-slate-400">{c.prizeNote} · gglearn does not hold or send money.</div></div>
          </div>
        )}
        {(state === "live" || state === "upcoming") && (
          <div className="flex flex-wrap items-center gap-2" aria-label={state === "live" ? "Time left" : "Time until it starts"}>
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{state === "live" ? "Ends in" : "Starts in"}</span>
            {(() => { const left = Math.max(0, (state === "live" ? c.endsAt : c.startsAt) - t); return [["d", Math.floor(left / 86400)], ["h", Math.floor((left % 86400) / 3600)], ["m", Math.floor((left % 3600) / 60)]] as const; })().map(([u, v]) => (
              <span key={u} className="min-w-14 rounded-xl border border-black/10 bg-[#fff] px-2.5 py-1.5 text-center"><span className="text-xl font-extrabold tabular-nums">{String(v).padStart(2, "0")}</span><span className="ml-0.5 text-xs font-semibold text-slate-400">{u}</span></span>
            ))}
          </div>
        )}
        {(state === "live" || state === "finished") && (
          <div className="bar !h-2" title="Time elapsed"><i style={{ width: `${(state === "finished" ? 1 : Math.min(1, Math.max(0, (t - c.startsAt) / Math.max(1, c.endsAt - c.startsAt)))) * 100}%`, background: state === "finished" ? "#64748b" : undefined }} /></div>
        )}
        <p className="flex items-center gap-1.5 text-sm text-slate-400">
          <Clock size={14} className="shrink-0" />
          {state === "upcoming" && `Starts in ${span(c.startsAt - t)} (${utc(c.startsAt)})`}
          {state === "live" && `Ends in ${span(c.endsAt - t)} (${utc(c.endsAt)})`}
          {state === "finished" && `Ended ${utc(c.endsAt)}`}
          {state === "canceled" && "The organiser canceled this contest."}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile i={0} Icon={Users} label="People" value={humans} color={PALETTE.sky} />
        <StatTile i={1} Icon={Bot} label="Bots" value={bots.length} color={PALETTE.violet} />
        <StatTile i={2} Icon={Target} label="Goal (levels)" value={c.goalLevels} color={PALETTE.pink} />
        {state === "live" ? <StatTile i={3} Icon={CalendarClock} label="Left" value={span(c.endsAt - t)} color={PALETTE.emerald} />
          : state === "upcoming" ? <StatTile i={3} Icon={CalendarClock} label="Starts in" value={span(c.startsAt - t)} color={PALETTE.sky} />
          : <StatTile i={3} Icon={Flag} label="Reached goal" value={reached.length} color={PALETTE.amber} />}
      </div>

      {winners.length > 0 && (
        <div className="card pop border-amber-400/50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-amber-300"><Trophy className="pulse-glow" />{winners.map((w) => w.name).join(" & ")}</div>
          <div className="text-sm text-slate-300">
            {reached.length > 0
              ? `${winners[0].name} reached the goal first, at ${utc(winners[0].reachedAt!)}.`
              : `Led the contest with +${winners[0].gained} level${winners[0].gained === 1 ? "" : "s"}. Nobody reached the goal.`}
          </div>
        </div>
      )}

      {state === "finished" && (
        <section aria-label="Results" className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Crown size={20} className="text-amber-300" />Final results</h2>
          {finishers.length === 0 ? (
            <p className="text-slate-300">Nobody reached the goal{c.prizeAmount > 0 ? ", so the prize is not awarded" : ""}.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {finishers.map((r, i) => {
                const won = pay.find((x) => x.place === i + 1);
                return (
                  <li key={r.member.id} className="flex flex-wrap items-center gap-2">
                    <span className="grid w-6 place-items-center">{i < 3 ? <Trophy size={18} className={["text-yellow-300", "text-slate-300", "text-orange-400"][i]} /> : <span className="font-bold text-slate-400">{i + 1}</span>}</span>
                    <b>{r.name}</b> <span className="text-slate-400">goal reached {utc(r.reachedAt!)}</span>
                    {won && <span className="rounded bg-amber-400/20 px-2 font-bold text-amber-200">wins {money(won.amount, c.prizeCurrency)}</span>}
                  </li>
                );
              })}
            </ol>
          )}
          {c.prizeAmount > 0 && pay.length > 0 && (
            <div className="text-sm">
              {c.prizePaidAt
                ? <span className="text-emerald-300"><Check size={14} className="mr-1 inline" />The organiser marked the prize as paid on {utc(c.prizePaidAt)}.</span>
                : isOrganiser
                  ? <form action={markPrizePaid.bind(null, c.id)} className="flex flex-wrap items-center gap-3">
                      <span className="text-slate-300">Pay the winners yourself, then record it:</span><button className="btn !py-1">Mark prize as paid</button></form>
                  : <span className="text-slate-400">Awaiting payment by the organiser.</span>}
            </div>
          )}
          {myCert && <a href={`/cert/c/${myCert.code}`} className="btn"><GraduationCap size={16} />Your {myCert.kind === "champion" ? "Champion" : "Finisher"} certificate</a>}
          {canClaim && <form action={claimCertificate.bind(null, c.id)}><button className="btn"><GraduationCap size={16} />Claim my certificate</button></form>}
        </section>
      )}
      {state === "live" && c.prizeAmount > 0 && (
        <p className="text-center text-sm text-amber-200">{leader ? `${leader.name} is ahead. ` : ""}{money(c.prizeAmount, c.prizeCurrency)} goes to the first {c.prizeSplit === "top3" ? "three people" : "person"} to reach the goal.</p>
      )}

      <section aria-label="Leaderboard" className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Swords size={20} className="text-pink-300" />Leaderboard {state === "live" && <Radio size={14} className="animate-pulse text-emerald-400" />}</h2>
        {rows.length >= 2 && rows.some((r) => r.gained > 0) && (
          <div className="card px-4 pb-0 pt-8" style={{ background: "linear-gradient(180deg, rgba(251,191,36,.1), #fff 70%)" }}>
            <Podium places={rows.filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank).slice(0, 3).map((r) => ({
              rank: r.rank, name: r.name, gained: r.gained, target: r.target, xp: r.xp, reached: r.reachedAt !== null, isBot: r.isBot,
              avatar: <Competitor isBot={r.isBot} seed={r.isBot ? (r.member.botSeed ?? r.name) : `u${r.userId}`} name={r.name} size={56} photoUrl={r.hasPhoto ? `/api/avatar/${r.userId}?v=${r.photoVersion}` : null} />,
            }))} />
          </div>
        )}
        {rows.map((r, i) => <Lane key={r.member.id} r={r} goal={c.goalLevels} i={i} />)}
        {rows.length === 0 && <p className="text-slate-400">Nobody has joined yet.</p>}
        <p className="text-xs text-slate-500">
          Ranked by who reaches the goal first, then levels gained, then XP. People: levels newly passed in this topic since they started, from real exams.
          Bots: a fixed simulated schedule. Practice XP counts by UTC day.
        </p>
      </section>

      <section className="flex flex-wrap items-start gap-4">
        {!user && c.visibility === "public" && !over && <p className="card p-4 text-sm"><Link href="/login" className="underline">Sign in</Link> to join this contest.</p>}

        {mine?.status === "joined" && !over && (
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <Link href={`/tracks/${track.slug}`} className="btn">Train now<Swords size={16} /></Link>
            {!isOrganiser && <form action={leaveCompetition.bind(null, c.id)}><button className="text-sm text-slate-400 underline">Leave</button></form>}
          </div>
        )}

        {canJoin && (
          <form action={joinCompetition.bind(null, c.id)} className="card space-y-2 p-4 text-sm">
            <div className="font-semibold">{mine?.status === "invited" ? "You were invited to this contest" : "Join this contest"}</div>
            {consent && (
              <label className="flex max-w-md items-start gap-2"><input type="checkbox" name="consent" required className="mt-1" />
                <span>I understand my name, photo (if I add one) and progress will be visible to anyone.</span></label>
            )}
            <div className="flex items-center gap-3">
              <button className="btn">{mine?.status === "invited" ? "Accept" : "Join"}<Swords size={16} /></button>
            </div>
          </form>
        )}
        {mine?.status === "invited" && !over && (
          <form action={declineInvite.bind(null, c.id)} className="self-center"><button className="text-sm text-slate-400 underline">Decline</button></form>
        )}
        {user && !over && full && mine?.status !== "joined" && <p className="card p-4 text-sm text-slate-300">This contest is full.</p>}
      </section>

      {bots.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-semibold">About the bots ({bots.length}): simulated, not real learners</summary>
          <ul className="mt-3 space-y-2 text-slate-300">
            {bots.map((b) => (
              <li key={b.member.id}><b>{b.name}</b> ({BOT_STYLES[b.botStyle!].label}, {b.member.botPace} XP/day): {BOT_STYLES[b.botStyle!].blurb} {b.tagline && `It ${b.tagline}.`}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">150 XP equals one level, the same scale people use. Bots never answer questions. Their schedule is fixed when the contest is created, so results can be checked and never change.</p>
        </details>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Activity</h2>
          <ul className="card divide-y divide-white/10 text-sm">
            {events.map((e, i) => (
              <li key={i} className="rise flex justify-between gap-3 px-4 py-2" style={{ "--i": i } as React.CSSProperties}><span className="flex items-center gap-2">{e.bot ? <Bot size={15} className="shrink-0 text-violet-300" /> : <GraduationCap size={15} className="shrink-0 text-sky-300" />}{e.text}</span><span className="shrink-0 text-slate-400">{span(t - e.at)} ago</span></li>
            ))}
          </ul>
        </section>
      )}

      {isOrganiser && !over && (
        <section className="card space-y-4 p-4">
          <h2 className="font-bold">Organiser tools</h2>
          {(asked.length > 0 || waitingEmails.length > 0) && (
            <div className="text-sm">
              <h3 className="mb-1 font-semibold">Invited, not in the race yet</h3>
              <ul className="space-y-0.5 text-slate-300">
                {asked.map((m) => <li key={m.id}>{invitedUsers.get(m.userId!) ?? "Someone"} <span className="text-xs text-slate-500">{m.status === "invited" ? "has not answered" : m.status}</span></li>)}
                {waitingEmails.map((e) => <li key={e}>{e} <span className="text-xs text-slate-500">no account yet; invited when one is created</span></li>)}
              </ul>
            </div>
          )}
          <InviteForm competitionId={c.id} />
          <div className="flex flex-wrap gap-4 text-sm">
            {c.visibility === "public" && <form action={makePrivate.bind(null, c.id)}><button className="underline">Make private</button></form>}
            <form action={cancelCompetition.bind(null, c.id)}><button className="text-rose-400 underline">Cancel contest</button></form>
          </div>
        </section>
      )}
      {user?.role === "admin" && !isOrganiser && !over && (
        <form action={cancelCompetition.bind(null, c.id)}><button className="text-sm text-rose-400 underline">Cancel contest (admin)</button></form>
      )}

      <LearningNotes />
    </div>
  );
}

function Lane({ r, goal, i }: { r: Standing; goal: number; i: number }) {
  // bots earn XP continuously, so their bar fills smoothly; people advance one passed level at a time
  const pct = r.target > 0 ? Math.min(1, (r.isBot ? r.xp / XP_PER_LEVEL : r.gained) / r.target) : 0;
  const hue = (r.userId ?? 0) * 47 % 360;
  return (
    <div className={`card rise flex items-center gap-4 p-3 ${r.rank === 1 && r.gained > 0 ? "border-amber-400/40" : ""}`} style={{ "--i": i } as React.CSSProperties}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black" style={r.rank <= 3 && r.gained > 0 ? { background: ["#fde68a", "#e2e8f0", "#fdba74"][r.rank - 1], color: ["#92400e", "#475569", "#9a3412"][r.rank - 1] } : { color: "#6f7788" }}>{r.rank === 1 && r.gained > 0 ? <Crown size={18} /> : r.rank}</div>
      <Competitor isBot={r.isBot} seed={r.isBot ? (r.member.botSeed ?? r.name) : `u${r.userId}`} name={r.name} size={52}
        photoUrl={r.hasPhoto ? `/api/avatar/${r.userId}?v=${r.photoVersion}` : null} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{r.name}</span>
          {r.isBot
            ? <span className="rounded bg-violet-500/20 px-1.5 text-[10px] font-bold uppercase text-violet-300">Bot · simulated · {BOT_STYLES[r.botStyle!].label}</span>
            : <span className="rounded bg-sky-500/20 px-1.5 text-[10px] font-bold uppercase text-sky-300">Person</span>}
          {r.reachedAt !== null && <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] font-bold uppercase text-emerald-300"><span className="inline-flex items-center gap-0.5">Goal reached <Flag size={10} /></span></span>}
        </div>
        <div className="bar relative mt-1.5 !overflow-visible"><Flag size={13} className="absolute -right-1 -top-3.5 text-slate-400" aria-hidden /><i className="grow" style={{ width: `${pct * 100}%`, ...(r.isBot ? { background: `linear-gradient(90deg,#a78bfa,#f472b6)` } : { background: `linear-gradient(90deg,hsl(${hue} 80% 60%),#38bdf8)` }) }} /></div>
        <div className="mt-1 flex flex-wrap justify-between gap-x-4 text-xs text-slate-400">
          <span>{r.startLevel !== null && `L${r.startLevel} → L${r.startLevel + r.target} · `}+{r.gained} of {r.target === goal ? goal : `${r.target} (max reachable)`} level{r.target === 1 ? "" : "s"}</span>
          <span>
            {r.xp} XP
            {!r.isBot && ` · ${r.practiceDays} practice day${r.practiceDays === 1 ? "" : "s"}`}
            {r.accuracy !== null && ` · avg ${Math.round(r.accuracy * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

function LearningNotes() {
  return (
    <details className="card p-4 text-sm text-slate-300">
      <summary className="cursor-pointer font-semibold text-white">Why this format helps you learn</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li><b>Being tested beats re-reading.</b> Exams and drills make you recall answers from memory, which strengthens retention more than studying the same material again (Roediger &amp; Karpicke, 2006; Dunlosky et al., 2013).</li>
        <li><b>Spread it out.</b> Short sessions across many days are retained better than one long cram (Cepeda et al., 2006). That is why we show practice days, and why a long contest beats a short one.</li>
        <li><b>Feedback and stretch.</b> Each level is a little harder than the last and every answer is reviewed, the core of deliberate practice (Ericsson et al., 1993).</li>
        <li><b>Competition is a tool, not a cure.</b> Rivals raise effort for many people but can discourage others. Pick a bot or group at a pace that stretches you without crushing you, or make it private with friends.</li>
        <li><b>Soft skills</b> are practised through written scenario questions marked against a rubric. That tests judgement and knowledge, not live behaviour, so pair it with real practice.</li>
      </ul>
    </details>
  );
}

"use client";
import { startTransition, useActionState, useMemo, useState, type ReactNode } from "react";
import { Award, Bot, CalendarClock, Check, Coins, Eye, Flag, Globe, Lock, Minus, Plus, Shuffle, Swords, Target, Timer, Trophy, TriangleAlert, Users } from "lucide-react";
import { createCompetition, type CreateState } from "../actions";
import { BOT_TIERS } from "@/lib/bots";
import { CURRENCIES, PRIZE_SPLIT_LABEL } from "@/lib/competitions-shared";

type Topic = { id: number; name: string; guest: boolean; kind: string; art: ReactNode };
type Group = [string, Topic[]];

const DAYS = [3, 7, 14, 30, 60, 90];
const GOALS = [1, 2, 3, 5, 10];
const STARTS = [[0, "Right now"], [1, "In 1 day"], [3, "In 3 days"], [7, "In 1 week"]] as const;
const BOT_LOOK = { casual: "bg-sky-500/15 text-sky-300", steady: "bg-violet-500/15 text-violet-300", fierce: "bg-rose-500/15 text-rose-300" } as const;

export default function NewCompetitionForm({ groups, popular = [] }: { groups: Group[]; popular?: { id: number; name: string }[] }) {
  const [state, run, pending] = useActionState<CreateState, FormData>(createCompetition, null);
  const [title, setTitle] = useState(""), [trackId, setTrackId] = useState(""), [find, setFind] = useState("");
  // typing narrows the list; the chosen topic always stays in it
  const shown = useMemo(() => { const q = find.trim().toLowerCase(); return q ? groups.map(([g, items]) => [g, items.filter((t) => String(t.id) === trackId || t.name.toLowerCase().includes(q))] as Group).filter(([, items]) => items.length) : groups; }, [groups, find, trackId]);
  const [goal, setGoal] = useState(3), [days, setDays] = useState(14), [start, setStart] = useState(0);
  const [bots, setBots] = useState<Record<string, number>>({ casual: 0, steady: 1, fierce: 0 });
  const [visibility, setVisibility] = useState("private"), [prize, setPrize] = useState(false), [amount, setAmount] = useState("");
  const topic = useMemo(() => groups.flatMap(([, items]) => items).find((t) => String(t.id) === trackId), [groups, trackId]);
  const botTotal = Object.values(bots).reduce((a, b) => a + b, 0);
  const perDay = goal / days, intensity = perDay < 0.15 ? { l: "Gentle", c: "#10b981" } : perDay < 0.4 ? { l: "Steady", c: "#f59e0b" } : { l: "Intense", c: "#f43f5e" };
  const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";
  const label = "block text-sm font-semibold";
  const section = "card space-y-4 p-5";
  const head = (Icon: typeof Target, tone: string, n: number, text: string) => (
    <h2 className="flex items-center gap-3 text-lg font-bold"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={18} /></span><span><span className="mr-1 text-slate-400">{n}.</span>{text}</span></h2>
  );
  const chip = (on: boolean) => `cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300 ${on ? "border-indigo-400 bg-indigo-500 text-[#fff]" : "border-black/10 bg-[#fff] text-slate-300 hover:border-indigo-300"}`;
  const ready = !!trackId;

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-5">
        <section className={section}>
          {head(Target, "bg-pink-500/15 text-pink-300", 1, "Topic and goal")}
          <div><label className={label} htmlFor="title">Name it <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="title" name="title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={topic ? `${topic.name} sprint` : "We will name it after the topic"} className={`${input} mt-1`} /></div>
          <div><label className={label} htmlFor="trackId">Topic</label>
            {popular.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Popular topics">{popular.map((t) => <button type="button" key={t.id} aria-pressed={String(t.id) === trackId} onClick={() => { setTrackId(String(t.id)); setFind(""); }} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${String(t.id) === trackId ? "border-indigo-400 bg-indigo-500 text-[#fff]" : "border-black/10 bg-[#fff] text-slate-300 hover:border-indigo-300"}`}>{t.name}</button>)}</div>}
            <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search topics: git, python, sales…" aria-label="Search topics" className={`${input} mt-1`} />
            <select id="trackId" name="trackId" required value={trackId} onChange={(e) => setTrackId(e.target.value)} className={`${input} mt-1`}>
              <option value="" disabled>Choose a topic…</option>
              {shown.map(([g, items]) => <optgroup key={g} label={g}>{items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
            </select></div>

          <fieldset><legend className={label}>Goal: levels to gain</legend>
            <input type="hidden" name="goalLevels" value={goal} />
            <div className="mt-1.5 flex flex-wrap gap-2">{GOALS.map((g) => <button type="button" key={g} aria-pressed={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>{g} level{g === 1 ? "" : "s"}</button>)}</div>
            {!GOALS.includes(goal) && <p className="mt-1 text-xs text-slate-400">A custom goal of {goal} levels, set under More options.</p>}
          </fieldset>
          <fieldset><legend className={label}>Length</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">{DAYS.map((d) => <label key={d} className={chip(days === d)}><input type="radio" name="days" value={d} checked={days === d} onChange={() => setDays(d)} className="sr-only" />{d} days</label>)}</div></fieldset>
        </section>


        <details className="card group">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5 font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-500/15 text-slate-500"><Plus size={18} className="transition group-open:rotate-45" /></span>
            <span>More options<span className="block text-xs font-normal text-slate-400">Simulated rivals, who can watch, prizes, start time, a description, a custom goal and the Architect twist. The defaults are fine.</span></span>
          </summary>
          <div className="space-y-5 border-t border-black/5 p-5">
            <section className="space-y-4">
              <h2 className="font-bold">Timing and details</h2>
                        <div>
            <label className={label} htmlFor="goalLevels">Goal: levels to gain <b className="ml-1 rounded-full bg-indigo-500/12 px-2 py-0.5 text-indigo-300">{goal}</b></label>
            <input id="goalLevels" type="range" min={1} max={20} value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="mt-2 w-full" />
            <div className="flex justify-between text-[10px] text-slate-400"><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span></div>
          </div>
          <fieldset><legend className={label}>Starts</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">{STARTS.map(([v, t]) => <label key={v} className={chip(start === v)}><input type="radio" name="startInDays" value={v} checked={start === v} onChange={() => setStart(v)} className="sr-only" />{t}</label>)}</div></fieldset>

          <div className="rounded-2xl p-3.5" style={{ background: `${intensity.c}14` }} aria-hidden>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold"><span className="flex items-center gap-1.5"><Timer size={15} style={{ color: intensity.c }} />{perDay.toFixed(2)} levels a day</span><span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#fff]" style={{ background: intensity.c }}>{intensity.l} pace</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full transition-all" style={{ width: `${Math.min(100, perDay * 100)}%`, background: intensity.c }} /></div>
          </div>
          <p className="text-xs text-slate-400">Progress is measured as levels <i>newly passed</i> after you start, so beginners and experts can race fairly. Spreading practice over several days beats cramming, so a longer contest usually teaches more.</p>
          <div><label className={label} htmlFor="description">Description (optional)</label>
            <textarea id="description" name="description" maxLength={500} rows={2} className={`${input} mt-1`} /></div>

            </section>
        <section className={section}>
          {head(Bot, "bg-violet-500/15 text-violet-300", 1, "Opponents")}
          <p className="text-sm text-slate-300">Race people, bots, or both. Bots are <b>simulated</b>: they follow a published daily schedule and do not really study. Each gets its own look and style.</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {(Object.keys(BOT_TIERS) as (keyof typeof BOT_TIERS)[]).map((k) => (
              <div key={k} className={`rounded-2xl border-2 p-2 text-center transition sm:p-3 ${bots[k] > 0 ? "border-indigo-400 bg-indigo-500/5" : "border-black/10"}`}>
                <input type="hidden" name={k} value={bots[k]} />
                <span className={`mx-auto grid h-11 w-11 place-items-center rounded-xl ${BOT_LOOK[k]}`}><Bot size={22} /></span>
                <div className="mt-1.5 font-bold">{BOT_TIERS[k].label}</div>
                <div className="text-[11px] leading-tight text-slate-400">{BOT_TIERS[k].pace} XP/day<span className="hidden sm:inline"> · {BOT_TIERS[k].blurb}</span></div>
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setBots({ ...bots, [k]: Math.max(0, bots[k] - 1) })} disabled={bots[k] === 0} aria-label={`Fewer ${BOT_TIERS[k].label} bots`} className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 disabled:opacity-30"><Minus size={14} /></button>
                  <span className="w-6 text-lg font-extrabold tabular-nums" aria-live="polite">{bots[k]}</span>
                  <button type="button" onClick={() => setBots({ ...bots, [k]: Math.min(3, bots[k] + 1) })} disabled={bots[k] === 3} aria-label={`More ${BOT_TIERS[k].label} bots`} className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 disabled:opacity-30"><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div><label className={label} htmlFor="emails">Invite people who already have an account, by email</label>
            <textarea id="emails" name="emails" rows={2} placeholder="ana@example.com, ben@example.com" className={`${input} mt-1`} />
            <p className="mt-1 text-xs text-slate-400">People in other companies can be invited too. Everyone in a race sees each other&apos;s names and progress.</p></div>
          <div><label className={label} htmlFor="maxHumans">Max people</label>
            <input id="maxHumans" name="maxHumans" type="number" min={2} max={50} defaultValue={20} className={`${input} mt-1 max-w-32`} /></div>
        </section>

        <section className={section}>
          {head(Eye, "bg-sky-500/15 text-sky-300", 2, "Who can watch")}
          <div className="grid gap-3 sm:grid-cols-2">
            {([["private", Lock, "Private", "Only people you invite can see or join it.", "bg-emerald-500/15 text-emerald-300"], ["public", Globe, "Public", "Anyone with the link can watch the live leaderboard, without signing in.", "bg-sky-500/15 text-sky-300"]] as const).map(([v, Icon, name, text, tone]) => (
              <label key={v} className={`relative cursor-pointer rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${visibility === v ? "border-indigo-400 bg-indigo-500/10" : "border-black/10"}`}>
                <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="sr-only" />
                <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
                <b className="flex items-center gap-1.5">{name}{visibility === v && <Check size={16} className="spin-in text-indigo-300" />}</b><span className="text-sm text-slate-400">{text}</span>
              </label>
            ))}
          </div>
          {topic?.guest && (
            <label className="flex items-start gap-2 rounded-2xl bg-black/[.03] p-3 text-sm"><input type="checkbox" name="inviteLink" defaultChecked className="mt-1" />
              <span><b>Create an invite link.</b> A friend with no account can join from it and sign up on the spot. Anyone who has the link can join, up to your limit, so keep it to people you trust. You can switch it off on the race page.</span></label>
          )}
          {visibility === "public" && (
            <div className="space-y-2 rounded-2xl bg-black/[.03] p-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="openJoin" /> Let any signed-in learner join (otherwise invited people only)</label>
              <label className="flex items-start gap-2"><input type="checkbox" name="consent" required className="mt-1" />
                <span>I understand that names, photos and progress of everyone in this contest are visible to anyone. You can make it private later, but not the other way round.</span></label>
            </div>
          )}
        </section>

        <section className={section}>
          {head(Coins, "bg-amber-500/15 text-amber-300", 3, "Reward")}
          <div className="grid gap-3 sm:grid-cols-2">
            {([[false, Award, "Certificates", "Everyone who reaches the goal can claim one. First place is Champion.", "bg-sky-500/15 text-sky-300"], [true, Coins, "Add a cash prize", "Paid by you, outside gglearn, to the first to reach the goal.", "bg-amber-500/15 text-amber-300"]] as const).map(([v, Icon, name, text, tone]) => (
              <button type="button" key={name} onClick={() => setPrize(v)} aria-pressed={prize === v} className={`rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${prize === v ? "border-indigo-400 bg-indigo-500/10" : "border-black/10"}`}>
                <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
                <b className="flex items-center gap-1.5">{name}{prize === v && <Check size={16} className="text-indigo-300" />}</b><span className="text-sm text-slate-400">{text}</span>
              </button>
            ))}
          </div>
          {prize && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">gglearn does not hold or send money: you pay winners yourself and record it. Only people, not bots, can win.</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div><label className={label} htmlFor="prizeAmount">Prize pool</label><input id="prizeAmount" name="prizeAmount" inputMode="decimal" placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} mt-1`} /></div>
                <div><label className={label} htmlFor="prizeCurrency">Currency</label>
                  <select id="prizeCurrency" name="prizeCurrency" className={`${input} mt-1`}>{Object.entries(CURRENCIES).map(([k, sym]) => <option key={k} value={k}>{k} {sym}</option>)}</select></div>
                <div className="sm:col-span-2"><label className={label} htmlFor="prizeSplit">Split</label>
                  <select id="prizeSplit" name="prizeSplit" className={`${input} mt-1`}>{Object.entries(PRIZE_SPLIT_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
              </div>
              <div><label className={label} htmlFor="prizeNote">Who pays, and when? (required with a prize)</label><input id="prizeNote" name="prizeNote" maxLength={200} className={`${input} mt-1`} /></div>
            </div>
          )}
        </section>

        <section className={section}>
          {head(Shuffle, "bg-fuchsia-500/15 text-fuchsia-300", 4, "Architect twist (optional)")}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="twist" className="mt-1" />
            <span><b>Let a random racer rewrite one question for the others.</b> For each level, one person in the race is drawn by the server and shown one multiple-choice question,
              which they may reword for their rivals. They can also just pass, and then nothing changes.</span></label>
          <ul className="list-disc space-y-1 pl-9 text-xs text-slate-400">
            <li>It can never decide the race: at most 1 question in 10 per level, never counted in the ranking, and the Architect does not face their own twist.</li>
            <li>Same format and number of options, no links, and an AI referee checks that exactly one answer is right before it goes live. If the referee is down, you approve it, and you can veto any twist.</li>
            <li>It locks the moment a rival starts that level, so everyone faces it or nobody does. Racers only see who the Architect was after the contest ends.</li>
          </ul>
        </section>
          </div>
        </details>
      </div>

      {/* the contest as the people in it will see it */}
      <aside className="lg:sticky lg:top-20" aria-label="Your contest">
        <div className="card overflow-hidden">
          <div className="px-5 pb-4 pt-5" style={{ background: "linear-gradient(135deg, rgba(245,158,11,.2), #fff 70%)" }}>
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-400"><Trophy size={13} />Your contest</div>
            <div className="flex items-center gap-3">
              {topic ? <div className="pop shrink-0" key={topic.id}>{topic.art}</div> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-black/15 text-slate-300"><Target size={26} /></span>}
              <div className="min-w-0"><div className="truncate text-lg font-extrabold leading-tight">{title.trim() || (topic ? `${topic.name} sprint` : "Your race")}</div><div className="truncate text-xs text-slate-400">{topic ? topic.name : "Choose a topic"}</div></div>
            </div>
          </div>
          <ul className="space-y-2.5 border-t border-black/5 px-5 py-4 text-sm">
            <li className="flex items-center gap-2.5"><Flag size={16} className="shrink-0 text-pink-300" /><span>Gain <b>{goal}</b> level{goal === 1 ? "" : "s"} in <b>{days}</b> days</span></li>
            <li className="flex items-center gap-2.5"><CalendarClock size={16} className="shrink-0 text-sky-300" /><span>Starts <b>{start === 0 ? "right now" : `in ${start} day${start === 1 ? "" : "s"}`}</b></span></li>
            <li className="flex items-center gap-2.5"><Timer size={16} className="shrink-0" style={{ color: intensity.c }} /><span><b>{intensity.l}</b> pace, {perDay.toFixed(2)} levels a day</span></li>
            <li className="flex items-center gap-2.5"><Users size={16} className="shrink-0 text-violet-300" /><span>You{botTotal > 0 ? <> and <b>{botTotal}</b> bot{botTotal === 1 ? "" : "s"}</> : " and anyone you invite"}</span></li>
            <li className="flex items-center gap-2.5">{visibility === "private" ? <Lock size={16} className="shrink-0 text-emerald-300" /> : <Globe size={16} className="shrink-0 text-sky-300" />}<span><b>{visibility === "private" ? "Private" : "Public"}</b>: {visibility === "private" ? "invited people only" : "anyone can watch"}</span></li>
            <li className="flex items-center gap-2.5">{prize ? <Coins size={16} className="shrink-0 text-amber-300" /> : <Award size={16} className="shrink-0 text-sky-300" />}<span>{prize ? <>Cash prize{amount.trim() ? <>: <b>{amount.trim()}</b></> : ""} and certificates</> : "Certificates for everyone who finishes"}</span></li>
          </ul>
          <div className="space-y-2 border-t border-black/5 p-4">
            {state?.error && <p role="alert" className="slide-in flex items-start gap-1.5 rounded-xl bg-rose-500/10 p-2.5 text-sm text-rose-400"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{state.error}</p>}
            <button disabled={pending} className="btn w-full !justify-center !py-3 text-base disabled:opacity-50">{pending ? "Creating…" : <>Create contest<Swords size={16} /></>}</button>
            {!ready && <p className="text-center text-xs text-slate-400">Choose a topic to create it.</p>}
          </div>
        </div>
      </aside>
    </form>
  );
}

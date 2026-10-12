"use client";
import { startTransition, useActionState, useState } from "react";
import { Bot, Coins, Eye, Globe, Lock, Shuffle, Swords, Target, Timer, TriangleAlert } from "lucide-react";
import { createCompetition, type CreateState } from "../actions";
import { BOT_TIERS } from "@/lib/bots";
import { CURRENCIES, PRIZE_SPLIT_LABEL } from "@/lib/competitions-shared";

type Group = [string, { id: number; name: string }[]];

export default function NewCompetitionForm({ groups }: { groups: Group[] }) {
  const [state, run, pending] = useActionState<CreateState, FormData>(createCompetition, null);
  const [visibility, setVisibility] = useState("private");
  const [goal, setGoal] = useState(3);
  const [days, setDays] = useState(14);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  const label = "block text-sm font-semibold";
  const perDay = (goal / days).toFixed(2);

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="space-y-5">
      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-3 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/15"><Target size={18} className="text-pink-300" /></span><span><span className="mr-1 text-slate-400">1.</span>Topic and goal</span></h2>
        <div><label className={label} htmlFor="title">Name your contest</label>
          <input id="title" name="title" required minLength={3} maxLength={80} placeholder="e.g. Python sprint: team vs the bots" className={input} /></div>
        <div><label className={label} htmlFor="trackId">Topic (hard skill or soft skill)</label>
          <select id="trackId" name="trackId" required defaultValue="" className={input}>
            <option value="" disabled>Choose a topic…</option>
            {groups.map(([g, items]) => <optgroup key={g} label={g}>{items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
          </select></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={label} htmlFor="goalLevels">Goal: levels to gain</label>
            <input id="goalLevels" name="goalLevels" type="number" min={1} max={20} value={goal} onChange={(e) => setGoal(Math.max(1, Number(e.target.value) || 1))} className={input} /></div>
          <div><label className={label} htmlFor="startInDays">Starts</label>
            <select id="startInDays" name="startInDays" defaultValue="0" className={input}>
              <option value="0">Right now</option><option value="1">In 1 day</option><option value="3">In 3 days</option><option value="7">In 1 week</option>
            </select></div>
          <div><label className={label} htmlFor="days">Length (days)</label>
            <select id="days" name="days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={input}>
              {[3, 7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 p-3 text-xs text-slate-300" aria-hidden>
          <Timer size={16} className="shrink-0 text-amber-300" />
          <div className="bar flex-1"><i style={{ width: `${Math.min(100, (Number(perDay) / 1) * 100)}%` }} /></div>
          <span>{perDay} levels / day</span>
        </div>
        <p className="text-xs text-slate-400">
          Progress is measured as levels <i>newly passed</i> after you start, so beginners and experts can race fairly. Your goal works out to {perDay} levels a day.
          Spreading practice over several days beats cramming, so a longer contest usually teaches more.
        </p>
        <div><label className={label} htmlFor="description">Description (optional)</label>
          <textarea id="description" name="description" maxLength={500} rows={2} className={input} /></div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-3 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15"><Bot size={18} className="text-violet-300" /></span><span><span className="mr-1 text-slate-400">2.</span>Opponents</span></h2>
        <p className="text-sm text-slate-300">Race people, bots, or both. Bots are <b>simulated</b>: they follow a published daily schedule and do not really study. Each gets its own look and style.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(BOT_TIERS) as (keyof typeof BOT_TIERS)[]).map((k) => (
            <div key={k} className="rounded-xl border border-black/10 p-3"><label className={`${label} mb-1 flex items-center gap-1.5`} htmlFor={k}><Bot size={15} className="text-violet-300" />{BOT_TIERS[k].label} bots</label>
              <input id={k} name={k} type="number" min={0} max={3} defaultValue={k === "steady" ? 1 : 0} className={input} />
              <span className="text-xs text-slate-400">{BOT_TIERS[k].pace} XP/day · {BOT_TIERS[k].blurb}</span></div>
          ))}
        </div>
        <div><label className={label} htmlFor="emails">Invite people by email (they need an account)</label>
          <textarea id="emails" name="emails" rows={2} placeholder="ana@example.com, ben@example.com" className={input} /></div>
        <div><label className={label} htmlFor="maxHumans">Max people</label>
          <input id="maxHumans" name="maxHumans" type="number" min={2} max={50} defaultValue={20} className={`${input} max-w-32`} /></div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-3 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15"><Eye size={18} className="text-sky-300" /></span><span><span className="mr-1 text-slate-400">3.</span>Who can watch</span></h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["private", Lock, "Private", "Only people you invite can see or join it.", "bg-emerald-500/15 text-emerald-300"], ["public", Globe, "Public", "Anyone with the link can watch the live leaderboard, without signing in.", "bg-sky-500/15 text-sky-300"]] as const).map(([v, Icon, name, text, col]) => (
            <label key={v} className={`cursor-pointer rounded-xl border p-4 transition ${visibility === v ? "border-indigo-400 bg-indigo-500/10 shadow-sm" : "border-black/10 hover:border-black/25"}`}>
              <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="sr-only" />
              <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${col}`}><Icon size={20} /></span>
              <b className="block">{name}</b><span className="text-sm text-slate-400">{text}</span>
            </label>
          ))}
        </div>
        {visibility === "public" && (
          <div className="ml-6 space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="openJoin" /> Let any signed-in learner join (otherwise invited people only)</label>
            <label className="flex items-start gap-2"><input type="checkbox" name="consent" required className="mt-1" />
              <span>I understand that names, photos and progress of everyone in this contest are visible to anyone. You can make it private later, but not the other way round.</span></label>
          </div>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-3 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15"><Coins size={18} className="text-amber-300" /></span><span><span className="mr-1 text-slate-400">4.</span>Reward</span></h2>
        <p className="text-sm text-slate-300">Everyone who reaches the goal can claim a certificate. Optionally add a cash prize for the first to get there. gglearn does not hold or send money: you pay winners yourself and record it. Only people, not bots, can win.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className={label} htmlFor="prizeAmount">Prize pool (optional)</label><input id="prizeAmount" name="prizeAmount" inputMode="decimal" placeholder="0" className={input} /></div>
          <div><label className={label} htmlFor="prizeCurrency">Currency</label>
            <select id="prizeCurrency" name="prizeCurrency" className={input}>{Object.entries(CURRENCIES).map(([k, sym]) => <option key={k} value={k}>{k} {sym}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={label} htmlFor="prizeSplit">Split</label>
            <select id="prizeSplit" name="prizeSplit" className={input}>{Object.entries(PRIZE_SPLIT_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        </div>
        <div><label className={label} htmlFor="prizeNote">Who pays, and when? (required with a prize)</label><input id="prizeNote" name="prizeNote" maxLength={200} className={input} /></div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-3 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-500/15"><Shuffle size={18} className="text-fuchsia-300" /></span><span><span className="mr-1 text-slate-400">5.</span>Architect twist (optional)</span></h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="twist" className="mt-1" />
          <span><b>Let a random racer rewrite one question for the others.</b> For each level, one person in the race is drawn by the server and shown one multiple-choice question,
            which they may reword for their rivals. They can also just pass, and then nothing changes.</span></label>
        <ul className="list-disc space-y-1 pl-9 text-xs text-slate-400">
          <li>It can never decide the race: at most 1 question in 10 per level, never counted in the ranking, and the Architect does not face their own twist.</li>
          <li>Same format and number of options, no links, and an AI referee checks that exactly one answer is right before it goes live. If the referee is down, you approve it, and you can veto any twist.</li>
          <li>It locks the moment a rival starts that level, so everyone faces it or nobody does. Racers only see who the Architect was after the contest ends.</li>
        </ul>
      </section>

      {state?.error && <p role="alert" className="slide-in flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      <button disabled={pending} className="btn !px-6 !py-3 text-base disabled:opacity-50">{pending ? "Creating…" : <>Create contest<Swords size={16} /></>}</button>
    </form>
  );
}

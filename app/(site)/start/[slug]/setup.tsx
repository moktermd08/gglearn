"use client";
import { startTransition, useActionState, useState } from "react";
import { Bot, Coins, Eye, Flag, GraduationCap, Globe, Lock, Swords, Timer, Trophy } from "lucide-react";
import { launchJourney, type StartState } from "../actions";
import { BOT_TIERS } from "@/lib/bots";
import { CURRENCIES, PRIZE_SPLIT_LABEL } from "@/lib/competitions-shared";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";
import { LevelScale } from "@/components/charts";

export default function Setup({ slug, mode, placed, trackName }: { slug: string; mode: "solo" | "group"; placed: number; trackName: string }) {
  const [state, run, pending] = useActionState<StartState, FormData>(launchJourney.bind(null, slug), null);
  const room = MAX_LEVEL - placed;
  const [goal, setGoal] = useState(Math.min(3, room));
  const [days, setDays] = useState(Math.max(7, Math.min(60, Math.min(3, room) * 4)));
  const [incentive, setIncentive] = useState<"cert" | "cash">("cert");
  const [visibility, setVisibility] = useState("private");
  const group = mode === "group";
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  const label = "block text-sm font-semibold";
  const finish = Math.min(MAX_LEVEL, placed + goal);

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="space-y-6">
      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Flag size={18} className="text-emerald-300" />Your finish line</h2>
        <LevelScale lo={placed} hi={finish} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="goalLevels">Levels to climb: <b>{goal}</b></label>
            <input id="goalLevels" name="goalLevels" type="range" min={1} max={Math.min(room, 10)} value={goal}
              onChange={(e) => { const g = Number(e.target.value); setGoal(g); setDays(Math.max(7, Math.min(60, g * 4))); }} className="w-full" />
            <p className="text-sm text-slate-300">From level {placed} to <b>level {finish}, {LEVELS[finish - 1]}</b>.</p>
          </div>
          <div>
            <label className={label} htmlFor="days">Time to do it: <b>{days} days</b></label>
            <input id="days" name="days" type="range" min={3} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full" />
            <p className="flex items-center gap-1 text-sm text-slate-300"><Timer size={14} className="shrink-0 text-amber-300" />About {(goal / days).toFixed(2)} levels a day. Spread-out practice beats cramming.</p>
          </div>
        </div>
        <div><label className={label} htmlFor="title">Name it (optional)</label>
          <input id="title" name="title" maxLength={80} placeholder={`${trackName} ${group ? "showdown" : "sprint"}`} className={input} /></div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Bot size={18} className="text-violet-300" />{group ? "Add some simulated rivals?" : "Want someone to chase?"}</h2>
        <p className="text-sm text-slate-300">Bots are <b>simulated</b>: they follow a published daily schedule and never really study, so you can see exactly what pace beats them.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(BOT_TIERS) as (keyof typeof BOT_TIERS)[]).map((k) => (
            <div key={k} className="rounded-xl border border-black/10 p-3"><label className={`${label} mb-1 flex items-center gap-1.5`} htmlFor={k}><Bot size={15} className="text-violet-300" />{BOT_TIERS[k].label} bots</label>
              <input id={k} name={k} type="number" min={0} max={2} defaultValue={k === "steady" ? 1 : 0} className={input} />
              <span className="text-xs text-slate-400">{BOT_TIERS[k].blurb}</span></div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Trophy size={18} className="text-amber-300" />What is the reward?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["cert", GraduationCap, "Certificate and glory", "Everyone who reaches the finish line can claim a verifiable certificate; the first to get there is named Champion.", "bg-sky-500/15 text-sky-300"], ["cash", Coins, "Add a cash prize", `Certificates too, plus money for the first to finish${group ? "" : " (a reward you set yourself)"}.`, "bg-amber-500/15 text-amber-300"]] as const).map(([v, Icon, name, text, tone]) => (
            <label key={v} className={`cursor-pointer rounded-xl border p-4 transition ${incentive === v ? "border-indigo-400 bg-indigo-500/10" : "border-black/10 hover:border-black/25"}`}>
              <input type="radio" name="incentive" value={v} checked={incentive === v} onChange={() => setIncentive(v)} className="sr-only" />
              <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span><b className="block">{name}</b><span className="text-sm text-slate-400">{text}</span>
            </label>
          ))}
        </div>
        {incentive === "cash" && (
          <div className="ml-6 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={label} htmlFor="prizeAmount">Prize pool</label>
                <input id="prizeAmount" name="prizeAmount" inputMode="decimal" required placeholder="100" className={input} /></div>
              <div><label className={label} htmlFor="prizeCurrency">Currency</label>
                <select id="prizeCurrency" name="prizeCurrency" className={input}>{Object.entries(CURRENCIES).map(([k, sym]) => <option key={k} value={k}>{k} {sym}</option>)}</select></div>
              {group && <div><label className={label} htmlFor="prizeSplit">Split</label>
                <select id="prizeSplit" name="prizeSplit" className={input}>{Object.entries(PRIZE_SPLIT_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>}
            </div>
            <div><label className={label} htmlFor="prizeNote">Who pays, and when?</label>
              <input id="prizeNote" name="prizeNote" maxLength={200} required placeholder="Paid by the team budget within a week of the end" className={input} /></div>
            <p className="text-xs text-slate-400">gglearn does not hold or send money. You pay the winners yourself; gglearn names them from the live results and records when you mark the prize paid. Only people, never bots, can win, and only by reaching the finish line.</p>
          </div>
        )}
      </section>

      {group && (
        <section className="card space-y-2 p-5">
          <h2 className="flex items-center gap-2 font-bold"><Eye size={18} className="text-sky-300" />Who can watch?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["private", Lock, "Private", "Only your group.", "bg-emerald-500/15 text-emerald-300"], ["public", Globe, "Public", "Anyone with the link can watch the live leaderboard.", "bg-sky-500/15 text-sky-300"]] as const).map(([v, Icon, name, text, tone]) => (
              <label key={v} className={`cursor-pointer rounded-xl border p-4 transition ${visibility === v ? "border-indigo-400 bg-indigo-500/10" : "border-black/10 hover:border-black/25"}`}>
                <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="sr-only" />
                <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span><b className="block">{name}</b><span className="text-sm text-slate-400">{text}</span>
              </label>
            ))}
          </div>
          {visibility === "public" && (
            <label className="ml-6 flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1" />
              <span>I understand names, photos and progress of everyone in this race are visible to anyone. It can be made private later, but not the other way round.</span></label>
          )}
        </section>
      )}

      {state?.error && <p role="alert" className="text-sm text-rose-400">{state.error}</p>}
      <button disabled={pending} className="btn !px-6 !py-3 text-base disabled:opacity-50">{pending ? "Opening the race…" : <>Start the race<Swords size={16} /></>}</button>
    </form>
  );
}

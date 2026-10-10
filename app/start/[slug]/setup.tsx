"use client";
import { useActionState, useState } from "react";
import { launchJourney, type StartState } from "../actions";
import { BOT_TIERS } from "@/lib/bots";
import { CURRENCIES, PRIZE_SPLIT_LABEL } from "@/lib/competitions-shared";
import { LEVELS, MAX_LEVEL } from "@/lib/levels";

export default function Setup({ slug, mode, placed, trackName }: { slug: string; mode: "solo" | "group"; placed: number; trackName: string }) {
  const [state, run, pending] = useActionState<StartState, FormData>(launchJourney.bind(null, slug), null);
  const room = MAX_LEVEL - placed;
  const [goal, setGoal] = useState(Math.min(3, room));
  const [days, setDays] = useState(Math.max(7, Math.min(60, Math.min(3, room) * 4)));
  const [incentive, setIncentive] = useState<"cert" | "cash">("cert");
  const [visibility, setVisibility] = useState("private");
  const group = mode === "group";
  const input = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2";
  const label = "block text-sm font-semibold";
  const finish = Math.min(MAX_LEVEL, placed + goal);

  return (
    <form action={run} className="space-y-6">
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Your finish line</h2>
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
            <p className="text-sm text-slate-300">About {(goal / days).toFixed(2)} levels a day. Spread-out practice beats cramming.</p>
          </div>
        </div>
        <div><label className={label} htmlFor="title">Name it (optional)</label>
          <input id="title" name="title" maxLength={80} placeholder={`${trackName} ${group ? "showdown" : "sprint"}`} className={input} /></div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{group ? "Add some simulated rivals?" : "Want someone to chase?"}</h2>
        <p className="text-sm text-slate-300">Bots are <b>simulated</b>: they follow a published daily schedule and never really study, so you can see exactly what pace beats them.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(BOT_TIERS) as (keyof typeof BOT_TIERS)[]).map((k) => (
            <div key={k}><label className={label} htmlFor={k}>{BOT_TIERS[k].label} bots</label>
              <input id={k} name={k} type="number" min={0} max={2} defaultValue={k === "steady" ? 1 : 0} className={input} />
              <span className="text-xs text-slate-400">{BOT_TIERS[k].blurb}</span></div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">What is the reward?</h2>
        <label className="flex items-start gap-2"><input type="radio" name="incentive" value="cert" checked={incentive === "cert"} onChange={() => setIncentive("cert")} className="mt-1" />
          <span><b>🎓 Certificate and glory</b> · everyone who reaches the finish line can claim a verifiable certificate; the first to get there is named Champion.</span></label>
        <label className="flex items-start gap-2"><input type="radio" name="incentive" value="cash" checked={incentive === "cash"} onChange={() => setIncentive("cash")} className="mt-1" />
          <span><b>💰 Add a cash prize</b> · certificates too, plus money for the first to finish{group ? "" : " (a reward you set yourself)"}.</span></label>
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
          <h2 className="font-bold">Who can watch?</h2>
          <label className="flex items-start gap-2"><input type="radio" name="visibility" value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} className="mt-1" />
            <span><b>🔒 Private</b> · only your group.</span></label>
          <label className="flex items-start gap-2"><input type="radio" name="visibility" value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} className="mt-1" />
            <span><b>🌐 Public</b> · anyone with the link can watch the live leaderboard.</span></label>
          {visibility === "public" && (
            <label className="ml-6 flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1" />
              <span>I understand names, photos and progress of everyone in this race are visible to anyone. It can be made private later, but not the other way round.</span></label>
          )}
        </section>
      )}

      {state?.error && <p role="alert" className="text-sm text-rose-400">{state.error}</p>}
      <button disabled={pending} className="btn disabled:opacity-50">{pending ? "Opening the race…" : "Start the race ⚔️"}</button>
    </form>
  );
}

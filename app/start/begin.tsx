"use client";
import { useActionState, useMemo, useState } from "react";
import { beginJourney, type StartState } from "./actions";

type Topic = { id: number; name: string; kindLabel: string; description: string };

export default function Begin({ topics }: { topics: Topic[] }) {
  const [state, run, pending] = useActionState<StartState, FormData>(beginJourney, null);
  const [q, setQ] = useState("");
  const [trackId, setTrackId] = useState<number | null>(null);
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? topics.filter((t) => `${t.name} ${t.kindLabel} ${t.description}`.toLowerCase().includes(n)) : topics).slice(0, 24);
  }, [q, topics]);
  const picked = topics.find((t) => t.id === trackId);
  const input = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2";

  return (
    <form action={run} className="space-y-8">
      <input type="hidden" name="trackId" value={trackId ?? ""} />
      <section className="card space-y-3 p-5">
        <label htmlFor="q" className="font-bold">1. Your learning goal</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a skill, tool or subject: git, sales, python, onboarding…" className={input} autoComplete="off" />
        <div role="radiogroup" aria-label="Topics" className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
          {shown.map((t) => (
            <button type="button" key={t.id} role="radio" aria-checked={t.id === trackId} onClick={() => setTrackId(t.id)}
              className={`rounded-lg border p-3 text-left transition ${t.id === trackId ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 hover:border-white/30"}`}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-slate-400">{t.kindLabel}</div>
            </button>
          ))}
          {shown.length === 0 && <p className="text-sm text-slate-400">No topic matches “{q}”. Try a shorter word, or ask a manager to add it to the question bank.</p>}
        </div>
        {picked && <p className="text-sm text-emerald-300">Selected: <b>{picked.name}</b></p>}
      </section>

      <section className="card space-y-3 p-5">
        <div className="font-bold">2. Who is in?</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-xl border p-4 ${mode === "solo" ? "border-indigo-400 bg-indigo-500/20" : "border-white/10"}`}>
            <input type="radio" name="mode" value="solo" checked={mode === "solo"} onChange={() => setMode("solo")} className="sr-only" />
            <div className="text-lg font-bold">🧗 Just me</div>
            <div className="text-sm text-slate-300">Race the clock, your own goal and, if you like, simulated rivals.</div>
          </label>
          <label className={`cursor-pointer rounded-xl border p-4 ${mode === "group" ? "border-indigo-400 bg-indigo-500/20" : "border-white/10"}`}>
            <input type="radio" name="mode" value="group" checked={mode === "group"} onChange={() => setMode("group")} className="sr-only" />
            <div className="text-lg font-bold">⚔️ I have a group</div>
            <div className="text-sm text-slate-300">Friends or teammates race you on a live leaderboard. Prizes are possible.</div>
          </label>
        </div>
        {mode === "group" && (
          <div>
            <label htmlFor="emails" className="block text-sm font-semibold">Their email addresses</label>
            <textarea id="emails" name="emails" rows={3} placeholder="ana@example.com, ben@example.com" className={input} />
            <p className="mt-1 text-xs text-slate-400">People who already have an account are invited right away. Anyone else is invited automatically the moment a manager creates their account with that email. gglearn does not send email, so tell them to look for the invitation on their dashboard.</p>
          </div>
        )}
      </section>

      {state?.error && <p role="alert" className="text-sm text-rose-400">{state.error}</p>}
      <button disabled={pending || !trackId} className="btn disabled:opacity-50">{pending ? "One moment…" : "Find my starting level →"}</button>
    </form>
  );
}

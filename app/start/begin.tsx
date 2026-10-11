"use client";
import { startTransition, useActionState, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Mail, Mountain, Search, Swords, Users } from "lucide-react";
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
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="space-y-8">
      <input type="hidden" name="trackId" value={trackId ?? ""} />
      <section className="card space-y-3 p-5">
        <label htmlFor="q" className="flex items-center gap-2 font-bold"><Search size={18} className="text-sky-300" />1. Your learning goal</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a skill, tool or subject: git, sales, python, onboarding…" className={input} autoComplete="off" />
        <div role="radiogroup" aria-label="Topics" className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
          {shown.map((t, i) => (
            <button type="button" key={t.id} role="radio" aria-checked={t.id === trackId} onClick={() => setTrackId(t.id)}
              style={{ "--i": Math.min(i, 8) } as React.CSSProperties} className={`rise flex items-start gap-2 rounded-lg border p-3 text-left transition ${t.id === trackId ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 hover:border-white/30"}`}>
              <BookOpen size={16} className={`mt-1 shrink-0 ${t.id === trackId ? "text-indigo-300" : "text-slate-500"}`} />
              <span className="min-w-0 flex-1"><span className="block font-semibold">{t.name}</span><span className="block text-xs text-slate-400">{t.kindLabel}</span></span>
              {t.id === trackId && <Check size={18} className="spin-in mt-0.5 shrink-0 text-indigo-300" />}
            </button>
          ))}
          {shown.length === 0 && <p className="text-sm text-slate-400">No topic matches “{q}”. Try a shorter word, or ask a manager to add it to the question bank.</p>}
        </div>
        {picked && <p className="pop flex items-center gap-1.5 text-sm text-emerald-300"><Check size={15} />Selected: <b>{picked.name}</b></p>}
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex items-center gap-2 font-bold"><Users size={18} className="text-pink-300" />2. Who is in?</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-xl border p-4 ${mode === "solo" ? "border-indigo-400 bg-indigo-500/20" : "border-white/10"}`}>
            <input type="radio" name="mode" value="solo" checked={mode === "solo"} onChange={() => setMode("solo")} className="sr-only" />
            <div className="flex items-center gap-2 text-lg font-bold"><Mountain size={20} className="text-emerald-300" />Just me</div>
            <div className="text-sm text-slate-300">Race the clock, your own goal and, if you like, simulated rivals.</div>
          </label>
          <label className={`cursor-pointer rounded-xl border p-4 ${mode === "group" ? "border-indigo-400 bg-indigo-500/20" : "border-white/10"}`}>
            <input type="radio" name="mode" value="group" checked={mode === "group"} onChange={() => setMode("group")} className="sr-only" />
            <div className="flex items-center gap-2 text-lg font-bold"><Swords size={20} className="text-pink-300" />I have a group</div>
            <div className="text-sm text-slate-300">Friends or teammates race you on a live leaderboard. Prizes are possible.</div>
          </label>
        </div>
        {mode === "group" && (
          <div>
            <label htmlFor="emails" className="flex items-center gap-1.5 text-sm font-semibold"><Mail size={15} className="text-sky-300" />Their email addresses</label>
            <textarea id="emails" name="emails" rows={3} placeholder="ana@example.com, ben@example.com" className={input} />
            <p className="mt-1 text-xs text-slate-400">People who already have an account are invited right away. Anyone else is invited automatically the moment a manager creates their account with that email. gglearn does not send email, so tell them to look for the invitation on their dashboard.</p>
          </div>
        )}
      </section>

      {state?.error && <p role="alert" className="text-sm text-rose-400">{state.error}</p>}
      <button disabled={pending || !trackId} className="btn disabled:opacity-50">{pending ? "One moment…" : <>Find my starting level<ArrowRight size={16} /></>}</button>
    </form>
  );
}

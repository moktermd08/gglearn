"use client";
import { startTransition, useActionState, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Mail, Mountain, Search, Swords, Users } from "lucide-react";
import { beginJourney, requestTopic, type StartState } from "./actions";

type Topic = { icon: ReactNode; id: number; name: string; kindLabel: string; description: string; suggested: boolean };

export default function Begin({ topics }: { topics: Topic[] }) {
  const [state, run, pending] = useActionState<StartState, FormData>(beginJourney, null);
  const [q, setQ] = useState("");
  const [trackId, setTrackId] = useState<number | null>(null);
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const [asked, setAsked] = useState<string | null>(null);
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
              style={{ "--i": Math.min(i, 8) } as React.CSSProperties} className={`rise flex items-center gap-3 rounded-xl border p-3 text-left transition ${t.id === trackId ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 hover:border-white/30"}`}>
              <span className="shrink-0">{t.icon}</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{t.name}</span><span className="block text-xs text-slate-400">{t.kindLabel}{t.suggested && <span className="ml-2 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">for you</span>}</span></span>
              {t.id === trackId && <Check size={18} className="spin-in mt-0.5 shrink-0 text-indigo-300" />}
            </button>
          ))}
          {shown.length === 0 && (
            <div className="col-span-full text-sm text-slate-400">
              <p>No topic matches “{q}”. Try a shorter word.</p>
              {asked === q.trim().toLowerCase()
                ? <p className="mt-1 text-emerald-300">Thanks, your manager will see that you asked for “{q.trim()}”.</p>
                : q.trim().length >= 2 && <button type="button" onClick={async () => { const r = await requestTopic(q); if (r.ok) setAsked(q.trim().toLowerCase()); }} className="mt-1 underline">Ask for “{q.trim()}” to be added</button>}
            </div>
          )}
        </div>
        {!q.trim() && topics.length > shown.length && <p className="text-xs text-slate-400">Showing {shown.length} of {topics.length} topics{topics.some((t) => t.suggested) ? ", starting with the ones for you" : ""}. Type above to search all of them.</p>}
        {picked && <p className="pop flex items-center gap-1.5 text-sm text-emerald-300"><Check size={15} />Selected: <b>{picked.name}</b></p>}
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex items-center gap-2 font-bold"><Users size={18} className="text-pink-300" />2. Who is in?</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-xl border p-4 ${mode === "solo" ? "border-indigo-400 bg-indigo-500/20" : "border-white/10"}`}>
            <input type="radio" name="mode" value="solo" checked={mode === "solo"} onChange={() => setMode("solo")} className="sr-only" />
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15"><Mountain size={22} className="text-emerald-300" /></div><div className="flex items-center gap-2 text-lg font-bold">Just me{mode === "solo" && <Check size={18} className="spin-in text-indigo-300" />}</div>
            <div className="text-sm text-slate-300">Race the clock, your own goal and, if you like, simulated rivals.</div>
          </label>
          <label className={`cursor-pointer rounded-xl border p-4 ${mode === "group" ? "border-indigo-400 bg-indigo-500/20" : "border-white/10"}`}>
            <input type="radio" name="mode" value="group" checked={mode === "group"} onChange={() => setMode("group")} className="sr-only" />
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-pink-500/15"><Swords size={22} className="text-pink-300" /></div><div className="flex items-center gap-2 text-lg font-bold">I have a group{mode === "group" && <Check size={18} className="spin-in text-indigo-300" />}</div>
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

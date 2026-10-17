"use client";
import { startTransition, useActionState, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Flag, Gauge, Mail, Mountain, Rocket, Search, Sparkles, Swords, Users, X } from "lucide-react";
import { beginJourney, requestTopic, type StartState } from "./actions";
import { Avatar } from "@/components/Avatar";

type Topic = {
  icon: ReactNode; bigIcon: ReactNode; id: number; name: string; kindLabel: string; description: string; suggested: boolean;
  n: number; rival: { name: string; tagline: string; hue: number };
};

const PAGE = 24;

export default function Begin({ topics }: { topics: Topic[] }) {
  const [state, run, pending] = useActionState<StartState, FormData>(beginJourney, null);
  const [q, setQ] = useState(""), [kind, setKind] = useState("All"), [limit, setLimit] = useState(PAGE);
  const [trackId, setTrackId] = useState<number | null>(null);
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const [asked, setAsked] = useState<string | null>(null);
  const kinds = useMemo(() => ["All", ...[...new Set(topics.map((t) => t.kindLabel))].sort()], [topics]);
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return topics.filter((t) => (kind === "All" || t.kindLabel === kind) && (!n || `${t.name} ${t.kindLabel} ${t.description}`.toLowerCase().includes(n)));
  }, [q, kind, topics]);
  const filtering = !!q.trim() || kind !== "All";
  const forYou = filtering ? [] : matches.filter((t) => t.suggested).slice(0, 4);
  const rest = matches.filter((t) => !forYou.includes(t));
  const shown = rest.slice(0, limit);
  const picked = topics.find((t) => t.id === trackId);
  const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";
  const submit = <button disabled={pending || !trackId} className="btn !justify-center !py-3 text-base disabled:opacity-50">{pending ? "One moment…" : <>Find my starting level<ArrowRight size={16} /></>}</button>;

  const card = (t: Topic, i: number, big = false) => (
    <button type="button" key={t.id} role="radio" aria-checked={t.id === trackId} onClick={() => setTrackId(t.id)} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
      className={`rise relative flex min-w-0 items-center gap-3 rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${t.id === trackId ? "border-indigo-400 bg-indigo-500/10 shadow-md" : "border-black/10 bg-[#fff]"} ${big ? "sm:p-4" : ""}`}>
      <span className="shrink-0">{t.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{t.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">{t.kindLabel}<span aria-hidden>·</span>{t.n.toLocaleString("en-GB")} questions</span>
      </span>
      {t.id === trackId && <span className="pop grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500 text-[#fff]"><Check size={14} /></span>}
    </button>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <input type="hidden" name="trackId" value={trackId ?? ""} />
      <div className="min-w-0 space-y-6">
        <section className="card space-y-4 p-5">
          <label htmlFor="q" className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Search size={17} /></span><span><span className="mr-1 text-slate-400">1.</span>Your learning goal</span></label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="q" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Type a skill, tool or subject: git, sales, python, onboarding…" className={`${input} !pl-9 !pr-9`} autoComplete="off" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-black/5"><X size={15} /></button>}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
            {kinds.map((k) => (
              <button type="button" key={k} onClick={() => { setKind(k); setLimit(PAGE); }} aria-pressed={kind === k}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${kind === k ? "border-indigo-400 bg-indigo-500 text-[#fff]" : "border-black/10 bg-[#fff] text-slate-300 hover:border-indigo-300"}`}>{k}{k !== "All" && <span className="ml-1 opacity-60">{topics.filter((t) => t.kindLabel === k).length}</span>}</button>
            ))}
          </div>

          <div role="radiogroup" aria-label="Topics" className="space-y-4">
            {forYou.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300"><Sparkles size={13} />Picked for you</div>
                <div className="grid gap-2 sm:grid-cols-2">{forYou.map((t, i) => card(t, i, true))}</div>
              </div>
            )}
            {rest.length > 0 && (
              <div>
                {forYou.length > 0 && <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">All topics</div>}
                <div className="grid gap-2 sm:grid-cols-2">{shown.map((t, i) => card(t, i))}</div>
                {rest.length > shown.length && <button type="button" onClick={() => setLimit(limit + PAGE)} className="btn btn-ghost mt-3 !py-1.5 text-sm">Show {Math.min(PAGE, rest.length - shown.length)} more <span className="text-slate-400">({rest.length - shown.length} left)</span></button>}
              </div>
            )}
            {matches.length === 0 && (
              <div className="rounded-2xl border border-dashed border-black/15 p-5 text-center text-sm text-slate-400">
                <p>No topic matches “{q}”. Try a shorter word.</p>
                {asked === q.trim().toLowerCase()
                  ? <p className="mt-1 text-emerald-300">Thanks, your manager will see that you asked for “{q.trim()}”.</p>
                  : q.trim().length >= 2 && <button type="button" onClick={async () => { const r = await requestTopic(q); if (r.ok) setAsked(q.trim().toLowerCase()); }} className="mt-2 underline">Ask for “{q.trim()}” to be added</button>}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">{filtering ? `${matches.length} topic${matches.length === 1 ? "" : "s"} found` : `${topics.length} topics`}{!filtering && topics.some((t) => t.suggested) ? ", starting with the ones for you" : ""}.</p>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500/15 text-pink-300"><Users size={17} /></span><span><span className="mr-1 text-slate-400">2.</span>Who is in?</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["solo", Mountain, "Just me", "Race the clock, your own goal and, if you like, simulated rivals.", "bg-emerald-500/15 text-emerald-300"], ["group", Swords, "I have a group", "Friends or teammates race you on a live leaderboard. Prizes are possible.", "bg-pink-500/15 text-pink-300"]] as const).map(([v, Icon, name, text, tone]) => (
              <label key={v} className={`relative cursor-pointer rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${mode === v ? "border-indigo-400 bg-indigo-500/10" : "border-black/10"}`}>
                <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
                <span className={`mb-2 grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon size={22} /></span>
                <span className="flex items-center gap-2 text-lg font-bold">{name}{mode === v && <Check size={18} className="spin-in text-indigo-300" />}</span>
                <span className="text-sm text-slate-300">{text}</span>
                <span className="mt-2 flex -space-x-2" aria-hidden>{(v === "solo" ? [0, 1] : [0, 1, 2, 3]).map((n) => <span key={n} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#fff] text-[10px] font-extrabold text-[#fff]" style={{ background: `hsl(${(n * 70 + (v === "solo" ? 150 : 300)) % 360} 65% 50%)` }}>{v === "solo" && n === 1 ? "🤖" : ""}</span>)}</span>
              </label>
            ))}
          </div>
          {mode === "group" && (
            <div>
              <label htmlFor="emails" className="flex items-center gap-1.5 text-sm font-semibold"><Mail size={15} className="text-sky-300" />Their email addresses</label>
              <textarea id="emails" name="emails" rows={3} placeholder="ana@example.com, ben@example.com" className={`${input} mt-1`} />
              <p className="mt-1 text-xs text-slate-400">People who already have an account are invited right away. Anyone else is invited automatically the moment a manager creates their account with that email. gglearn does not send email, so tell them to look for the invitation on their dashboard.</p>
            </div>
          )}
        </section>

        {state?.error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-400">{state.error}</p>}
      </div>

      {/* what you are signing up for, updating as you choose */}
      <aside className="space-y-4 lg:sticky lg:top-20" aria-label="Your journey">
        <div className="card overflow-hidden">
          <div className="px-5 pb-4 pt-5" style={{ background: picked ? "linear-gradient(135deg, rgba(99,102,241,.16), #fff 70%)" : "linear-gradient(135deg, rgba(100,116,139,.1), #fff 70%)" }}>
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Your journey</div>
            {picked ? (
              <div className="pop space-y-3" key={picked.id}>
                <div className="flex items-center gap-3">{picked.bigIcon}<div className="min-w-0"><div className="text-lg font-extrabold leading-tight">{picked.name}</div><div className="text-xs text-slate-400">{picked.kindLabel} · {picked.n.toLocaleString("en-GB")} questions · 20 levels</div></div></div>
                {picked.description && <p className="line-clamp-3 text-sm text-slate-300">{picked.description}</p>}
                <div className="flex items-center gap-3 rounded-2xl bg-black/[.04] p-3">
                  <Avatar kind="rival" level={3} hue={picked.rival.hue} size={44} />
                  <div className="min-w-0 text-sm"><div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Your rival</div><div className="font-bold">{picked.rival.name}</div><div className="truncate text-xs text-slate-400">{picked.rival.tagline}</div></div>
                </div>
                <div className="flex items-center gap-2 text-sm">{mode === "solo" ? <Mountain size={15} className="text-emerald-300" /> : <Swords size={15} className="text-pink-300" />}<span className="font-semibold">{mode === "solo" ? "Just you" : "You and your group"}</span></div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400"><Rocket size={30} className="bob mx-auto mb-2 text-slate-300" />Pick a topic and your journey appears here.</div>
            )}
          </div>
          <ol className="space-y-3 border-t border-black/5 px-5 py-4 text-sm">
            <li className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">What happens next</li>
            {[{ Icon: Gauge, t: "A short level check", d: "3 to 5 quick rounds find where to start. Skippable." }, { Icon: Flag, t: "Set your finish line", d: "Choose how many levels to climb and by when." }, { Icon: Swords, t: "The race begins", d: "A live leaderboard, with a rival in your corner." }].map(({ Icon, t, d }, i) => (
              <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/12 text-indigo-300"><Icon size={16} /></span><span><b className="block text-sm"><span className="mr-1 text-slate-400">{i + 1}.</span>{t}</b><span className="text-xs text-slate-400">{d}</span></span></li>
            ))}
          </ol>
          <div className="border-t border-black/5 p-4">{submit}{!picked && <p className="mt-2 text-center text-xs text-slate-400">Choose a topic to continue.</p>}</div>
        </div>
      </aside>
    </form>
  );
}

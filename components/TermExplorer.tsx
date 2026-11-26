"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, LayoutGrid, RotateCcw, Search, Shapes, X } from "lucide-react";
import { studyAnswerAction, termCardAction } from "@/app/terms-actions";
import { Donut } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { TermBack, TermFront } from "@/components/TermCard";
import { Pips, RANK_COLOR, TopicIcon, topicHue } from "@/components/TermVisuals";
import { RANKS, type StudyState } from "@/lib/termsCore";
import type { RichCard } from "@/lib/termDetails";

/** The role list as something to explore: charts that filter, topics as tiles, each topic as a diagram of its terms, and a full card for any term. */

export type ExploreTerm = { id: number; term: string; meaning: string; tier: number; group: string; bank: string; state: StudyState };

const STATES: StudyState[] = ["known", "learning", "new"];
const STATE = {
  known: { label: "Known", color: "#059669", soft: "#d1fae5", ink: "text-emerald-800" },
  learning: { label: "Learning", color: "#d97706", soft: "#fef3c7", ink: "text-amber-800" },
  new: { label: "Not started", color: "#a8a29e", soft: "#f0eee7", ink: "text-slate-300" },
} as const;

const keyOf = (t: ExploreTerm) => `${t.bank} · ${t.group || "General"}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Tile({ t, onOpen }: { t: ExploreTerm; onOpen: () => void }) {
  const hue = topicHue(t.group);
  return (
    <button type="button" onClick={onOpen} className="card card-hover flex h-full w-full flex-col gap-2 p-3 text-left" style={{ borderTop: `4px solid ${STATE[t.state].color}` }}>
      <span className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${hue}14`, color: hue }} aria-hidden><TopicIcon group={t.group} bank={t.bank} size={16} /></span>
        <b className="min-w-0 flex-1 break-words text-sm">{capital(t.term)}</b>
        <Pips tier={t.tier} />
      </span>
      <span className="line-clamp-2 text-xs text-slate-400">{t.meaning}</span>
      <span className={`mt-auto self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE[t.state].ink}`} style={{ background: STATE[t.state].soft }}>{STATE[t.state].label}</span>
    </button>
  );
}

/** A topic drawn as a hub with its terms around it. Each term is a button: colour says how well it is known. Wide screens only; small ones get the tiles below. */
function TopicDiagram({ name, group, bank, terms, onOpen }: { name: string; group: string; bank: string; terms: ExploreTerm[]; onOpen: (id: number) => void }) {
  const hue = topicHue(group), n = terms.length;
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / n) * 2 * Math.PI, reach = n > 8 && i % 2 ? 0.64 : 1;
    return { x: 50 + Math.cos(a) * 41 * reach, y: 50 + Math.sin(a) * 43 * reach };
  };
  return (
    <div className="relative hidden h-[430px] sm:block" role="group" aria-label={`Diagram of ${name}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="50" cy="50" rx="41" ry="43" fill="none" stroke={hue} strokeOpacity=".18" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        {terms.map((t, i) => { const p = pos(i); return <line key={t.id} x1="50" y1="50" x2={p.x} y2={p.y} stroke={STATE[t.state].color} strokeOpacity=".55" strokeWidth="2" vectorEffect="non-scaling-stroke" />; })}
      </svg>
      <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full p-2 text-center text-[#fff] shadow-lg" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}cc)` }}>
        <div><span className="mx-auto mb-1 grid place-items-center" aria-hidden><TopicIcon group={group} bank={bank} size={26} /></span><span className="block text-[11px] font-bold leading-tight">{group || "General"}</span></div>
      </div>
      {terms.map((t, i) => {
        const p = pos(i);
        return (
          <button key={t.id} type="button" onClick={() => onOpen(t.id)} title={t.meaning}
            className="absolute w-32 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-2 py-1.5 text-center text-xs font-semibold shadow-sm transition-transform hover:z-10 hover:scale-110 focus-visible:z-10"
            style={{ left: `${p.x}%`, top: `${p.y}%`, borderColor: STATE[t.state].color, background: "#fff" }}>
            <span className="block break-words">{t.term}</span>
            <span className="mt-0.5 flex justify-center"><Pips tier={t.tier} /></span>
            <span className="sr-only">, {STATE[t.state].label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TermExplorer({ terms, ceiling }: { terms: ExploreTerm[]; ceiling: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState(0);
  const [state, setState] = useState<StudyState | "">("");
  const [view, setView] = useState<"topics" | "all">("topics");
  const [topic, setTopic] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [card, setCard] = useState<RichCard | null>(null);
  const [failed, setFailed] = useState("");
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const shown = terms.filter((t) => (!rank || t.tier === rank) && (!state || t.state === state) && (!q || `${t.term} ${t.meaning} ${t.group}`.toLowerCase().includes(q)));
  const count = (list: ExploreTerm[], s: StudyState) => list.filter((t) => t.state === s).length;
  const topics = [...new Set(terms.map(keyOf))].map((key) => {
    const all = terms.filter((t) => keyOf(t) === key);
    return { key, group: all[0].group, bank: all[0].bank, all, shown: shown.filter((t) => keyOf(t) === key) };
  }).filter((g) => g.shown.length);
  const current = topics.find((g) => g.key === topic) ?? topics[0];
  // the order "previous" and "next" walk through: what is on screen
  const walk = view === "all" ? shown : (current?.shown ?? []);
  const at = walk.findIndex((t) => t.id === openId);
  const filtered = !!(q || rank || state);

  const load = (id: number) => start(async () => {
    const c = await termCardAction(id);
    if (!c) { setFailed("That term could not be opened. Reload the page."); return; }
    setCard(c);
  });
  const open = (id: number) => { setFailed(""); setCard(null); setOpenId(id); load(id); };
  const answer = (id: number, knew: boolean) => start(async () => {
    if (!(await studyAnswerAction(id, knew))) { setFailed("That answer was not saved. Try again."); return; }
    setFailed("");
    const c = await termCardAction(id);
    if (c) setCard(c);
    router.refresh(); // the charts and tiles show the new state
  });

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (openId != null && !d.open) d.showModal();
    if (openId == null && d.open) d.close();
  }, [openId]);
  useEffect(() => { dialog.current?.scrollTo({ top: 0 }); }, [openId]);

  const maxRank = Math.max(1, ...RANKS.map((_, i) => terms.filter((t) => t.tier === i + 1).length));
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-indigo-500 bg-indigo-50 text-indigo-300" : "border-black/15 bg-[#fff] text-slate-300"}`;

  return (
    <div className="space-y-5">
      {/* the two charts: both filter what is below */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-4" aria-label="Your progress">
          <h2 className="font-semibold">Your progress</h2>
          <Donut parts={STATES.map((s) => ({ label: STATE[s].label, value: count(terms, s), color: STATE[s].color }))} center={`${terms.length ? Math.round((count(terms, "known") / terms.length) * 100) : 0}%`} sub="known" />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show only">
            {STATES.map((s) => <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(state === s ? "" : s)} className={chip(state === s)}>{STATE[s].label} {count(terms, s)}</button>)}
          </div>
        </section>
        <section className="card space-y-3 p-4" aria-label="Terms by rank">
          <h2 className="font-semibold">Terms by rank <span className="text-xs font-normal text-slate-400">tap a bar to filter</span></h2>
          <div className="flex items-end gap-2">
            {RANKS.map((r, i) => {
              const of = terms.filter((t) => t.tier === i + 1), on = rank === i + 1;
              return (
                <button key={r} type="button" disabled={!of.length} aria-pressed={on} onClick={() => setRank(on ? 0 : i + 1)} className={`flex-1 rounded-lg p-1 text-center ${on ? "bg-indigo-50 ring-2 ring-indigo-500" : ""}`}
                  aria-label={`${r}: ${of.length} terms, ${count(of, "known")} known, ${count(of, "learning")} learning${i + 1 > ceiling ? ", above this level" : ""}`}>
                  <span className="block text-xs font-bold">{of.length || "–"}</span>
                  <span className="mx-auto flex h-28 w-full max-w-10 flex-col justify-end">
                    <span className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(of.length / maxRank) * 100}%`, background: of.length ? "#e7e5dc" : "transparent" }}>
                      {(["known", "learning"] as const).map((s) => <span key={s} style={{ height: `${of.length ? (count(of, s) / of.length) * 100 : 0}%`, background: STATE[s].color }} />)}
                    </span>
                  </span>
                  <span className="mt-1 block h-1 rounded-full" style={{ background: of.length ? RANK_COLOR[i] : "#e5e2d9" }} />
                  <span className="mt-1 block truncate text-[10px] text-slate-400">{r}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a term or meaning" aria-label="Find a term or meaning" className="w-full rounded-xl border border-black/20 bg-[#fff] py-2 pl-9 pr-3 text-sm" />
        </label>
        <div className="flex gap-1" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "topics"} onClick={() => setView("topics")} className={`${chip(view === "topics")} inline-flex items-center gap-1.5`}><Shapes size={13} aria-hidden />By topic</button>
          <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")} className={`${chip(view === "all")} inline-flex items-center gap-1.5`}><LayoutGrid size={13} aria-hidden />All terms</button>
        </div>
        {filtered && <button type="button" onClick={() => { setQuery(""); setRank(0); setState(""); }} className="inline-flex items-center gap-1 text-xs underline"><X size={12} aria-hidden />Clear filters</button>}
        <p className="w-full text-xs text-slate-400" aria-live="polite">{shown.length} of {terms.length} terms{rank ? ` · ${RANKS[rank - 1]}` : ""}{state ? ` · ${STATE[state].label.toLowerCase()}` : ""}</p>
      </div>

      {!shown.length && <p className="card p-6 text-center text-sm text-slate-400">No term matches. Clear the filters to see them all.</p>}

      {view === "topics" && current && (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" aria-label="Topics">
            {topics.map((g) => {
              const hue = topicHue(g.group), on = g.key === current.key, known = count(g.all, "known"), met = known + count(g.all, "learning");
              return (
                <li key={g.key}>
                  <button type="button" aria-pressed={on} onClick={() => { setTopic(g.key); requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}
                    className="card card-hover flex h-full w-full flex-col gap-2 p-3 text-left" style={on ? { borderColor: hue, boxShadow: `0 0 0 2px ${hue}` } : undefined}>
                    <span className="flex items-start justify-between gap-2">
                      <span className="grid h-11 w-11 place-items-center rounded-xl text-[#fff]" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}cc)` }} aria-hidden><TopicIcon group={g.group} bank={g.bank} size={22} /></span>
                      <span title={`${met} of ${g.all.length} started`}><Ring pct={g.all.length ? met / g.all.length : 0} size={48} label={`${g.all.length ? Math.round((met / g.all.length) * 100) : 0}%`} color={hue} /><span className="sr-only">{met} of {g.all.length} started</span></span>
                    </span>
                    <b className="text-sm leading-tight">{g.group || "General"}</b>
                    <span className="text-[11px] text-slate-400">{g.bank}</span>
                    <span className="mt-auto flex h-2 overflow-hidden rounded-full bg-black/5" aria-hidden>
                      {RANKS.map((r, i) => { const n = g.all.filter((t) => t.tier === i + 1).length; return n ? <i key={r} style={{ width: `${(n / g.all.length) * 100}%`, background: RANK_COLOR[i] }} /> : null; })}
                    </span>
                    <span className="text-[11px] text-slate-400">{g.shown.length === g.all.length ? `${g.all.length} terms` : `${g.shown.length} of ${g.all.length} terms`} · {known} known</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div ref={panel} className="card scroll-mt-4 space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{current.group || "General"} <span className="text-sm font-normal text-slate-400">{current.bank}</span></h2>
              <button type="button" className="btn" onClick={() => open(current.shown[0].id)}><BookOpen size={15} aria-hidden />Walk through these</button>
            </div>
            <TopicDiagram name={current.key} group={current.group} bank={current.bank} terms={current.shown} onOpen={open} />
            <ul className="grid gap-2 sm:hidden">{current.shown.map((t) => <li key={t.id}><Tile t={t} onOpen={() => open(t.id)} /></li>)}</ul>
            <p className="hidden flex-wrap justify-center gap-4 text-xs text-slate-400 sm:flex">
              {STATES.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATE[s].color }} />{STATE[s].label}</span>)}
              <span>Tap a term to open its card</span>
            </p>
          </div>
        </>
      )}

      {view === "all" && <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map((t) => <li key={t.id}><Tile t={t} onOpen={() => open(t.id)} /></li>)}</ul>}

      <dialog ref={dialog} onClose={() => setOpenId(null)} onClick={(e) => { if (e.target === e.currentTarget) setOpenId(null); }} aria-label="Term card"
        className="m-auto max-h-[92vh] w-[min(46rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-black/10 bg-[#fff] p-0 text-[#14161f] backdrop:bg-black/50">
        {openId != null && (
          <div>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/10 bg-[#fff] px-4 py-2">
              <button type="button" className="btn btn-ghost !px-2.5 !py-1.5" disabled={at <= 0 || pending} onClick={() => open(walk[at - 1].id)} aria-label="Previous term"><ChevronLeft size={16} /></button>
              <p className="flex-1 text-center text-xs text-slate-400">{at >= 0 ? `${at + 1} of ${walk.length}` : ""}</p>
              <button type="button" className="btn btn-ghost !px-2.5 !py-1.5" disabled={at < 0 || at >= walk.length - 1 || pending} onClick={() => open(walk[at + 1].id)} aria-label="Next term"><ChevronRight size={16} /></button>
              <button type="button" className="btn btn-ghost !px-2.5 !py-1.5" onClick={() => setOpenId(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              {card && card.id === openId ? <><TermFront card={card} /><TermBack card={card} /></> : <p className="py-16 text-center text-sm text-slate-400" role="status">Opening the card…</p>}
              {failed && <p role="alert" className="text-sm text-rose-300">{failed}</p>}
            </div>
            {card && card.id === openId && (
              <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-black/10 bg-[#fff] p-4">
                <button type="button" className="btn" disabled={pending} onClick={() => answer(card.id, true)}><Check size={16} aria-hidden />I knew it</button>
                <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => answer(card.id, false)}><RotateCcw size={16} aria-hidden />Still learning</button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}

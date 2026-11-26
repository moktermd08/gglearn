"use client";
import { useActionState, useState } from "react";
import { Check, Plus, Search, Shuffle, X } from "lucide-react";
import { startCheckAction } from "@/app/terms-actions";
import { Pips, RANK_COLOR, TopicIcon, topicHue } from "@/components/TermVisuals";
import { MAX_PICK, MIN_PICK, MIN_TIER_TESTED, RANKS } from "@/lib/termsCore";

export type PickTerm = { id: number; term: string; tier: number };
export type PickGroup = { name: string; terms: PickTerm[] };
export type PickBank = { key: string; name: string; groups: PickGroup[]; open: boolean };

const QUICK = 10, MAX_FOUND = 60;
const shuffle = <T,>(list: T[]) => list.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

/**
 * Build a check in three moves: say the rank you are trying, choose terms (by topic, by search, or let it pick), and start. Only the open topic's terms are drawn,
 * so a thousand terms stay quick. The count and the claim are checked here as you go and again on the server.
 */
export function TermPicker({ banks, defaultClaim }: { banks: PickBank[]; defaultClaim: number }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [claim, setClaim] = useState(defaultClaim);
  const [bankKey, setBankKey] = useState((banks.find((b) => b.open) ?? banks[0])?.key ?? "");
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [error, run, pending] = useActionState(startCheckAction, null);

  const all = banks.flatMap((b) => b.groups.flatMap((g) => g.terms));
  const byId = new Map(all.map((t) => [t.id, t]));
  const bank = banks.find((b) => b.key === bankKey) ?? banks[0];
  const group = bank?.groups.find((g) => g.name === groupName) ?? bank?.groups[0];
  const chosen = [...picked].map((id) => byId.get(id)).filter((t) => t !== undefined);
  const atClaim = chosen.filter((t) => t.tier === claim).length;
  const toggle = (ids: number[], on: boolean) => { setNote(""); setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; }); };
  const problem = picked.size < MIN_PICK ? `Pick at least ${MIN_PICK} terms.` : picked.size > MAX_PICK ? `Pick at most ${MAX_PICK} terms.`
    : atClaim < MIN_TIER_TESTED ? `Include at least ${MIN_TIER_TESTED} ${RANKS[claim - 1]} terms, so the check can show whether you are really at that rank.` : null;

  /** Half at the rank being tried, the rest from the ranks below it, all from the open bank. */
  const pickForMe = () => {
    const pool = bank.groups.flatMap((g) => g.terms);
    const at = shuffle(pool.filter((t) => t.tier === claim));
    if (at.length < MIN_TIER_TESTED) { setNote(`${bank.name} has too few ${RANKS[claim - 1]} terms. Choose another rank or another set.`); return; }
    const below = shuffle(pool.filter((t) => t.tier < claim));
    const first = at.slice(0, Math.max(MIN_TIER_TESTED, QUICK - below.length, QUICK / 2));
    const mix = [...first, ...below.slice(0, QUICK - first.length)];
    setNote("");
    setPicked(new Set(mix.map((t) => t.id)));
  };

  const q = query.trim().toLowerCase();
  const found = q ? all.filter((t) => t.term.toLowerCase().includes(q)) : [];
  const chip = (t: PickTerm) => {
    const on = picked.has(t.id);
    return (
      <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle([t.id], !on)}
        className={`inline-flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm ${on ? "border-indigo-500 bg-indigo-500/10 font-bold" : "border-black/10 bg-[#fff]"}`}>
        {on ? <Check size={14} aria-hidden /> : <Plus size={14} className="text-slate-400" aria-hidden />}{t.term}<Pips tier={t.tier} />
      </button>
    );
  };

  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="claimed" value={claim} />
      {[...picked].map((id) => <input key={id} type="hidden" name="term" value={id} />)}

      <fieldset className="card space-y-3 p-4">
        <legend className="sr-only">The rank you are trying</legend>
        <p className="text-sm font-bold" aria-hidden>1. The rank you are trying</p>
        <div className="grid grid-cols-5 gap-2">
          {RANKS.map((r, i) => (
            <button key={r} type="button" aria-pressed={claim === i + 1} onClick={() => { setNote(""); setClaim(i + 1); }} className={`rounded-xl border-2 p-2 text-center ${claim === i + 1 ? "bg-indigo-500/10" : "border-black/10"}`} style={claim === i + 1 ? { borderColor: RANK_COLOR[i] } : undefined}>
              <span className="flex h-8 items-end justify-center" aria-hidden><span className="w-6 rounded-t-md" style={{ height: 8 + i * 6, background: i + 1 <= claim ? RANK_COLOR[claim - 1] : "#e5e2d9" }} /></span>
              <span className="mt-1 block truncate text-[11px] font-semibold">{r}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">2. Choose terms</p>
          <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={pickForMe}><Shuffle size={14} aria-hidden />Pick {QUICK} for me</button>
        </div>
        {note && <p role="alert" className="text-sm text-amber-300">{note}</p>}
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} placeholder="Search every term" aria-label="Search every term" className="w-full rounded-xl border border-black/20 bg-[#fff] py-2 pl-9 pr-3 text-sm" />
        </label>
        {q ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400" aria-live="polite">{found.length} found{found.length > MAX_FOUND ? `, showing ${MAX_FOUND}: type more to narrow it` : ""}</p>
            <div className="flex flex-wrap gap-2">{found.slice(0, MAX_FOUND).map(chip)}</div>
          </div>
        ) : bank && group && (
          <>
            {banks.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sets of terms">
                {banks.map((b) => {
                  const n = b.groups.reduce((s, g) => s + g.terms.filter((t) => picked.has(t.id)).length, 0);
                  return <button key={b.key} type="button" aria-pressed={b.key === bank.key} onClick={() => { setNote(""); setBankKey(b.key); }} className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.key === bank.key ? "border-indigo-500 bg-indigo-500/10 text-indigo-300" : "border-black/15 text-slate-300"}`}>{b.name}{n ? ` · ${n}` : ""}</button>;
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5" role="group" aria-label={`Topics in ${bank.name}`}>
              {bank.groups.map((g) => {
                const hue = topicHue(g.name), on = g.name === group.name, n = g.terms.filter((t) => picked.has(t.id)).length;
                return (
                  <button key={g.name} type="button" aria-pressed={on} onClick={() => setGroupName(g.name)} className="card card-hover flex flex-col items-center gap-1.5 p-3 text-center" style={on ? { borderColor: hue, boxShadow: `0 0 0 2px ${hue}` } : undefined}>
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-[#fff]" style={{ background: `linear-gradient(135deg, ${hue}, ${hue}cc)` }} aria-hidden><TopicIcon group={g.name} bank={bank.name} size={20} /></span>
                    <span className="text-xs font-bold leading-tight">{g.name}</span>
                    <span className={`mt-auto rounded-full px-2 text-[11px] ${n ? "bg-indigo-500/10 font-bold text-indigo-300" : "text-slate-400"}`}>{n ? `${n} of ${g.terms.length}` : `${g.terms.length} terms`}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2 border-t border-black/10 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{group.name}</p>
                <button type="button" className="text-xs underline" onClick={() => toggle(group.terms.map((t) => t.id), !group.terms.every((t) => picked.has(t.id)))}>{group.terms.every((t) => picked.has(t.id)) ? "Clear this topic" : "Pick this whole topic"}</button>
              </div>
              <div className="flex flex-wrap gap-2">{group.terms.map(chip)}</div>
            </div>
          </>
        )}
      </div>

      <div className="card sticky bottom-2 z-10 space-y-3 p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-[1_1_14rem] space-y-1.5">
            <p aria-live="polite" className="text-sm"><b>{picked.size}</b> picked (from {MIN_PICK} to {MAX_PICK}) · <b>{atClaim}</b> at {RANKS[claim - 1]}</p>
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (picked.size / MAX_PICK) * 100)}%`, background: picked.size > MAX_PICK ? "#be123c" : picked.size >= MIN_PICK ? "#059669" : "#d97706" }} /></span>
              <span className="flex gap-1">{Array.from({ length: MIN_TIER_TESTED }, (_, i) => <i key={i} className="grid h-5 w-5 place-items-center rounded-full text-[#fff]" style={{ background: i < atClaim ? RANK_COLOR[claim - 1] : "#e5e2d9" }}>{i < atClaim && <Check size={12} />}</i>)}</span>
            </div>
          </div>
          <button className="btn" disabled={pending || problem !== null}>{pending ? "Making your check…" : "Make my check"}</button>
          {picked.size > 0 && <button type="button" className="text-xs underline" onClick={() => setPicked(new Set())}>Clear</button>}
        </div>
        {chosen.length > 0 && (
          <ul className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto" aria-label="Picked terms">
            {chosen.map((t) => <li key={t.id}><button type="button" onClick={() => toggle([t.id], false)} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-0.5 text-xs" aria-label={`Remove ${t.term}`}>{t.term}<X size={11} aria-hidden /></button></li>)}
          </ul>
        )}
        {(problem || error) && <p role="alert" className="text-sm text-amber-300">{error ?? problem}</p>}
      </div>
    </form>
  );
}

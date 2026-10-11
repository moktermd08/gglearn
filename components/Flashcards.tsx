"use client";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleHelp, CircleCheck, RotateCcw, RotateCw } from "lucide-react";

export type Card = { q: string; code?: string | null; a: string };

/** Tap-to-flip study cards with a 3D flip and a progress bar. */
export function Flashcards({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0), [flip, setFlip] = useState(false), [known, setKnown] = useState<Record<number, boolean>>({});
  if (!cards.length) return null;
  const c = cards[i];
  const go = (d: number) => { setFlip(false); setI((i + d + cards.length) % cards.length); };
  return (
    <div>
      <div className="flip-card">
        <button onClick={() => setFlip(!flip)} aria-label="Flip card" className="block w-full text-left">
          <div className={`flip-inner min-h-48 ${flip ? "flipped" : ""}`}>
            <div className="flip-face card block min-h-48 w-full p-6">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-slate-400"><CircleHelp size={14} className="text-sky-300" />Question<span className="ml-auto flex items-center gap-1 normal-case tracking-normal"><RotateCw size={12} />tap to flip</span></div>
              <div className="mt-3 text-lg font-semibold">{c.q}</div>
              {c.code && <pre className="mt-3 overflow-x-auto rounded bg-black/5 p-2 text-sm">{c.code}</pre>}
            </div>
            <div className="flip-face flip-back card min-h-48 w-full border-emerald-400/60 bg-emerald-950/40 p-6">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-emerald-300"><CircleCheck size={14} />Answer<span className="ml-auto flex items-center gap-1 normal-case tracking-normal text-slate-400"><RotateCw size={12} />tap to flip back</span></div>
              <div className="mt-3 text-lg font-semibold">{c.a}</div>
            </div>
          </div>
        </button>
      </div>
      {flip && (
        <div className="slide-in mt-3 flex justify-center gap-2">
          <button onClick={() => { setKnown({ ...known, [i]: false }); go(1); }} className="btn btn-ghost !py-1 text-sm"><RotateCcw size={15} />Review again</button>
          <button onClick={() => { setKnown({ ...known, [i]: true }); go(1); }} className="btn !py-1 text-sm !bg-emerald-600"><Check size={15} />Got it</button>
        </div>
      )}
      <div className="mt-3 flex justify-center gap-1.5" aria-label="Card progress">
        {cards.map((_, n) => <span key={n} className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-indigo-500" : "w-2"} ${known[n] === true ? "bg-emerald-500" : known[n] === false ? "bg-amber-400" : n === i ? "" : "bg-black/15"}`} />)}
      </div>
      <p className="mt-1 text-center text-xs text-slate-400">{Object.values(known).filter(Boolean).length} of {cards.length} known</p>
      <div className="bar mt-3"><i style={{ width: `${((i + 1) / cards.length) * 100}%` }} /></div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button onClick={() => go(-1)} aria-label="Previous card" className="btn btn-ghost !py-1"><ChevronLeft size={18} /></button>
        <span className="text-slate-400">{i + 1} / {cards.length}</span>
        <button onClick={() => go(1)} aria-label="Next card" className="btn btn-ghost !py-1"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

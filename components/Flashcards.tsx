"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, CircleCheck, RotateCw } from "lucide-react";

export type Card = { q: string; code?: string | null; a: string };

/** Tap-to-flip study cards with a 3D flip and a progress bar. */
export function Flashcards({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0), [flip, setFlip] = useState(false);
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
      <div className="bar mt-3"><i style={{ width: `${((i + 1) / cards.length) * 100}%` }} /></div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button onClick={() => go(-1)} aria-label="Previous card" className="btn btn-ghost !py-1"><ChevronLeft size={18} /></button>
        <span className="text-slate-400">{i + 1} / {cards.length}</span>
        <button onClick={() => go(1)} aria-label="Next card" className="btn btn-ghost !py-1"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

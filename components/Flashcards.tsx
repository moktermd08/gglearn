"use client";
import { useState } from "react";

export type Card = { q: string; code?: string | null; a: string };

/** Tap-to-flip study cards. */
export function Flashcards({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0), [flip, setFlip] = useState(false);
  if (!cards.length) return null;
  const c = cards[i];
  const go = (d: number) => { setFlip(false); setI((i + d + cards.length) % cards.length); };
  return (
    <div>
      <button onClick={() => setFlip(!flip)} aria-label="Flip card"
        className={`card pop block min-h-44 w-full p-6 text-left transition ${flip ? "border-emerald-400/60 bg-emerald-950/40" : ""}`}>
        <div className="text-xs uppercase tracking-widest text-slate-400">{flip ? "Answer" : "Question"} · tap to flip</div>
        <div className="mt-2 text-lg font-semibold">{flip ? c.a : c.q}</div>
        {!flip && c.code && <pre className="mt-3 overflow-x-auto rounded bg-black/40 p-2 text-sm">{c.code}</pre>}
      </button>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button onClick={() => go(-1)} className="btn btn-ghost !py-1">←</button>
        <span className="text-slate-400">{i + 1} / {cards.length}</span>
        <button onClick={() => go(1)} className="btn btn-ghost !py-1">→</button>
      </div>
    </div>
  );
}

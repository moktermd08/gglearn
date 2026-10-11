"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, Layers, RotateCcw, RotateCw, Trophy } from "lucide-react";
import { Ring } from "@/components/Ring";

export type Card = { q: string; code?: string | null; a: string; topic?: string | null };

/**
 * Study deck: tap or press Space to flip, then mark each card "Got it" or "Review again" (the arrow keys move between cards).
 * At the end you see how many you knew and can run the deck again, or only the ones you missed.
 */
export function Flashcards({ cards, accent = "#6366f1" }: { cards: Card[]; accent?: string }) {
  const [deck, setDeck] = useState(cards), [i, setI] = useState(0), [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<Record<number, boolean>>({}), [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const c = deck[i];
  const go = (d: number) => { setFlip(false); setI((i + d + deck.length) % deck.length); };
  const mark = (ok: boolean) => {
    const next = { ...known, [i]: ok };
    setKnown(next);
    if (i === deck.length - 1) { setDone(true); setFlip(false); } else go(1);
  };
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const key = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === " " || e.key === "Enter") { if ((e.target as HTMLElement).tagName === "BUTTON" && (e.target as HTMLElement).getAttribute("aria-label") !== "Flip card") return; e.preventDefault(); setFlip((f) => !f); }
    };
    el.addEventListener("keydown", key);
    return () => el.removeEventListener("keydown", key);
  });
  if (!cards.length) return null;

  const gotIt = Object.values(known).filter(Boolean).length;
  const restart = (only?: boolean) => {
    const next = only ? deck.filter((_, n) => known[n] === false || known[n] === undefined) : cards;
    setDeck(next.length ? next : cards); setKnown({}); setI(0); setFlip(false); setDone(false);
  };

  if (done) {
    const pct = gotIt / deck.length, missed = deck.length - gotIt;
    return (
      <div className="card pop space-y-4 p-6 text-center" style={{ background: `linear-gradient(135deg, ${accent}1f, #fff 60%)` }}>
        <div className="flex justify-center"><Ring pct={pct} label={`${gotIt}/${deck.length}`} sub="known" size={120} color={pct === 1 ? "#10b981" : pct >= 0.5 ? "#f59e0b" : "#f43f5e"} /></div>
        <h3 className="flex items-center justify-center gap-2 text-xl font-extrabold">{pct === 1 ? <><Trophy className="text-amber-400" />Deck mastered</> : <><Layers style={{ color: accent }} />{missed} to go over again</>}</h3>
        <p className="text-sm text-slate-400">{pct === 1 ? "Every card felt solid. You are ready for the exam." : "Running the missed ones again is the fastest way to lock them in."}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {missed > 0 && <button onClick={() => restart(true)} className="btn"><RotateCcw size={15} />Review the {missed} missed</button>}
          <button onClick={() => restart()} className="btn btn-ghost"><RotateCw size={15} />Start the deck again</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={box} className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold">Card {i + 1} of {deck.length}</span>
        <span className="flex items-center gap-1"><Check size={13} className="text-emerald-400" />{gotIt} known</span>
      </div>
      <div className="flex gap-1" aria-label="Deck progress">
        {deck.map((_, n) => <i key={n} className="h-1.5 flex-1 rounded-full transition-all" style={{ background: known[n] === true ? "#10b981" : known[n] === false ? "#f59e0b" : n === i ? accent : "rgba(20,22,31,.12)" }} />)}
      </div>

      <div className="flip-card">
        <button onClick={() => setFlip(!flip)} aria-label="Flip card" className="block w-full text-left">
          <div className={`flip-inner min-h-60 ${flip ? "flipped" : ""}`}>
            <div className="flip-face card relative block min-h-60 w-full overflow-hidden p-6" style={{ background: `linear-gradient(145deg, ${accent}14, #fff 55%)` }}>
              <span className="pointer-events-none absolute -right-2 -top-6 select-none text-[120px] font-black leading-none" style={{ color: accent, opacity: 0.08 }} aria-hidden>{i + 1}</span>
              <div className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: accent }}><span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: `${accent}22` }}><CircleHelp size={14} /></span>Question{c.topic && <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300">{c.topic}</span>}</div>
              <div className="relative mt-4 text-xl font-semibold leading-snug">{c.q}</div>
              {c.code && <pre className="relative mt-3 overflow-x-auto rounded-lg bg-black/5 p-3 text-sm">{c.code}</pre>}
              <span className="absolute bottom-3 right-4 flex items-center gap-1 text-[11px] text-slate-500"><RotateCw size={11} />tap or press Space to reveal</span>
            </div>
            <div className="flip-face flip-back card min-h-60 w-full overflow-hidden border-emerald-400/50 p-6" style={{ background: "linear-gradient(145deg, rgba(16,185,129,.16), #fff 60%)" }}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20"><CircleCheck size={14} /></span>Answer</div>
              <div className="mt-4 text-xl font-semibold leading-snug">{c.a}</div>
              <span className="absolute bottom-3 right-4 flex items-center gap-1 text-[11px] text-slate-500"><RotateCw size={11} />tap to flip back</span>
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => go(-1)} aria-label="Previous card" className="btn btn-ghost !px-3 !py-2"><ChevronLeft size={18} /></button>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <button onClick={() => mark(false)} disabled={!flip} className="btn btn-ghost !justify-center !py-2 disabled:opacity-40"><RotateCcw size={15} />Review again</button>
          <button onClick={() => mark(true)} disabled={!flip} className="btn !justify-center !bg-emerald-600 !py-2 disabled:opacity-40"><Check size={15} />Got it</button>
        </div>
        <button onClick={() => go(1)} aria-label="Next card" className="btn btn-ghost !px-3 !py-2"><ChevronRight size={18} /></button>
      </div>
      <p className="text-center text-[11px] text-slate-500">Reveal the answer first, then say how it went. Arrow keys move between cards.</p>
    </div>
  );
}

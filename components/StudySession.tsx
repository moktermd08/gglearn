"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { studyAnswerAction } from "@/app/terms-actions";

export type Card = { id: number; term: string; meaning: string; tier: number; group: string; facts: string[]; useWhen: string; mistakes: string[]; similar: string[]; fresh: boolean };

const RANKS = ["Initiate", "Adept", "Expert", "Master", "Titan"];

/** One study sitting: a card at a time. You try to recall the term's meaning, reveal it, and say whether you knew it. Each answer is saved as it is given. */
export function StudySession({ cards, listHref, againHref }: { cards: Card[]; listHref: string; againHref: string }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [knew, setKnew] = useState(0);
  const [again, setAgain] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const done = i >= cards.length;
  const card = cards[i];

  const answer = (k: boolean) => start(async () => {
    const ok = await studyAnswerAction(card.id, k);
    if (!ok) { setFailed(true); return; }
    setFailed(false);
    if (k) setKnew((n) => n + 1); else setAgain((n) => n + 1);
    setShown(false);
    setI((n) => n + 1);
  });

  if (done) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <h2 className="text-xl font-bold">That is this round</h2>
        <p className="text-sm text-slate-300">{cards.length} terms: <b className="text-emerald-700">{knew} knew</b> · <b className="text-amber-700">{again} to see again</b>. Terms you knew come back later; the others come back soon.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={againHref} className="btn">Another round</Link>
          <Link href={listHref} className="btn btn-ghost">Back to the list</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500" aria-live="polite">Card {i + 1} of {cards.length} · {card.fresh ? "new" : "coming round again"}</p>
      <div className="card space-y-3 p-6">
        <p className="text-xs text-slate-500">{RANKS[card.tier - 1]}{card.group ? ` · ${card.group}` : ""}</p>
        <h2 className="text-2xl font-extrabold">{card.term}</h2>
        {!shown ? (
          <>
            <p className="text-sm text-slate-300">What does it mean? Say it to yourself, then check.</p>
            <button className="btn" onClick={() => setShown(true)}>Show the answer</button>
          </>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-base">{card.meaning}</p>
            {card.facts.length > 0 && <ul className="list-disc space-y-1 pl-5 text-slate-700">{card.facts.map((f) => <li key={f}>It {f.replace(/^it /i, "")}</li>)}</ul>}
            {card.useWhen && <p className="text-slate-700"><b>You would use it when you</b> {card.useWhen}.</p>}
            {card.similar.length > 0 && <p className="text-slate-700"><b>Easy to mix up with:</b> {card.similar.join(", ")}.</p>}
            {card.mistakes.length > 0 && <p className="text-amber-800"><b>Common mistake:</b> thinking it {card.mistakes[0].replace(/^it /i, "")}. That is wrong.</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              <button className="btn" disabled={pending} onClick={() => answer(true)}>I knew it</button>
              <button className="btn btn-ghost" disabled={pending} onClick={() => answer(false)}>Still learning</button>
            </div>
            {failed && <p role="alert" className="text-rose-600">That answer was not saved. Try again.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

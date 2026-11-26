"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Check, Eye, RotateCcw, Trophy } from "lucide-react";
import { studyAnswerAction } from "@/app/terms-actions";
import { Donut } from "@/components/charts";
import { TermBack, TermFront } from "@/components/TermCard";
import type { RichCard } from "@/lib/termDetails";

/** One study sitting: a card at a time. You try to recall the term's meaning, reveal it, and say whether you knew it. Each answer is saved as it is given. */
export function StudySession({ cards, listHref, againHref }: { cards: RichCard[]; listHref: string; againHref: string }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [knew, setKnew] = useState(0);
  const [again, setAgain] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const done = i >= cards.length;
  const card = cards[i];

  const answer = (k: boolean) => start(async () => {
    const ok = await studyAnswerAction(card.id, k);
    if (!ok) { setFailed(true); return; }
    setFailed(false);
    if (k) setKnew((n) => n + 1); else setAgain((n) => n + 1);
    setShown(false);
    setI((n) => n + 1);
    top.current?.scrollIntoView({ block: "start" }); // the next card starts at its top, however far down this one was read
  });

  if (done) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <Trophy size={34} className="mx-auto text-amber-400" aria-hidden />
        <h2 className="text-xl font-bold">That is this round</h2>
        <div className="flex justify-center">
          <Donut parts={[{ label: "Knew", value: knew, color: "#059669" }, { label: "To see again", value: again, color: "#d97706" }]} center={cards.length} sub="terms" />
        </div>
        <p className="text-sm text-slate-300">{cards.length} terms: <b className="text-emerald-300">{knew} knew</b> · <b className="text-amber-300">{again} to see again</b>. Terms you knew come back later; the others come back soon.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={againHref} className="btn">Another round</Link>
          <Link href={listHref} className="btn btn-ghost">Back to the list</Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={top} className="scroll-mt-4 space-y-3">
      <div className="space-y-1">
        <p className="text-xs text-slate-500" aria-live="polite">Card {i + 1} of {cards.length} · {card.fresh ? "new" : "coming round again"}</p>
        <div className="flex gap-1" aria-hidden>{cards.map((c, n) => <i key={c.id} className="h-1.5 flex-1 rounded-full" style={{ background: n < i ? "#059669" : n === i ? "#4f46e5" : "#e5e2d9" }} />)}</div>
      </div>
      <div key={card.id} className="card space-y-4 p-5 sm:p-6">
        <TermFront card={card} />
        {!shown ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">What does it mean? Say it to yourself, then check.</p>
            <button className="btn" onClick={() => setShown(true)}><Eye size={16} aria-hidden />Show the answer</button>
          </div>
        ) : (
          <>
            <TermBack card={card} />
            {/* stays in reach however long the card is */}
            <div className="sticky bottom-0 -mx-5 -mb-5 space-y-2 rounded-b-2xl border-t border-black/10 bg-[#fff] p-4 sm:-mx-6 sm:-mb-6">
              <div className="flex flex-wrap gap-3">
                <button className="btn" disabled={pending} onClick={() => answer(true)}><Check size={16} aria-hidden />I knew it</button>
                <button className="btn btn-ghost" disabled={pending} onClick={() => answer(false)}><RotateCcw size={16} aria-hidden />Still learning</button>
              </div>
              {failed && <p role="alert" className="text-sm text-rose-300">That answer was not saved. Try again.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

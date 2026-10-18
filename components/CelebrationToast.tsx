"use client";
import { useEffect, useState, startTransition } from "react";
import { Award, Crown, Medal, PartyPopper, Share2, Sparkles, X } from "lucide-react";
import { Confetti } from "@/components/Confetti";
import { dismissCelebration, shareCelebration } from "@/app/(site)/share/actions";
import type { Celebration } from "@/lib/celebrate";

const ICON = { badge: Award, level: Sparkles, league: Crown, season: Medal } as const;
// plain hex colours, as the rest of the app uses: this theme remaps the Tailwind "white"
const TONE = { gold: "rgba(251,191,36,.28)", indigo: "rgba(99,102,241,.22)", orange: "rgba(251,146,60,.26)", silver: "rgba(148,163,184,.28)" } as const;

/** A one-time "you did it" with a one-tap share. It stays until dismissed or shared, then never returns. */
export function CelebrationToast({ c }: { c: Celebration }) {
  const [open, setOpen] = useState(true), [burst, setBurst] = useState(true);
  useEffect(() => { const t = setTimeout(() => setBurst(false), 4500); return () => clearTimeout(t); }, []);
  if (!open) return null;
  const Icon = ICON[c.share.kind] ?? PartyPopper;
  return (
    <>
      {burst && <Confetti count={45} />}
      <div role="status" aria-label="Celebration" className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md sm:inset-x-auto sm:right-4">
        <div className="pop relative overflow-hidden rounded-2xl border border-black/10 p-4 shadow-2xl ring-1 ring-black/5" style={{ background: `linear-gradient(135deg, ${TONE[c.tone]}, #fff 70%)` }}>
          <button type="button" aria-label="Dismiss" onClick={() => { setOpen(false); startTransition(async () => { await dismissCelebration(c.id); }); }} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-black/5"><X size={15} /></button>
          <div className="flex items-start gap-3 pr-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/25 text-amber-600"><Icon size={22} /></span>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{c.headline}</div>
              <div className="font-extrabold leading-tight">{c.title}</div>
              {c.body && <p className="mt-0.5 text-sm text-slate-400">{c.body}</p>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <form action={() => { startTransition(async () => { await shareCelebration(c.id, c.share.kind, c.share.ref); }); }}>
              <button className="btn !py-1.5 text-sm"><Share2 size={14} />Share it</button>
            </form>
            <button type="button" onClick={() => { setOpen(false); startTransition(async () => { await dismissCelebration(c.id); }); }} className="text-sm text-slate-400 underline">Not now</button>
          </div>
        </div>
      </div>
    </>
  );
}

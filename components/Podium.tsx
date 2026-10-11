import type { ReactNode } from "react";
import { Crown, Flag } from "lucide-react";

export type PodiumPlace = { rank: number; name: string; gained: number; target: number; xp: number; reached: boolean; isBot: boolean; avatar: ReactNode };

const STYLE = [
  { h: 96, grad: "linear-gradient(180deg,#fde68a,#f59e0b)", ring: "#f59e0b", ink: "#78350f" }, // 1st
  { h: 72, grad: "linear-gradient(180deg,#e2e8f0,#94a3b8)", ring: "#94a3b8", ink: "#334155" }, // 2nd
  { h: 56, grad: "linear-gradient(180deg,#fed7aa,#ea8a3c)", ring: "#ea8a3c", ink: "#7c2d12" }, // 3rd
] as const;

/** The top three on pedestals, first place in the middle. Anyone can be missing (a contest with two people shows two). */
export function Podium({ places }: { places: PodiumPlace[] }) {
  const byRank = (r: number) => places.find((p) => p.rank === r);
  const order = [byRank(2), byRank(1), byRank(3)].filter((p): p is PodiumPlace => !!p);
  return (
    <div className="mx-auto grid max-w-md items-end gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, order.length)}, minmax(0, 1fr))` }} role="list" aria-label="Top three">
      {order.map((p, col) => {
        const st = STYLE[Math.min(2, p.rank - 1)];
        return (
          <div key={`place-${p.rank}`} role="listitem" className="rise flex min-w-0 flex-col items-center text-center" style={{ "--i": col } as React.CSSProperties}>
            <div className="relative">
              {p.rank === 1 && <Crown size={22} className="pulse-glow absolute -top-5 left-1/2 -translate-x-1/2 text-amber-400" fill="#fbbf24" aria-hidden />}
              <div className="rounded-full p-0.5" style={{ boxShadow: `0 0 0 3px ${st.ring}` }}>{p.avatar}</div>
            </div>
            <div className="mt-2 w-full truncate px-1 text-sm font-bold">{p.name}</div>
            <div className="mb-1.5 flex items-center gap-1 text-[11px] text-slate-400">{p.reached ? <><Flag size={11} className="text-emerald-400" />goal reached</> : <>+{p.gained} of {p.target} levels</>}{p.isBot && <span className="rounded bg-violet-500/15 px-1 text-[9px] font-bold uppercase text-violet-300">bot</span>}</div>
            <div className="grid w-full place-items-center rounded-t-2xl text-3xl font-black" style={{ height: st.h, background: st.grad, color: st.ink }}>{p.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

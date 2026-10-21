import { Check, Flag, MapPin } from "lucide-react";

export type MapNode = { title: string; sub?: string; state: "here" | "done" | "next" | "later"; goal?: boolean };

/**
 * The whole route at a glance: where you are, each stage on the way, and the goal at the end. Done stages are green and joined by a solid line,
 * the next stage pulses, the rest are faded and dashed. Scrolls sideways inside its card when the route is long.
 */
export function JourneyMap({ nodes, goalLabel }: { nodes: MapNode[]; goalLabel: string }) {
  return (
    <div tabIndex={0} role="region" aria-label="Your journey map" className="relative overflow-x-auto pb-1">
      <ol className="flex min-w-max items-start px-1" aria-label="Route">
        {nodes.map((n, i) => {
          const last = i === nodes.length - 1, joinSolid = n.state === "here" || n.state === "done";
          const tone = n.state === "done" ? "border-emerald-500 bg-emerald-500 text-[#fff]" : n.state === "here" ? "border-sky-400 bg-sky-500 text-[#fff]" : n.state === "next" ? "border-violet-500 bg-[#fff] text-violet-300 shadow-[0_0_0_5px_rgba(139,92,246,.18)]" : "border-black/15 bg-[#fff] text-slate-400";
          return (
            <li key={`${i}-${n.title}`} className="relative flex w-36 shrink-0 flex-col items-center px-1 text-center" aria-current={n.state === "next" ? "step" : undefined}>
              {!last && <span className={`absolute left-1/2 top-[19px] h-0.5 w-full ${joinSolid ? "bg-emerald-400" : "border-t-2 border-dashed border-black/20"}`} aria-hidden />}
              <span className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-extrabold ${tone} ${n.state === "next" ? "pulse-glow" : ""}`}>
                {n.state === "here" ? <MapPin size={18} /> : n.state === "done" ? <Check size={18} /> : n.goal ? <Flag size={17} /> : i}
              </span>
              {n.state === "here" && <span className="mt-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-300">You are here</span>}
              {n.state === "next" && <span className="mt-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-300">Next</span>}
              {n.goal && n.state !== "here" && <span className="mt-1 rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-pink-300">{goalLabel}</span>}
              <span className={`mt-1 line-clamp-2 text-xs font-semibold leading-tight ${n.state === "later" ? "text-slate-400" : ""}`}>{n.title}</span>
              {n.sub && <span className="mt-0.5 text-[11px] text-slate-400">{n.sub}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

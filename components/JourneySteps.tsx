import { Check, Flag, Gauge, Swords, Target, Users } from "lucide-react";

const STEPS = [
  { name: "Goal", Icon: Target },
  { name: "Who", Icon: Users },
  { name: "Level check", Icon: Gauge },
  { name: "Finish line", Icon: Flag },
  { name: "Race", Icon: Swords },
] as const;

/** Where you are in the guided start. `at` is 1-based. */
export function JourneySteps({ at }: { at: number }) {
  return (
    <div className="space-y-2">
      <div className="bar !h-1.5" aria-hidden><i style={{ width: `${(at / STEPS.length) * 100}%` }} /></div>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Progress">
        {STEPS.map(({ name, Icon }, i) => (
          <li key={name} aria-current={i + 1 === at ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-bold transition ${i + 1 === at ? "pop bg-indigo-500/30 text-indigo-200" : i + 1 < at ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/10 text-slate-500"}`}>
            {i + 1 < at ? <Check size={13} /> : <Icon size={13} />}{name}
          </li>
        ))}
      </ol>
    </div>
  );
}

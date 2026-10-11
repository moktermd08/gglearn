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
    <ol className="grid grid-cols-5 gap-1 text-center text-[11px] font-bold" aria-label="Progress">
      {STEPS.map(({ name, Icon }, i) => {
        const done = i + 1 < at, here = i + 1 === at;
        return (
          <li key={name} aria-current={here ? "step" : undefined} className="relative flex flex-col items-center gap-1">
            {i > 0 && <span className={`absolute right-1/2 top-[18px] h-0.5 w-full ${i + 1 <= at ? "bg-emerald-400" : "bg-black/10"}`} aria-hidden />}
            <span className={`relative grid h-9 w-9 place-items-center rounded-full border-2 transition ${here ? "pop border-indigo-500 bg-indigo-500 text-[#fff] shadow-[0_0_0_4px_rgba(99,102,241,.2)]" : done ? "border-emerald-500 bg-emerald-500 text-[#fff]" : "border-black/15 bg-[#fff] text-slate-500"}`}>{done ? <Check size={16} /> : <Icon size={16} />}</span>
            <span className={here ? "text-indigo-300" : done ? "text-emerald-300" : "text-slate-500"}>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}

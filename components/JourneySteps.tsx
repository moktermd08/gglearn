const STEPS = ["Goal", "Who", "Level check", "Finish line", "Race"] as const;

/** Where you are in the guided start. `at` is 1-based. */
export function JourneySteps({ at }: { at: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i + 1 === at ? "step" : undefined}
          className={`flex items-center gap-2 rounded-full px-3 py-1 font-bold ${i + 1 === at ? "bg-indigo-500/30 text-indigo-200" : i + 1 < at ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/10 text-slate-500"}`}>
          <span>{i + 1 < at ? "✓" : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  );
}

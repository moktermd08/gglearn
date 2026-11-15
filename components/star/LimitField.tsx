"use client";
import { useState } from "react";
import { LIMIT_UNITS, type LimitUnit } from "@/lib/star/framework";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";

/** The limit an advert sets for each answer: a number and whether it counts words or characters. Switching the unit swaps in that unit's usual number, unless the person has typed their own. */
export function LimitField({ unit: u0, limit: n0 }: { unit: LimitUnit; limit: number }) {
  const [unit, setUnit] = useState<LimitUnit>(u0);
  const [n, setN] = useState(String(n0));
  const change = (next: LimitUnit) => {
    const usual = LIMIT_UNITS.map((x) => String(x.fallback));
    if (usual.includes(n)) setN(String(LIMIT_UNITS.find((x) => x.key === next)!.fallback));
    setUnit(next);
  };
  const info = LIMIT_UNITS.find((x) => x.key === unit)!;
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-semibold text-slate-500">Limit for each behaviour</legend>
      <div className="flex gap-2">
        <input name="wordLimit" type="number" inputMode="numeric" min={info.min} max={info.max} value={n} onChange={(e) => setN(e.target.value)} aria-label="Limit" className={`${field} w-28`} />
        <select name="limitUnit" value={unit} onChange={(e) => change(e.target.value as LimitUnit)} aria-label="Counted in" className={field}>
          {LIMIT_UNITS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-500">Use what the advert says. Many ask for about 250 words, some for about 1,250 characters.</p>
    </fieldset>
  );
}

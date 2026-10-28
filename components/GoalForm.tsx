import { ArrowRight } from "lucide-react";
import { setCareerGoal } from "@/app/actions";
import { dateBounds, levelCode, type Goal, type Target } from "@/lib/journey";

const input = "rounded border border-white/20 bg-[#fff] px-2 py-1";
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/** Pick a role and level to aim for, and a date. Only places the person can actually reach are offered. */
export function GoalForm({ targets, goal, hereRole }: { targets: Target[]; goal: Goal | null; hereRole: string }) {
  const { tomorrow, nextYear } = dateBounds();
  return (
    <form action={setCareerGoal} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="grid gap-1">
        <span className="text-xs text-slate-400">I want to become</span>
        <select name="target" required defaultValue={goal ? `${goal.targetRole}|${goal.targetLevel}` : undefined} className={`${input} min-w-64`}>
          {!goal && <option value="">Choose a role and level…</option>}
          {targets.map((t) => (
            <optgroup key={t.role} label={t.role === hereRole ? `${t.label} (your path)` : t.label}>
              {t.levels.map((l) => <option key={l.level} value={`${t.role}|${l.level}`}>{l.title} ({levelCode(l.level)})</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-slate-400">by</span>
        <input type="date" name="date" required min={tomorrow} defaultValue={goal ? iso(goal.targetDate) : nextYear} className={input} />
      </label>
      <button className="btn">{goal ? "Update goal" : "Plan my journey"}<ArrowRight size={15} /></button>
    </form>
  );
}

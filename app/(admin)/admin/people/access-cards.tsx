"use client";
import { useId } from "react";
import { GraduationCap, Shield, UserCog } from "lucide-react";
import type { Level } from "@/lib/accessLevel";

export type AccessChoice = { key: Level; label: string; blurb: string };

const ICON = { learner: GraduationCap, manager: UserCog, admin: Shield } as const;
export const LEARNER: AccessChoice = { key: "learner", label: "Learner", blurb: "Learns and takes the exams. No admin screens." };
const PLAIN: Record<Level, string> = {
  learner: LEARNER.blurb,
  manager: "Runs the people in their places: invites and onboards learners, sees who is up to date.",
  admin: "Everything a manager does, plus tracks, what is required, rewards, tool access and managers.",
};

/**
 * What they can do in the academy, as cards. Learner always; Manager and Admin only when the signed-in person may hand them out (`choices` comes from
 * grantableLevels on the server), so a manager sees a single card and a note. `forceLearner` is for customers and team links, which can never carry more.
 */
export function AccessCards({ choices, value, onChange, forceLearner, why }: { choices: AccessChoice[]; value: Level; onChange: (l: Level) => void; forceLearner?: boolean; why?: string }) {
  const group = useId(); // each set of cards is its own radio group, so two on one page (the add panel and the edit panel) never share a choice
  const all = [LEARNER, ...choices.map((c) => ({ ...c, blurb: PLAIN[c.key] }))];
  const locked = !!forceLearner;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold">What can they do on gglearn?</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {all.map((c) => {
          const Icon = ICON[c.key], on = (locked ? "learner" : value) === c.key, off = locked && c.key !== "learner";
          return (
            <label key={c.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${on ? "border-indigo-500 bg-indigo-500/10" : "border-black/10 hover:bg-black/5"} ${off ? "cursor-not-allowed opacity-50" : ""}`}>
              <input type="radio" name={group} value={c.key} checked={on} disabled={off} onChange={() => onChange(c.key)} className="mt-1" />
              <span><span className="flex items-center gap-1.5 font-semibold"><Icon size={14} aria-hidden />{c.label}</span><span className="block text-xs text-slate-400">{c.blurb}</span></span>
            </label>
          );
        })}
      </div>
      {(why || (!choices.length && !locked)) && <p className="text-xs text-slate-500">{why ?? "Only an admin can give manager access, so new people join as learners."}</p>}
    </fieldset>
  );
}

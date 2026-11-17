"use client";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";
import { KeepForm } from "@/components/star/KeepForm";
import { saveStoryAction } from "@/app/star-actions";
import { reviewStory } from "@/lib/star/coach";
import { BEHAVIOURS, PARTS, STORY_LIMITS, wordCount, type BehaviourKey } from "@/lib/star/framework";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";
const lab = "block space-y-1 text-xs font-semibold text-slate-500";

type Init = { id?: number; title: string; context: string; situation: string; task: string; action: string; result: string; behaviours: BehaviourKey[]; ready: boolean };

/** The story editor: four boxes with what to write in each, the behaviours it shows, and advice that updates as the person types. Nothing is sent until they save. */
export function StoryForm({ init, suggested }: { init: Init; suggested?: BehaviourKey }) {
  const [t, setT] = useState({ situation: init.situation, task: init.task, action: init.action, result: init.result });
  const [picked, setPicked] = useState<BehaviourKey[]>(init.behaviours.length ? init.behaviours : suggested ? [suggested] : []);
  const r = reviewStory(t);
  const toggle = (k: BehaviourKey) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= STORY_LIMITS.behaviours ? p : [...p, k]));
  return (
    <KeepForm action={saveStoryAction} className="space-y-4">
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className={lab}>Title (only you see it)<input name="title" required maxLength={STORY_LIMITS.title} defaultValue={init.title} placeholder="Cutting call waits at the contact centre" className={field} /></label>
        <label className={lab}>Where and when (optional)<input name="context" maxLength={STORY_LIMITS.context} defaultValue={init.context} placeholder="Contact centre, 2024" className={field} /></label>
      </div>

      {PARTS.map((p) => (
        <div key={p.key} className="space-y-1">
          <label htmlFor={`f-${p.key}`} className="flex items-baseline gap-2 text-sm font-bold"><span className="grid h-6 w-6 place-items-center rounded-md bg-indigo-500/10 text-xs text-indigo-700">{p.letter}</span>{p.title}<span className="text-xs font-normal text-slate-500">{p.share} of the story · {wordCount(t[p.key])} words</span></label>
          <p id={`h-${p.key}`} className="text-xs text-slate-500">{p.ask}</p>
          <textarea id={`f-${p.key}`} aria-describedby={`h-${p.key}`} name={p.key} rows={p.key === "action" ? 7 : 3} maxLength={STORY_LIMITS.part} value={t[p.key]} onChange={(e) => setT({ ...t, [p.key]: e.target.value })} placeholder={`For example: ${p.example}`} className={field} />
          {r.tips.filter((x) => x.part === p.key).map((x) => (
            <p key={x.text} className={`flex gap-1.5 text-xs ${x.level === "fix" ? "text-rose-700" : "text-amber-700"}`}>{x.level === "fix" ? <AlertCircle size={14} className="mt-px shrink-0" aria-hidden /> : <Lightbulb size={14} className="mt-px shrink-0" aria-hidden />}<span>{x.text}</span></p>
          ))}
        </div>
      ))}

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-bold">Which behaviours does this show?</legend>
        <p className="text-xs text-slate-500">Pick up to {STORY_LIMITS.behaviours}. The same story can answer different behaviours when you tell it with a different emphasis.</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {BEHAVIOURS.map((b) => (
            <label key={b.key} className="flex items-start gap-2 rounded-lg border border-black/10 p-2 text-sm has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
              <input type="checkbox" name="behaviours" value={b.key} checked={picked.includes(b.key)} onChange={() => toggle(b.key)} className="mt-1" />
              <span><span className="font-semibold">{b.title}</span><span className="block text-xs text-slate-500">{b.gist}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-black/10 bg-slate-50 p-3 text-sm" aria-live="polite">
        <p className="flex items-center gap-2 font-semibold">{r.ready ? <CheckCircle2 size={16} className="text-emerald-600" aria-hidden /> : <AlertCircle size={16} className="text-amber-600" aria-hidden />}{r.words} words in all · strength {r.score}/100</p>
        {r.tips.filter((x) => x.part === "whole").map((x) => <p key={x.text} className="mt-1 text-xs text-slate-600">{x.text}</p>)}
        <p className="mt-1 text-xs text-slate-500">This is simple advice from fixed checks, not a mark. Assessors read the real thing, so use it as a prompt, not a rule.</p>
      </div>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ready" defaultChecked={init.ready} />This story is ready to use in an application</label>
      <button className="btn !py-1.5 text-sm">{init.id ? "Save story" : "Create story"}</button>
    </KeepForm>
  );
}

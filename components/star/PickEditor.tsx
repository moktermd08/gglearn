"use client";
import { useState } from "react";
import { CvForm } from "@/components/cv/CvForms";
import { savePickAction } from "@/app/star-actions";
import { composeAnswer, wordCount, type StoryText } from "@/lib/star/framework";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";

type StoryOpt = { id: number; title: string; tagged: boolean; ready: boolean; text: StoryText };

/** For one behaviour of one application: pick the story, then tailor the words to this job with a live word count against the limit. */
export function PickEditor({ applicationId, behaviour, title, gist, stories, storyId, answer, limit }: { applicationId: number; behaviour: string; title: string; gist: string; stories: StoryOpt[]; storyId: number | null; answer: string; limit: number }) {
  const [sid, setSid] = useState<number | null>(storyId);
  const [text, setText] = useState(answer || (storyId ? composeAnswer(stories.find((s) => s.id === storyId)?.text ?? { situation: "", task: "", action: "", result: "" }) : ""));
  const words = wordCount(text), over = words - limit;
  const choose = (v: string) => {
    const n = v ? Number(v) : null;
    setSid(n);
    const s = stories.find((x) => x.id === n);
    if (s && (!text.trim() || window.confirm("Replace the wording below with this story as written?"))) setText(composeAnswer(s.text));
  };
  return (
    <CvForm action={savePickAction} className="card space-y-2 p-4">
      <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="behaviour" value={behaviour} />
      <div><h3 className="font-bold">{title}</h3><p className="text-xs text-slate-500">{gist}</p></div>
      <label className="block space-y-1 text-xs font-semibold text-slate-500">Story
        <select name="storyId" value={sid ?? ""} onChange={(e) => choose(e.target.value)} className={field}>
          <option value="">{stories.length ? "Choose a story…" : "You have no stories yet"}</option>
          {stories.map((s) => <option key={s.id} value={s.id}>{s.title}{s.tagged ? "" : " (not tagged for this behaviour)"}{s.ready ? "" : " (draft)"}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-xs font-semibold text-slate-500">Your answer for this job (tailor it: use the words of the advert where they are true)
        <textarea name="answer" rows={9} value={text} onChange={(e) => setText(e.target.value)} className={field} />
      </label>
      <p className={`text-xs ${over > 0 ? "font-semibold text-rose-700" : "text-slate-500"}`} aria-live="polite">{words} / {limit} words{over > 0 ? `: ${over} over the limit` : ""}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn !py-1.5 text-sm">Save</button>
        <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => void navigator.clipboard?.writeText(text)}>Copy text</button>
        <button name="reset" value="1" className="btn btn-ghost !py-1.5 text-sm" title="Go back to the story as written">Use story as written</button>
      </div>
    </CvForm>
  );
}

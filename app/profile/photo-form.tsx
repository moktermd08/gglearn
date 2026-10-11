"use client";
import { useActionState, useRef, useState } from "react";
import { Check, ImagePlus, TriangleAlert, Upload } from "lucide-react";
import { setPhoto, type PhotoState } from "./actions";

/** Pick a photo, see it before it is saved, then upload. Same server action and limits as before. */
export default function PhotoForm() {
  const [state, run, pending] = useActionState<PhotoState, FormData>(setPhoto, null);
  const [preview, setPreview] = useState<string | null>(null), [name, setName] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form action={run} className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-black/15 bg-[#fff] px-3 py-2.5 transition hover:border-indigo-400">
          {preview
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the file the person just picked
            ? <img src={preview} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><ImagePlus size={18} /></span>}
          <span className="min-w-0"><span className="block truncate font-semibold">{name ?? "Choose a photo"}</span><span className="block text-xs text-slate-400">JPEG, PNG or WebP, up to 300 KB</span></span>
          <input ref={input} name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; setName(f?.name ?? null); setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : null; }); }} />
        </label>
        <button disabled={pending || !name} className="btn !py-2 disabled:opacity-50"><Upload size={14} />{pending ? "Uploading…" : "Upload photo"}</button>
      </div>
      {state?.error && <p role="alert" className="slide-in flex items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      {state?.ok && <p className="pop flex items-center gap-1.5 text-emerald-300"><Check size={14} />Photo saved.</p>}
    </form>
  );
}

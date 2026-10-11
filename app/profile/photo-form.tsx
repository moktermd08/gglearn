"use client";
import { useActionState } from "react";
import { Check, TriangleAlert, Upload } from "lucide-react";
import { setPhoto, type PhotoState } from "./actions";

export default function PhotoForm() {
  const [state, run, pending] = useActionState<PhotoState, FormData>(setPhoto, null);
  return (
    <form action={run} className="space-y-2 text-sm">
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="block text-slate-300" />
      <button disabled={pending} className="btn !py-1.5 disabled:opacity-50"><Upload size={14} />{pending ? "Uploading…" : "Upload photo"}</button>
      {state?.error && <p role="alert" className="slide-in flex items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state.error}</p>}
      {state?.ok && <p className="pop flex items-center gap-1.5 text-emerald-300"><Check size={14} />Photo saved.</p>}
    </form>
  );
}

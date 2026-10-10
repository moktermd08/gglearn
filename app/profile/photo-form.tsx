"use client";
import { useActionState } from "react";
import { setPhoto, type PhotoState } from "./actions";

export default function PhotoForm() {
  const [state, run, pending] = useActionState<PhotoState, FormData>(setPhoto, null);
  return (
    <form action={run} className="space-y-2 text-sm">
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="block text-slate-300" />
      <button disabled={pending} className="btn !py-1.5 disabled:opacity-50">Upload photo</button>
      {state?.error && <p role="alert" className="text-rose-400">{state.error}</p>}
      {state?.ok && <p className="text-emerald-300">Photo saved.</p>}
    </form>
  );
}

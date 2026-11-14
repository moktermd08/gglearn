"use client";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { unlockCv, type Unlock } from "./actions";

export function UnlockForm({ token, name }: { token: string; name: string }) {
  const [state, run, pending] = useActionState<Unlock, FormData>(unlockCv.bind(null, token), null);
  return (
    <form action={run} className="mx-auto max-w-sm space-y-3 rounded-xl bg-[#fff] p-6 text-center shadow-sm ring-1 ring-black/5">
      <Lock className="mx-auto text-[#94a3b8]" size={28} aria-hidden />
      <h1 className="text-lg font-bold">{name}&rsquo;s CV</h1>
      <p className="text-sm text-[#475569]">This CV needs a passcode. Use the one {name.split(" ")[0]} gave you.</p>
      <input name="code" type="password" required autoComplete="off" aria-label="Passcode" placeholder="Passcode" className="w-full rounded-lg border border-[#cbd5e1] px-3 py-2 text-center" />
      <button disabled={pending} className="w-full rounded-lg bg-[#0f172a] px-3 py-2 font-semibold text-[#fff] disabled:opacity-50">{pending ? "Checking…" : "Open CV"}</button>
      {state?.error && <p role="alert" className="text-sm text-[#e11d48]">{state.error}</p>}
    </form>
  );
}

"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";
import { completeReset } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";

export default function ResetForm({ token }: { token: string }) {
  const [error, run, pending] = useActionState(completeReset.bind(null, token), null);
  const [show, setShow] = useState(false);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  return (
    <AuthShell title="Choose a new password." lead="You will be signed in straight after, and signed out everywhere else.">
      <form action={run} className="space-y-3">
        <div className="flex items-center gap-2"><KeyRound className="text-indigo-400" /><h1 className="text-xl font-extrabold">New password</h1></div>
        <div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input name="next" type={show ? "text" : "password"} placeholder="New password (8+ characters)" required minLength={8} className={`${input} !px-9`} autoComplete="new-password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        <input name="again" type={show ? "text" : "password"} placeholder="Type it again" required minLength={8} className={input} autoComplete="new-password" />
        {error && <p role="alert" className="flex items-center gap-1.5 text-sm text-rose-400"><TriangleAlert size={14} />{error}</p>}
        <button disabled={pending} className="btn disabled:opacity-50"><KeyRound size={16} />{pending ? "Saving…" : "Save and sign in"}</button>
      </form>
    </AuthShell>
  );
}

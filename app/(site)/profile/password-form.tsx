"use client";
import { useActionState } from "react";
import { Check, KeyRound, TriangleAlert } from "lucide-react";
import { changePassword } from "@/app/actions";

export default function PasswordForm() {
  const [state, run, pending] = useActionState(changePassword, null);
  const input = "w-full rounded-lg border border-white/15 bg-[#fff] px-3 py-2";
  return (
    <form action={run} className="grid max-w-md gap-2 text-sm">
      <input name="current" type="password" required autoComplete="current-password" placeholder="Current password" aria-label="Current password" className={input} />
      <input name="next" type="password" required minLength={8} autoComplete="new-password" placeholder="New password (8+ characters)" aria-label="New password" className={input} />
      <input name="again" type="password" required minLength={8} autoComplete="new-password" placeholder="New password again" aria-label="New password again" className={input} />
      <button disabled={pending} className="btn btn-ghost justify-self-start disabled:opacity-50"><KeyRound size={15} />{pending ? "Saving…" : "Change password"}</button>
      {state === "ok" && <p role="status" className="flex items-center gap-1.5 text-emerald-600"><Check size={14} />Password changed. Your other devices were signed out.</p>}
      {state && state !== "ok" && <p role="alert" className="flex items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state}</p>}
    </form>
  );
}

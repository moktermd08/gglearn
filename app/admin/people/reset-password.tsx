"use client";
import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { resetPassword } from "@/app/actions";

const generate = () => {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

/** For someone who is locked out: the manager makes a temporary password and passes it on; the person changes it on Your profile. */
export default function ResetPassword({ userId, name }: { userId: number; name: string }) {
  const [state, run, pending] = useActionState(resetPassword, null);
  const [pw, setPw] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <form action={run} className="mt-2 space-y-1.5 text-sm">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} placeholder="Temporary password" aria-label={`Temporary password for ${name}`} autoComplete="off" className="rounded border border-white/20 bg-[#fff] px-2 py-1 font-mono" />
        <button type="button" className="btn btn-ghost !px-3 !py-1" onClick={() => { setPw(generate()); setCopied(false); }}>Make one</button>
        <button disabled={pending} className="btn btn-ghost !px-3 !py-1 disabled:opacity-50"><KeyRound size={14} />{pending ? "Saving…" : "Set password"}</button>
        {state === "ok" && pw && (
          <button type="button" className="btn btn-ghost !px-3 !py-1" onClick={async () => { try { await navigator.clipboard.writeText(pw); setCopied(true); } catch { /* select it by hand */ } }}>
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      {state === "ok" && <p role="status" className="flex items-center gap-1.5 text-emerald-600"><Check size={14} />Done. {name.split(" ")[0]} was signed out everywhere. Tell them the temporary password, then they can change it on Your profile.</p>}
      {state && state !== "ok" && <p role="alert" className="flex items-center gap-1.5 text-rose-400"><TriangleAlert size={14} />{state}</p>}
    </form>
  );
}

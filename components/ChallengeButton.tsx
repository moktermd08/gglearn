"use client";
import { startTransition, useState } from "react";
import { Swords } from "lucide-react";
import { quickRace } from "@/app/(site)/start/actions";

/** One tap from a result to a two-person race on the same topic, with the invite link ready to send. */
export function ChallengeButton({ trackId, label = "Challenge a friend", className = "" }: { trackId: number; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  return (
    <span className={className}>
      <button type="button" disabled={busy} className="btn btn-ghost disabled:opacity-50" onClick={() => {
        setErr(null); setBusy(true);
        startTransition(async () => { const r = await quickRace(trackId, "duel"); if (r?.error) { setErr(r.error); setBusy(false); } });
      }}><Swords size={16} className="text-pink-400" />{busy ? "Setting it up…" : label}</button>
      {err && <span role="alert" className="mt-2 block rounded-xl bg-rose-500/10 p-2 text-sm text-rose-400">{err}</span>}
    </span>
  );
}

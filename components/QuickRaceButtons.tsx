"use client";
import { startTransition, useState } from "react";
import { Radio, Swords, Users, Zap } from "lucide-react";
import { quickRace } from "@/app/(site)/start/actions";
import { startDuelAction } from "@/app/(site)/d/actions";

/** Two taps from a topic page to a running race: alone against a simulated rival, or with a link to send a friend. */
export function QuickRaceButtons({ trackId, className = "" }: { trackId: number; className?: string }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const go = (m: "solo" | "group" | "duel") => {
    setErr(null); setBusy(true);
    startTransition(async () => { const r = await quickRace(trackId, m); if (r?.error) { setErr(r.error); setBusy(false); } });
  };
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => go("solo")} className="btn !py-2 text-sm disabled:opacity-50"><Zap size={15} />{busy ? "Starting…" : "Race now"}</button>
        <button type="button" disabled={busy} onClick={() => go("group")} className="btn btn-ghost !py-2 text-sm disabled:opacity-50"><Users size={15} className="text-pink-400" />Race friends</button>
        <button type="button" disabled={busy} onClick={() => go("duel")} className="btn btn-ghost !py-2 text-sm disabled:opacity-50"><Swords size={15} className="text-rose-400" />Challenge a friend</button>
      </div>
      <button type="button" disabled={busy} onClick={() => { setErr(null); setBusy(true); startTransition(async () => { const r = await startDuelAction(trackId, "friend"); if (r?.error) { setErr(r.error); setBusy(false); } }); }} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-pink-500 underline disabled:opacity-50"><Radio size={14} />Live duel: 5 questions, head to head, right now</button>
      {err && <p role="alert" className="mt-2 rounded-xl bg-rose-500/10 p-2.5 text-sm text-rose-400">{err}</p>}
    </div>
  );
}

import { CheckCircle2, CircleDashed, Lock, Square, Stamp, Undo2 } from "lucide-react";
import { revokeSignOff, signOffPhase } from "@/app/actions";
import type { Onboarding, PhaseState } from "@/lib/onboarding";

const BADGE: Record<PhaseState, { text: string; cls: string }> = {
  signed: { text: "Signed off", cls: "bg-emerald-500/15 text-emerald-500" },
  ready: { text: "Waiting for sign-off", cls: "bg-violet-500/15 text-violet-500" },
  open: { text: "In progress", cls: "bg-sky-500/15 text-sky-300" },
  locked: { text: "Locked", cls: "bg-slate-500/15 text-slate-500" },
};
const date = (t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * The onboarding phases and the gate between them. A learner sees where they are and what is holding them back; a manager
 * (`sign` set) also gets the button that signs a finished phase, and can undo one.
 */
export function OnboardingPhases({ o, sign, compact = false }: { o: Onboarding; sign?: { userId: number }; compact?: boolean }) {
  if (!o.phases.length) return null;
  return (
    <ol className="space-y-2.5">
      {o.phases.map((p) => {
        const done = p.reqs.filter((r) => r.done).length;
        const badge = BADGE[p.state];
                return (
          <li key={p.key} className={`rounded-xl border border-black/5 p-3 ${p.state === "locked" ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {p.state === "signed" ? <CheckCircle2 size={16} className="text-emerald-400" /> : p.state === "locked" ? <Lock size={16} className="text-slate-500" /> : <CircleDashed size={16} className="text-sky-400" />}
              <b>{p.label}</b>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>{badge.text}</span>
              <span className="ml-auto text-xs text-slate-400">{done}/{p.reqs.length} passed</span>
            </div>
            {p.state !== "signed" && p.state !== "locked" && (compact && p.reqs.length > 3 ? (
              <details className="mt-1.5 text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-sky-300">Show the {p.reqs.length} tracks in this phase</summary>
                <ul className="mt-1.5 space-y-0.5">
                  {p.reqs.map((r) => (
                    <li key={r.track.id} className="flex items-center gap-1.5">{r.done ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Square size={12} />}<span className={r.done ? "line-through" : ""}>{r.track.name}</span></li>
                  ))}
                </ul>
              </details>
            ) : (
              <ul className="mt-1.5 space-y-0.5 text-xs text-slate-400">
                {p.reqs.map((r) => (
                  <li key={r.track.id} className="flex items-center gap-1.5">{r.done ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Square size={12} />}<span className={r.done ? "line-through" : ""}>{r.track.name}</span></li>
                ))}
              </ul>
            ))}
            {p.state === "locked" && <p className="mt-1.5 text-xs text-slate-400">{p.reqs.length} required {p.reqs.length === 1 ? "track opens" : "tracks open"} once your manager signs off the earlier phase.</p>}
            {p.state === "ready" && !sign && <p className="mt-1.5 text-xs text-slate-400">All passed. Your manager signs this off to open the next phase.</p>}
            {p.signed && <p className="mt-1.5 text-xs text-slate-400">Signed by {p.signed.by} on {date(p.signed.at)}{p.signed.note && <> · “{p.signed.note}”</>}</p>}
            {sign && p.state === "ready" && (
              <form action={signOffPhase} className="mt-2 flex flex-wrap gap-2 text-sm">
                <input type="hidden" name="userId" value={sign.userId} /><input type="hidden" name="phase" value={p.key} />
                <input name="note" maxLength={300} placeholder="Optional note" className="min-w-40 flex-1 rounded border border-white/20 bg-[#fff] px-2 py-1" />
                <button className="btn btn-ghost !px-3 !py-1"><Stamp size={14} />Sign off {p.label}</button>
              </form>
            )}
            {sign && p.signed && (
              <form action={revokeSignOff} className="mt-1.5">
                <input type="hidden" name="id" value={p.signed.id} />
                <button className="inline-flex items-center gap-1 text-xs text-slate-400 underline hover:text-slate-600"><Undo2 size={12} />Undo sign-off</button>
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}

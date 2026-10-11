import Link from "next/link";
import { Bot, Clock, Flag, Globe, Lock, Mail, Target, Users } from "lucide-react";
import { SubjectArt } from "@/components/SubjectArt";
import { modeLabel, span, now, type Card } from "@/lib/competitions";

const CHIP = {
  upcoming: ["Starts soon", "bg-sky-500/20 text-sky-300"],
  live: ["Live", "bg-emerald-500/20 text-emerald-300"],
  finished: ["Finished", "bg-slate-500/20 text-slate-300"],
  canceled: ["Canceled", "bg-rose-500/20 text-rose-300"],
} as const;

export function CompetitionCard({ card }: { card: Card }) {
  const { c, trackName, track, humans, bots, state, invited } = card;
  const t = now();
  const [label, cls] = CHIP[state];
  const elapsed = state === "finished" ? 1 : state === "live" ? Math.min(1, Math.max(0, (t - c.startsAt) / Math.max(1, c.endsAt - c.startsAt))) : 0;
  return (
    <Link href={`/competitions/${c.slug}`} className="card card-hover rise block min-w-0 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${cls}`}>
          {state === "live" && <i className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />}
          {state === "finished" && <Flag size={11} />}{label}
        </span>
        {invited && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300"><Mail size={11} />You are invited</span>}
        <span className="inline-flex items-center gap-1 text-slate-400">{c.visibility === "public" ? <><Globe size={12} />Public</> : <><Lock size={12} />Private</>}</span>
        <span className="ml-auto text-slate-400">{modeLabel(humans, bots)}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <SubjectArt slug={track.slug} name={trackName} kind={track.kind} size={44} />
        <div className="min-w-0"><div className="truncate font-semibold">{c.title}</div>
        <div className="flex items-center gap-1.5 text-sm text-slate-300"><Target size={14} className="shrink-0 text-pink-300" /><span className="truncate">{trackName} · gain {c.goalLevels} level{c.goalLevels === 1 ? "" : "s"}</span></div></div>
      </div>
      {(state === "live" || state === "finished") && (
        <div className="bar mt-2 !h-1.5" title="Time elapsed"><i style={{ width: `${elapsed * 100}%`, background: state === "live" ? undefined : "#64748b" }} /></div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><Users size={12} />{humans} {humans === 1 ? "person" : "people"}</span>
        {bots > 0 && <span className="inline-flex items-center gap-1"><Bot size={12} className="text-violet-300" />{bots} bot{bots === 1 ? "" : "s"}</span>}
        {state === "live" && <span className="inline-flex items-center gap-1"><Clock size={12} />ends in {span(c.endsAt - t)}</span>}
        {state === "upcoming" && <span className="inline-flex items-center gap-1"><Clock size={12} />starts in {span(c.startsAt - t)}</span>}
      </div>
    </Link>
  );
}

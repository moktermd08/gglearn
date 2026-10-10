import Link from "next/link";
import { modeLabel, span, now, type Card } from "@/lib/competitions";

const CHIP = {
  upcoming: ["Starts soon", "bg-sky-500/20 text-sky-300"],
  live: ["Live", "bg-emerald-500/20 text-emerald-300"],
  finished: ["Finished", "bg-slate-500/20 text-slate-300"],
  canceled: ["Canceled", "bg-rose-500/20 text-rose-300"],
} as const;

export function CompetitionCard({ card }: { card: Card }) {
  const { c, trackName, humans, bots, state, invited } = card;
  const t = now();
  const [label, cls] = CHIP[state];
  return (
    <Link href={`/competitions/${c.slug}`} className="card card-hover block p-4">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-bold ${cls}`}>{label}</span>
        {invited && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">You are invited</span>}
        <span className="text-slate-400">{c.visibility === "public" ? "🌐 Public" : "🔒 Private"}</span>
        <span className="ml-auto text-slate-400">{modeLabel(humans, bots)}</span>
      </div>
      <div className="mt-2 font-semibold">{c.title}</div>
      <div className="text-sm text-slate-300">{trackName} · gain {c.goalLevels} level{c.goalLevels === 1 ? "" : "s"}</div>
      <div className="mt-1 text-xs text-slate-400">
        {humans} {humans === 1 ? "person" : "people"}{bots > 0 && ` + ${bots} bot${bots === 1 ? "" : "s"}`}
        {state === "live" && ` · ends in ${span(c.endsAt - t)}`}
        {state === "upcoming" && ` · starts in ${span(c.startsAt - t)}`}
      </div>
    </Link>
  );
}

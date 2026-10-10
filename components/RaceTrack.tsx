import { Avatar } from "@/components/Avatar";
import { MAX_LEVEL } from "@/lib/levels";
import type { Rival } from "@/lib/rivals";

/** The head-to-head: you and your rival climbing the same 20-step ridge to the Titan peak. */
export function RaceTrack({ you, rival, rivalLevel, youLevel, hue }: { you: string; rival: Rival; youLevel: number; rivalLevel: number; hue?: number }) {
  const pos = (l: number) => 4 + (l / MAX_LEVEL) * 92; // percent along the track
  const ahead = youLevel > rivalLevel, tied = youLevel === rivalLevel;
  return (
    <div className="card overflow-hidden p-4 sm:p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">⚔️ Head to head</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${ahead ? "bg-emerald-500/20 text-emerald-300" : tied ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"}`}>
          {ahead ? `You lead by ${youLevel - rivalLevel}` : tied ? "Neck and neck" : `${rival.name} leads by ${rivalLevel - youLevel}`}
        </span>
      </div>
      <div className="relative h-44">
        <svg viewBox="0 0 1000 160" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs><linearGradient id="ridge" x1="0" x2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset=".5" stopColor="#a78bfa" /><stop offset="1" stopColor="#f43f5e" /></linearGradient></defs>
          <path d="M0 150 L1000 150 L1000 160 L0 160Z" fill="#0f172a" />
          <path d="M0 140 Q250 140 400 100 T700 70 T980 20" fill="none" stroke="url(#ridge)" strokeWidth="8" strokeLinecap="round" strokeDasharray="2 14" className="march" />
          <path d="M930 28 L980 -4 L1000 30Z" fill="#fbbf24" opacity=".9" /><text x="975" y="52" textAnchor="middle" fontSize="22">👑</text>
        </svg>
        {[{ l: rivalLevel, node: <Avatar kind="rival" level={rivalLevel} hue={rival.hue} size={64} />, label: rival.name, dx: 5 },
          { l: youLevel, node: <Avatar kind="human" level={youLevel} hue={hue} size={64} />, label: you, dx: -5 }].map((r) => (
          <div key={r.label} className="absolute -translate-x-1/2 text-center transition-all duration-1000"
            style={{ left: `${pos(r.l) + r.dx}%`, bottom: `${10 + (r.l / MAX_LEVEL) * 58}%` }}>
            <div className="bob">{r.node}</div>
            <div className="-mt-1 whitespace-nowrap rounded bg-black/50 px-1.5 text-[11px] font-semibold">{r.label} · L{r.l}</div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">{rival.name} is {rival.tagline}, training every single day. Pass level exams and finish daily quests to stay ahead.</p>
    </div>
  );
}

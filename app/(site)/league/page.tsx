import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Clock, Crown, EyeOff, Minus, Sparkles, Swords, Trophy } from "lucide-react";
import { PageHero } from "@/components/charts";
import { TierGem } from "@/components/TierGem";
import { requireUser } from "@/lib/auth";
import { leagueView, TIERS } from "@/lib/league";
import { MAX_TIER } from "@/lib/leagueRules";
import { WhereYouBelong } from "@/components/WhereYouBelong";
import { chooseCrossLeague } from "./actions";
import type { Offer } from "@/lib/openLeague";

export const metadata = { title: "Your league — gglearn" };

export default async function League() {
  const me = await requireUser();
  const v = leagueView(me.id), belong = <WhereYouBelong userId={me.id} variant="note" />;

  if ("notIn" in v) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={Trophy} tone="amber" title="The weekly league" sub="Climb from Bronze to Diamond. Each week you race a group of about 30 in your tier: the top fifth move up, the bottom fifth move down." />
        <div className="card flex flex-col items-center gap-4 p-8 text-center">
          <TierGem tier={v.tier} size={72} className="bob" />
          {v.notIn === "hidden" ? (<>
            <h2 className="flex items-center gap-2 text-xl font-extrabold"><EyeOff size={20} className="text-slate-400" />You are hidden from the boards</h2>
            <p className="max-w-md text-sm text-slate-400">The league uses the same weekly points as the season boards, so it is off while you are hidden from them. You can change that on your profile.</p>
            <Link href="/profile#season-board" className="btn btn-ghost">Change it on your profile</Link>
          </>) : (<>
            <h2 className="text-xl font-extrabold">Score a point to join the {v.tierName} league</h2>
            <p className="max-w-md text-sm text-slate-400">Do a quest or pass a level this week and you are placed in a group of about 30. A level is worth 100 points and each day you practise 10.</p>
            <Link href="/dashboard" className="btn">Start with today&apos;s step<ArrowRight size={16} /></Link>
          </>)}
        </div>
        <CrossLeague offer={v.offer} cross={false} />
        <Ladder current={v.tier} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {belong}
      <PageHero Icon={Trophy} tone="amber" title={`${v.tierName} league`} sub={`${v.weekLabel}. Ends in ${v.endsIn}. The top ${v.up} move up, the bottom ${v.down} move down.`} />

      <section className="card relative overflow-hidden p-5" style={{ background: `linear-gradient(120deg, hsl(${v.hue} 85% 55% / .18), #fff 65%)` }} aria-label="Where you stand">
        <div className="flex flex-wrap items-center gap-5">
          <TierGem tier={v.tier} size={84} className="bob" />
          <div className="min-w-0 flex-1 basis-60">
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400">You are</div>
            <div className="text-3xl font-extrabold">#{v.me.rank} <span className="text-lg font-bold text-slate-400">of {v.size}</span></div>
            <p className="text-sm text-slate-300">{v.me.note}</p>
          </div>
          <div className="text-center"><div className="flex items-center justify-center gap-1 text-2xl font-extrabold"><Sparkles size={18} className="text-sky-500" />{v.me.points}</div><div className="text-xs text-slate-400">points this week</div></div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Clock size={12} />A level you pass is 100 points; each day you practise is 10. <Link href="/dashboard" className="font-semibold text-indigo-400 underline">Your next step</Link></p>
      </section>

      <section className="card p-5" aria-label="Your group">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><Swords size={18} className="text-pink-400" />Your group</h2>
        <ol className="space-y-1.5">
          {v.rows.map((r, i) => (
            <li key={r.userId}>
              {v.up > 0 && i === v.up && v.tier < MAX_TIER && <div className="my-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span className="h-px flex-1 bg-slate-300" />stay here<span className="h-px flex-1 bg-slate-300" /></div>}
              {v.down > 0 && i === v.rows.length - v.down && v.tier > 0 && <div className="my-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-rose-400"><span className="h-px flex-1 bg-rose-300" />relegation zone<span className="h-px flex-1 bg-rose-300" /></div>}
              <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.mine ? "bg-indigo-500/10 ring-2 ring-indigo-400/60" : r.zone === "up" ? "bg-emerald-500/10" : r.zone === "down" ? "bg-rose-500/10" : "bg-black/[.03]"}`}>
                <span className="w-7 text-center text-sm font-extrabold text-slate-400">{r.rank === 1 ? <Crown size={16} className="mx-auto text-amber-500" /> : r.rank}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}{r.mine && <span className="ml-2 text-xs font-bold text-indigo-500">you</span>}</span>
                {r.zone === "up" && <ArrowUp size={15} className="text-emerald-500" aria-label="promotion zone" />}
                {r.zone === "down" && <ArrowDown size={15} className="text-rose-500" aria-label="relegation zone" />}
                <span className="w-16 text-right font-bold">{r.points}</span>
              </div>
            </li>
          ))}
        </ol>
        {v.up > 0 && v.tier < MAX_TIER && <p className="mt-3 text-xs text-emerald-600">Promotion zone: the top {v.up}, and only with points on the board.</p>}
        {v.size < 6 && <p className="mt-1 text-xs text-slate-400">The group is small, so nobody moves down yet. It fills as more people score.</p>}
      </section>

      <CrossLeague offer={v.offer} cross={v.cross} />

      <Ladder current={v.tier} />

      {v.history.length > 0 && (
        <section className="card p-5" aria-label="Past weeks">
          <h2 className="mb-3 font-bold">Past weeks</h2>
          <ul className="divide-y divide-black/5 text-sm">
            {v.history.map((h) => (
              <li key={h.key} className="flex items-center gap-3 py-2">
                <TierGem tier={h.tier} size={26} />
                <span className="min-w-0 flex-1"><b>{TIERS[h.tier].name}</b> <span className="text-slate-400">· {h.key}</span></span>
                <span className="text-slate-400">#{h.rank} of {h.size} · {h.points} pts</span>
                <span className={`flex w-24 items-center justify-end gap-1 font-semibold ${h.outcome === "up" ? "text-emerald-500" : h.outcome === "down" ? "text-rose-500" : "text-slate-400"}`}>
                  {h.outcome === "up" ? <><ArrowUp size={14} />Promoted</> : h.outcome === "down" ? <><ArrowDown size={14} />Moved down</> : <><Minus size={14} />Stayed</>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Playing against other companies is a choice twice over: the company allows it and the person chooses it. Both sides are explained before anything is shared. */
function CrossLeague({ offer, cross }: { offer: Offer; cross: boolean }) {
  if (!offer.available) return offer.why === "company-off" ? <p className="text-center text-xs text-slate-400">Your company has not switched on the cross-company league.</p> : null;
  return (
    <section className="card space-y-2 p-5" aria-label="Cross-company league">
      <h2 className="font-bold">{cross ? "You are in the cross-company league" : "Race other companies"}</h2>
      <p className="text-sm text-slate-300">{cross
        ? "This week you race people from other companies who also chose this. They see your first name, an initial and your points, never your company or your email. While you are in it you are not in your own company\u2019s league."
        : "Your company allows the league to be played against other companies. If you join, you race people from other companies who also chose it. They would see your first name, an initial and your points, never your company or your email. You would leave your own company\u2019s league while you are in it, and you can switch back at any time."}</p>
      <form action={chooseCrossLeague.bind(null, !cross)}><button className={cross ? "btn btn-ghost !py-1.5 text-sm" : "btn !py-1.5 text-sm"}>{cross ? "Go back to my company\u2019s league" : "Join the cross-company league"}</button></form>
    </section>
  );
}

function Ladder({ current }: { current: number }) {
  return (
    <section className="card p-5" aria-label="The leagues">
      <h2 className="mb-3 font-bold">The ladder</h2>
      <ol className="flex items-end justify-between gap-1">
        {TIERS.map((t, i) => (
          <li key={t.name} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center" aria-current={i === current ? "step" : undefined}>
            <span className={i === current ? "" : "opacity-55"}><TierGem tier={i} size={i === current ? 44 : 32} /></span>
            <span className={`truncate text-[10px] font-bold ${i === current ? "text-slate-800" : "text-slate-400"}`}>{t.name}</span>
            {i === current && <span className="h-1 w-6 rounded-full" style={{ background: `hsl(${t.hue} 75% 55%)` }} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

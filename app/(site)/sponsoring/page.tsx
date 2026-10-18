import type { Metadata } from "next";
import Link from "next/link";
import { Award, HeartHandshake, Target } from "lucide-react";
import { PageHero } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { backedBy, backers, goalOptions, type SponsorView } from "@/lib/sponsors";
import { GoalForm, StopSponsor } from "./forms";

export const metadata: Metadata = { title: "Sponsoring — gglearn", robots: { index: false, follow: false } };

function Goal({ g, who }: { g: SponsorView; who: string }) {
  return (
    <li className="space-y-1.5 rounded-xl bg-black/[.03] p-3 text-sm">
      <div className="flex items-center gap-2"><b className="flex-1">{who}: {g.topic}, level {g.level}</b><StopSponsor id={g.id} /></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10"><i className="block h-full rounded-full bg-emerald-400" style={{ width: `${(g.passed / g.level) * 100}%` }} /></div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {g.reachedAt ? <span className="font-semibold text-emerald-600">Reached</span> : <span>Level {g.passed} of {g.level} so far</span>}
        {g.reachedAt && g.certificate && <Link href={`/cert/${g.certificate}`} className="inline-flex items-center gap-1 underline"><Award size={12} />Certificate</Link>}
      </div>
    </li>
  );
}

export default async function Sponsoring() {
  const me = await requireUser();
  const mine = backers(me.id), backing = backedBy(me.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={HeartHandshake} tone="pink" title="Sponsoring" sub="Back someone to reach a level, or ask someone to back you. A sponsor sees progress on that one goal and is told when it is reached. It only starts when both say yes." />

      <section className="card space-y-3 p-5" aria-label="Ask for a sponsor">
        <h2 className="flex items-center gap-2 font-bold"><Target size={18} className="text-pink-400" />Ask someone to back a goal</h2>
        <p className="text-sm text-slate-300">Pick a topic and a level. The link you share names that goal only: a sponsor sees your first name, the goal and your progress on it, never your email or anything else.</p>
        <GoalForm topics={goalOptions(me)} />
      </section>

      {mine.length > 0 && (
        <section className="card space-y-3 p-5" aria-label="Who backs you">
          <h2 className="font-bold">Backing you</h2>
          <ul className="space-y-2">{mine.map((g) => <Goal key={g.id} g={g} who={g.person} />)}</ul>
        </section>
      )}

      <section className="card space-y-3 p-5" aria-label="Goals you back">
        <h2 className="font-bold">Goals you back</h2>
        {backing.length ? <ul className="space-y-2">{backing.map((g) => <Goal key={g.id} g={g} who={g.person} />)}</ul> : <p className="text-sm text-slate-400">None yet. When someone sends you a sponsor link and you press the button, their goal appears here.</p>}
      </section>
    </div>
  );
}

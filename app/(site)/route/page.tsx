import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { TARGETS, assessmentFor, resolveAreas, resultsFor } from "@/lib/route";
import { readiness } from "@/lib/routeScore";

export const metadata = { title: "My route — gglearn" };

export default async function RouteIndex() {
  const me = await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Compass} tone="emerald" title="Find your route into a new job" sub="Pick the job you are aiming for. We check where you stand today, so you know exactly what to learn first." />
      <ul className="grid gap-4">
        {TARGETS.map((t) => {
          const a = assessmentFor(me.id, t.slug);
          const done = a?.status === "complete";
          const pct = done ? Math.round(readiness(resultsFor(a, resolveAreas(t, me)).filter((r) => r.placed !== null).map((r) => ({ key: r.key, placed: r.placed!, target: r.target }))) * 100) : null;
          return (
            <li key={t.slug} className="card space-y-2 p-5">
              <h2 className="text-lg font-extrabold">{t.title}</h2>
              <p className="text-sm text-slate-400">{t.summary}</p>
              <p className="text-sm font-semibold">{!a ? "Not started" : done ? `Checked: ${pct}% of the way there` : "Check in progress"}</p>
              <Link href={`/route/${t.slug}`} className="btn w-fit">{!a ? "Check where I stand" : done ? "See my results" : "Carry on"}<ArrowRight size={16} /></Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

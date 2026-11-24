import Link from "next/link";
import { ArrowRight, ClipboardList, Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHero } from "@/components/charts";
import { DoctorReading, hasReading } from "@/components/DoctorReading";
import { diagnose } from "@/lib/careerDoctor";
import { rolesWithLadders } from "@/lib/careers";
import { momentumFor } from "@/lib/careerMomentum";
import { othersFor } from "@/lib/careerOthers";
import { checkMyLevel } from "./actions";

export const metadata = { title: "Career doctor — gglearn" };

export default async function CareerDoctor() {
  const user = await requireUser();
  const d = diagnose(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Stethoscope} tone="violet" title="Career doctor" sub="Not sure what you would be best at? We read what you have already shown in coding, management, marketing, sales and more, and point to where it fits." />

      {!hasReading(d) ? (
        <EmptyState Icon={Stethoscope} title="No results to read yet" tone="violet">
          <p className="text-sm text-slate-600">Take a placement check in two or three different areas and come back. Each one takes a few minutes.</p>
          <Link href="/doctor/taster" className="btn btn-primary mt-3 inline-block">Take the career taster (about 3 minutes)</Link>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {d.families.slice(0, 8).flatMap((f) => f.untested.slice(0, 1).map((a) => <form key={a.slug} action={checkMyLevel.bind(null, a.trackId)}><button className="btn btn-ghost text-sm" title={f.family}>{a.name}</button></form>))}
          </div>
          <Link href="/start" className="mt-3 inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">Or pick any topic <ArrowRight size={14} /></Link>
        </EmptyState>
      ) : (
        <DoctorReading d={d} mom={momentumFor(user, d)} jobRole={user.jobRole} reader={{ kind: "self", others: othersFor(user, d) }} />
      )}
      {rolesWithLadders().length === 0 && <p className="text-sm text-slate-500">No career ladders are set up yet.</p>}
      <p className="flex flex-wrap items-center gap-1 text-sm"><ClipboardList size={14} className="text-indigo-700" />See what to do about it, how often, and how you are doing on <Link href="/plan" className="font-semibold text-indigo-700 hover:underline">My plan</Link>.</p>
      <p className="text-xs text-slate-500">Fit counts placement results as well as passed exams, because it shows where you are likely to do well. What your exams prove for a role is on <Link href="/goal" className="underline">Goal assessment</Link>.</p>
    </div>
  );
}

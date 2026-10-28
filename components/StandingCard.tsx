import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { CareerStanding } from "@/lib/careerStanding";

/** The title next to what exams prove, and the way into a level check for the goal. The title is a manager's decision and always stands; the exams are evidence beside it. */
export function StandingCard({ st, goalTitle, slug, state, more }: { st: CareerStanding; goalTitle: string; slug: string | null; state: "none" | "in_progress" | "complete"; /** a page with the full assessment, linked from the heading */ more?: string }) {
  const title = st.titles.get(st.level) ?? `Level ${st.level}`;
  const proven = st.verified === null ? null : st.titles.get(st.verified) ?? `Level ${st.verified}`;
  const apart = `${st.rungsApart} level${st.rungsApart === 1 ? "" : "s"}`;
  const note = {
    agree: "Your exam results back up your title.",
    "title-ahead": `Exams prove ${apart} less than your title. Passing the tests on the way verifies it.`,
    "verified-ahead": `Your exams show ${apart} more than your title. That is a good case to put to your manager.`,
    unverified: "No exam results on this ladder yet, so nothing is verified.",
  }[st.agreement];
  return (
    <section className="card space-y-3 p-5" aria-label="Where you stand">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><MapPin size={17} /></span>Where you stand</h2>
        {more && <Link href={more} className="text-xs text-sky-300 underline">Full goal assessment</Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Your title</div>
          <div className="font-bold">{title}</div>
          <div className="text-xs text-slate-400">{st.basis === "authority" ? "Set by your manager" : "Starting level, no promotion yet"}</div>
        </div>
        <div className="rounded-2xl border border-black/10 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Proven by exams</div>
          <div className="font-bold">{proven ?? "Nothing yet"}</div>
          <div className="text-xs text-slate-400">Real exam passes only, not placement</div>
        </div>
      </div>
      <p className="text-sm text-slate-300">{note}</p>
      {slug && (
        <div className="flex flex-wrap items-center gap-3 border-t border-black/5 pt-3">
          <p className="min-w-0 flex-1 text-sm text-slate-400">{state === "complete" ? <>You have checked where you stand for <b>{goalTitle}</b>.</> : <>A short check in each area on the way to <b>{goalTitle}</b> shows what is left to learn, then we plan it around your time.</>}</p>
          {state === "complete" && <Link href={`/route/${slug}/plan`} className="btn btn-ghost">My plan</Link>}
          <Link href={`/route/${slug}`} className="btn">{state === "none" ? "Check where I stand" : state === "in_progress" ? "Carry on the check" : "See results"}<ArrowRight size={15} /></Link>
        </div>
      )}
    </section>
  );
}

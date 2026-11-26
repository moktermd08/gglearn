import Link from "next/link";
import { ArrowRight, Compass, Flag } from "lucide-react";
import { startPlacementAction } from "@/app/terms-actions";
import { rankName, TERM_PASS } from "@/lib/termsCore";
import type { Step, StepBody } from "@/lib/termJourney";

const rank = (n: number | null) => (n ? rankName(n) : "the basics");

function Climb({ s }: { s: StepBody }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Ranks on the way">
      {s.placement.stages.map((g) => (
        <span key={g.rank} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${g.state === "passed" ? "bg-emerald-100 text-emerald-800" : g.state === "failed" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-300"}`}>
          {rankName(g.rank)}{g.state === "passed" ? " ✓" : g.state === "failed" ? ` ${Math.round((g.score ?? 0) * 100)}%` : ""}
        </span>
      ))}
    </div>
  );
}

function Ask({ s, label, primary = true }: { s: StepBody; label: string; primary?: boolean }) {
  return (
    <form action={startPlacementAction}>
      <input type="hidden" name="role" value={s.role} /><input type="hidden" name="level" value={s.level} /><input type="hidden" name="stage" value={s.stage ?? 1} />
      <button className={primary ? "btn" : "btn btn-ghost"}>{label}<ArrowRight size={16} /></button>
    </form>
  );
}

/** What to do next on the path from "I know nothing" to the level you aim at. The rules are in lib/termJourney.ts; this only shows them. */
export function TermNextStep({ step }: { step: Step }) {
  if (step.kind === "start") {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-4 border-indigo-300 p-5">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Compass size={18} className="text-indigo-600" />Start with the words of your work</h2>
          <p className="mt-1 text-sm text-slate-300">Say what you want to learn and how much you know. You can start from nothing or find your level in a few minutes, and the next step is always shown here.</p>
        </div>
        <Link href="/terms/start" className="btn">Get started<ArrowRight size={16} /></Link>
      </section>
    );
  }
  const goalWords = step.roleLabel.toLowerCase() === step.title.toLowerCase() ? step.roleLabel : `${step.roleLabel}, ${step.title}`;
  return (
    <section className="card space-y-3 border-indigo-300 p-5" aria-label="Next step in your words">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-600"><Flag size={13} />Your words · next step · {goalWords}</p>
      {step.kind === "place" && <>
        <h2 className="text-lg font-bold">Find where you stand</h2>
        <p className="text-sm text-slate-300">We start at <b>{rank(step.stage)}</b> and climb one rank at a time, only while you keep passing. Each rank is {10} questions and you need {TERM_PASS * 100}% to pass. If you are new to this, study first.</p>
      </>}
      {step.kind === "continue" && <>
        <h2 className="text-lg font-bold">You passed {rank(step.placed)}. Next: {rank(step.stage)}</h2>
        <p className="text-sm text-slate-300">Keep climbing. The questions get deeper at each rank, and the climb stops where you stop passing.</p>
      </>}
      {step.kind === "climb" && <>
        <h2 className="text-lg font-bold">{step.placed ? `You are at ${rank(step.placed)}.` : "You are at the start."} Next: {rank(step.stage)}</h2>
        <p className="text-sm text-slate-300">
          {step.toLearn ? <>Study the <b>{step.toLearn}</b> {rank(step.stage)} term{step.toLearn === 1 ? "" : "s"} you do not know yet, then try the {rank(step.stage)} questions again.</> : <>You have met every {rank(step.stage)} term. Try the {rank(step.stage)} questions again.</>}
          {" "}{step.hasGoal ? <>Your goal asks for <b>{rank(step.target)}</b>.</> : <>This list goes up to <b>{rank(step.target)}</b>.</>}
        </p>
      </>}
      {step.kind === "there" && <>
        <h2 className="text-lg font-bold">You are at {rank(step.placed)}: that is what {step.title} asks for</h2>
        <p className="text-sm text-slate-300">Prove it with a full rank exam from the list, or aim higher.</p>
      </>}
      <Climb s={step} />
      <div className="flex flex-wrap items-center gap-3">
        {step.kind === "place" && <><Ask s={step} label="Find my level" /><Link href={step.studyHref} className="btn btn-ghost">Study first</Link></>}
        {step.kind === "continue" && <><Ask s={step} label={`Take the ${rank(step.stage)} questions`} /><Link href={step.studyHref} className="btn btn-ghost">Study</Link></>}
        {step.kind === "climb" && <><Link href={step.studyHref} className="btn">Study<ArrowRight size={16} /></Link><Ask s={step} label={`Try ${rank(step.stage)} again`} primary={false} /></>}
        {step.kind === "there" && <Link href={step.listHref} className="btn">Open the exams<ArrowRight size={16} /></Link>}
        <Link href="/terms/start" className="text-sm underline">Change what I am learning</Link>
      </div>
    </section>
  );
}

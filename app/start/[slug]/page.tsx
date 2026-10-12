import { and, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, journeys, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, TIERS, tierOf } from "@/lib/levels";
import { PLACEMENT_BATCH, PLACEMENT_PASS } from "@/lib/placement";
import { ArrowRight, Check, Gauge, Lightbulb, ListChecks, Sprout, Target, TrendingUp } from "lucide-react";
import { JourneySteps } from "@/components/JourneySteps";
import { RankEmblem } from "@/components/RankEmblem";
import { LevelScale } from "@/components/charts";
import { SubjectArt, artFor } from "@/components/SubjectArt";
import { answerPlacement, skipPlacement, startPlacement } from "../actions";
import Setup from "./setup";

export const metadata = { title: "Your journey — gglearn" };

export default async function Journey({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const slug = (await params).slug;
  const j = db.select().from(journeys).where(and(eq(journeys.slug, slug), eq(journeys.userId, user.id))).get();
  if (!j) notFound();
  if (j.step === "launched" && j.competitionSlug) redirect(`/competitions/${j.competitionSlug}`);
  const track = db.select().from(tracks).where(eq(tracks.id, j.trackId)).get()!;

  if (j.step === "setup") {
    const placed = j.placed ?? 0;
    const hue = TIERS[tierOf(Math.max(placed, 1))].hue;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <JourneySteps at={4} />
        <div className="card pop flex flex-wrap items-center gap-5 p-5" style={{ background: `linear-gradient(120deg, hsl(${hue} 80% 55% / .14), #ffffff 60%)` }}>
          {placed > 0 ? <RankEmblem level={placed} size={72} /> : <Sprout size={56} className="bob text-emerald-400" aria-hidden />}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">Your starting point in {track.name}</div>
            <div className="text-2xl font-extrabold" style={{ color: `hsl(${hue} 70% 35%)` }}>
              {placed > 0 ? `Level ${placed} · ${LEVELS[placed - 1]}` : "Level 0 · Fresh start"}
            </div>
            <div className="bar my-1.5 w-56 max-w-full"><i style={{ width: `${(placed / MAX_LEVEL) * 100}%` }} /></div>
            <div className="text-sm text-slate-300">{placed >= MAX_LEVEL ? "Nothing left to climb." : `Next up: level ${placed + 1}, ${LEVELS[placed]}. The finish line is how many levels you add from here.`}</div>
          </div>
        </div>
        <Setup slug={slug} mode={j.mode} placed={placed} trackName={track.name} />
      </div>
    );
  }

  // step "level"
  if (!j.pending?.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <JourneySteps at={3} />
        <div className="card pop space-y-4 overflow-hidden p-6" style={{ background: `linear-gradient(120deg, ${artFor(track.slug, track.name, track.kind).color}1f, #ffffff 60%)` }}>
          <div className="flex items-center gap-4"><SubjectArt slug={track.slug} name={track.name} kind={track.kind} size={64} className="shadow-lg" /><h1 className="text-2xl font-extrabold">Let us find your level in {track.name}</h1></div>
          <LevelScale lo={j.lo} hi={MAX_LEVEL} />
          <p className="text-slate-300">
            A short adaptive check: we ask {PLACEMENT_BATCH} multiple-choice questions at a time, starting mid-way, and jump up or down depending on how you do.
            It usually takes 3 to 5 rounds. {j.lo > 0 && <>You have already passed level {j.lo} by exam, so we start from there.</>}
          </p>
          <ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold" aria-label="How the check works">
            {[{ Icon: ListChecks, t: `${PLACEMENT_BATCH} questions a round`, c: "bg-sky-500/15 text-sky-300" }, { Icon: TrendingUp, t: "Jump up or down", c: "bg-violet-500/15 text-violet-300" }, { Icon: Target, t: "Settle on your level", c: "bg-emerald-500/15 text-emerald-300" }].map(({ Icon, t, c }, i) => (
              <li key={t} className="rise relative flex flex-col items-center gap-1.5 rounded-2xl border border-black/10 bg-[#fff] p-3" style={{ "--i": i } as React.CSSProperties}>
                {i < 2 && <span className="pointer-events-none absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-[#fff] text-slate-400 sm:grid" aria-hidden><ArrowRight size={11} /></span>}
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${c}`}><Icon size={20} /></span>{t}
              </li>
            ))}
          </ol>
          <ul className="space-y-2 text-sm text-slate-400">
            {["Skip a question you do not know rather than guessing. A blank counts as wrong, but guessing can place you too high.",
              "The check only ever raises your starting point. It never removes a level you earned. Required courses, promotions and certificates still need real exams."].map((t, i) => (
              <li key={i} className="rise flex gap-2" style={{ "--i": i } as React.CSSProperties}><Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-300" />{t}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <form action={startPlacement.bind(null, slug)}><button className="btn">Start the check<ArrowRight size={16} /></button></form>
            <form action={skipPlacement.bind(null, slug)}><button className="text-sm text-slate-400 underline">I am new to this, start from {j.lo > 0 ? `level ${j.lo}` : "zero"}</button></form>
          </div>
        </div>
      </div>
    );
  }

  const rows = db.select().from(questions).where(inArray(questions.id, j.pending)).all();
  const byId = new Map(rows.map((q) => [q.id, q]));
  const batch = j.pending.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <JourneySteps at={3} />
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-extrabold"><Gauge size={20} className="text-sky-300" />Level check <span className="flex items-center gap-1" aria-label={`Round ${j.round}`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={`h-2.5 rounded-full transition-all ${n === j.round ? "w-6 bg-sky-500" : n < j.round ? "w-2.5 bg-emerald-500" : "w-2.5 bg-black/15"}`} />)}</span><span className="text-sm font-semibold text-slate-400">round {j.round}</span></h1>
          <span className="text-sm text-slate-400">Narrowing from level {j.lo} to {j.hi}. Need {PLACEMENT_PASS} of {PLACEMENT_BATCH} to move up.</span>
        </div>
        <div role="img" aria-label={`Your level is between ${j.lo} and ${j.hi}`}>
          <LevelScale lo={j.lo} hi={j.hi} />
        </div>
      </div>
      <form action={answerPlacement.bind(null, slug)} className="space-y-4">
        {batch.map((q, i) => (
          <fieldset key={q.id} className="card rise space-y-3 p-4" style={{ "--i": i } as React.CSSProperties}>
            <legend className="sr-only">Question {i + 1}</legend>
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            {q.code && <pre className="overflow-x-auto rounded bg-black/5 p-2 text-sm">{q.code}</pre>}
            <div className="grid gap-2">
              {q.options?.map((o) => (
                <label key={o.key} className="group flex cursor-pointer items-start gap-3 rounded-xl border-2 border-black/10 p-3 transition hover:border-black/30 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300">
                  <input type="radio" name={`q${q.id}`} value={o.key} className="sr-only" />
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[.06] font-mono text-sm font-bold transition group-has-[:checked]:bg-indigo-500 group-has-[:checked]:text-[#fff]">{o.key.toUpperCase()}</span>
                  <span className="pt-0.5">{o.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="btn"><Check size={16} />Submit round</button>
      </form>
    </div>
  );
}

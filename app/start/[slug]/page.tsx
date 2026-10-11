import { and, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, journeys, questions, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEVELS, MAX_LEVEL, TIERS, tierOf } from "@/lib/levels";
import { PLACEMENT_BATCH, PLACEMENT_PASS } from "@/lib/placement";
import { ArrowRight, Check, Gauge, Lightbulb, Sprout } from "lucide-react";
import { JourneySteps } from "@/components/JourneySteps";
import { RankEmblem } from "@/components/RankEmblem";
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
        <div className="card pop flex items-center gap-5 p-5">
          {placed > 0 ? <RankEmblem level={placed} size={72} /> : <Sprout size={56} className="bob text-emerald-400" aria-hidden />}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">Your starting point in {track.name}</div>
            <div className="text-2xl font-extrabold" style={{ color: `hsl(${hue} 85% 70%)` }}>
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
        <div className="card space-y-4 p-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Gauge className="text-sky-300" />Let us find your level in {track.name}</h1>
          <p className="text-slate-300">
            A short adaptive check: we ask {PLACEMENT_BATCH} multiple-choice questions at a time, starting mid-way, and jump up or down depending on how you do.
            It usually takes 3 to 5 rounds. {j.lo > 0 && <>You have already passed level {j.lo} by exam, so we start from there.</>}
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            {["Skip a question you do not know rather than guessing. A blank counts as wrong, but guessing can place you too high.",
              "The check only ever raises your starting point. It never removes a level you earned, and certificates still need real exams."].map((t, i) => (
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
          <h1 className="flex items-center gap-2 text-xl font-extrabold"><Gauge size={20} className="text-sky-300" />Level check · round {j.round}</h1>
          <span className="text-sm text-slate-400">Narrowing from level {j.lo} to {j.hi}. Need {PLACEMENT_PASS} of {PLACEMENT_BATCH} to move up.</span>
        </div>
        <div role="img" aria-label={`Your level is between ${j.lo} and ${j.hi}`}>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
            <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all duration-1000" style={{ left: `${(j.lo / MAX_LEVEL) * 100}%`, width: `${Math.max(2, ((j.hi - j.lo) / MAX_LEVEL) * 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>0</span><span>5</span><span>10</span><span>15</span><span>{MAX_LEVEL}</span></div>
        </div>
      </div>
      <form action={answerPlacement.bind(null, slug)} className="space-y-4">
        {batch.map((q, i) => (
          <fieldset key={q.id} className="card rise space-y-3 p-4" style={{ "--i": i } as React.CSSProperties}>
            <legend className="sr-only">Question {i + 1}</legend>
            <div className="font-medium">{i + 1}. {q.prompt}</div>
            {q.code && <pre className="overflow-x-auto rounded bg-black/50 p-2 text-sm">{q.code}</pre>}
            <div className="grid gap-2">
              {q.options?.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-2 transition hover:border-white/30 hover:bg-white/5 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/20">
                  <input type="radio" name={`q${q.id}`} value={o.key} className="mt-1" />
                  <span><b className="font-mono">{o.key}</b> {o.text}</span>
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

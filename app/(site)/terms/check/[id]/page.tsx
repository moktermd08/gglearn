import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Check, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { goalNeed, loadCheck, termsAvailable } from "@/lib/terms";
import { roleLabel } from "@/lib/termStudy";
import { TermNextStep } from "@/components/TermNextStep";
import { nextStep } from "@/lib/termJourney";
import { RANKS, TERM_PASS, rankName } from "@/lib/termsCore";
import { submitCheckAction } from "@/app/terms-actions";

export const metadata = { title: "Term check — gglearn" };

const SAY = {
  confirmed: (c: string) => `You are at ${c}, as you said. You knew at least ${TERM_PASS * 100}% of the terms at that rank.`,
  above: (c: string, r: string) => `You claimed ${c} but the check puts you at ${r}: you are stronger than you thought.`,
  below: (c: string, r: string) => `You claimed ${c}. The check supports ${r}. The terms you missed are below, so you know where to work.`,
  unproven: (c: string) => `There were not enough ${c} terms in this check to say whether you are at that rank.`,
} as const;

export default async function TermCheck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  const check = loadCheck(user, Number(id));
  if (!check) notFound();
  const { exam, answers } = check;

  if (exam.finishedAt == null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHero Icon={BookOpen} tone="violet" title="Term check" sub={`${answers.length} questions, asked as deeply as ${rankName(exam.claimedTier)} level.${exam.kind === "premade" ? ` The ${rankName(exam.claimedTier)} exam for ${roleLabel(exam.role)}.` : ""}${exam.kind === "placement" ? ` Finding your level for ${roleLabel(exam.role)}: this is the ${rankName(exam.claimedTier)} step.` : ""} Answer them all, then see where you stand.`} />
        <form action={submitCheckAction} className="space-y-4">
          <input type="hidden" name="exam" value={exam.id} />
          {answers.map((a, n) => (
            <fieldset key={a.id} className="card space-y-2 p-4">
              <legend className="px-1 text-sm font-semibold">{n + 1}. {a.prompt}</legend>
              {a.options.map((o, i) => (
                <label key={i} className="flex items-start gap-2 text-sm"><input type="radio" name={`a_${a.id}`} value={i} className="mt-1" /><span>{o}</span></label>
              ))}
            </fieldset>
          ))}
          <button className="btn">Finish and see where I stand</button>
        </form>
      </div>
    );
  }

  const claimed = rankName(exam.claimedTier), reached = rankName(check.reached);
  const goal = goalNeed(user.id);
  const msg = check.verdict === "confirmed" ? SAY.confirmed(claimed) : check.verdict === "above" ? SAY.above(claimed, reached) : check.verdict === "below" ? SAY.below(claimed, reached) : SAY.unproven(claimed);
  const missed = answers.filter((a) => !a.right);
  const placement = exam.kind === "placement";
  const passed = (exam.score ?? 0) >= TERM_PASS;
  const step = nextStep(user.id);
  const title = placement ? `${Math.round((exam.score ?? 0) * 100)}% · ${passed ? `You passed ${claimed}` : `Not yet at ${claimed}`}` : `${Math.round((exam.score ?? 0) * 100)}% · ${check.reached ? reached : "Not yet at Initiate"}`;
  const sub = placement ? (passed ? `You knew ${TERM_PASS * 100}% or more of the ${claimed} terms asked. The next rank is open.` : `Fewer than ${TERM_PASS * 100}% of the ${claimed} terms were right, so this is where the climb stops for now. That is a start, not a failure: the terms you missed are below.`) : msg;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={BookOpen} tone="violet" title={title} sub={sub} />
      {step.kind !== "start" && <TermNextStep step={step} />}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">By rank</h2>
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          {RANKS.map((r, i) => {
            const t = check.stats[i + 1];
            return (
              <div key={r} className={`rounded-lg border p-2 ${i + 1 === exam.claimedTier ? "border-indigo-500" : "border-black/10"}`}>
                <div className="text-xs text-slate-500">{r}</div>
                <div className="font-semibold">{t ? `${t.right}/${t.tested}` : "–"}</div>
              </div>
            );
          })}
        </div>
        {goal && <p className="text-sm text-slate-600">Your goal, <b>{goal.title}</b>, asks for <b>{rankName(goal.rank)}</b>. {check.reached >= goal.rank ? "This check supports that." : "This check does not yet support that: keep working through the terms you missed."}</p>}
      </section>

      {missed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Terms to work on ({missed.length})</h2>
          <div className="card divide-y divide-black/10 text-sm">
            {missed.map((a) => (
              <div key={a.id} className="space-y-1 p-3">
                <p><b>{a.term}</b> <span className="text-xs text-slate-500">{rankName(a.tier)}</span></p>
                <p className="text-slate-600">{a.meaning}</p>
                <p className="flex items-center gap-1 text-rose-600"><X size={13} />You chose: {a.chosen == null ? "no answer" : a.options[a.chosen]}</p>
                <p className="flex items-center gap-1 text-emerald-700"><Check size={13} />Right answer: {a.options[a.correct]}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="flex flex-wrap gap-4 text-sm">
        {missed.length > 0 && <Link href={`/terms/study?check=${exam.id}`} className="btn">Study the {missed.length} term{missed.length === 1 ? "" : "s"} I missed</Link>}
        <Link href="/terms" className="underline self-center">Back to Terms</Link>
      </p>
    </div>
  );
}

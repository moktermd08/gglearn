import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ExamRunner } from "@/components/ExamRunner";
import { ForgetSavedAnswers } from "@/components/ForgetSavedAnswers";
import { QuestionStrip, RankChart, ResultHead, Review, TopicBars } from "@/components/ExamResult";
import { goalNeed, loadCheck, termsAvailable } from "@/lib/terms";
import { roleLabel } from "@/lib/termStudy";
import { TermNextStep } from "@/components/TermNextStep";
import { nextStep } from "@/lib/termJourney";
import { TERM_PASS, rankName } from "@/lib/termsCore";

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
    const what = exam.kind === "premade" ? `${rankName(exam.claimedTier)} exam · ${roleLabel(exam.role)}` : exam.kind === "placement" ? `Finding your level · ${roleLabel(exam.role)}` : "Term check";
    // only what is needed to ask: the right answers stay on the server
    const questions = answers.map((x) => ({ id: x.id, form: x.form, prompt: x.prompt, options: x.options }));
    return <ExamRunner key={exam.id} examId={exam.id} title={what} sub={`${answers.length} questions, asked as deeply as ${rankName(exam.claimedTier)} level. Pass mark ${TERM_PASS * 100}%.`} startedAt={exam.startedAt} questions={questions} />;
  }

  const claimed = rankName(exam.claimedTier), reached = rankName(check.reached);
  const goal = goalNeed(user.id);
  const msg = check.verdict === "confirmed" ? SAY.confirmed(claimed) : check.verdict === "above" ? SAY.above(claimed, reached) : check.verdict === "below" ? SAY.below(claimed, reached) : SAY.unproven(claimed);
  const missed = answers.filter((a) => !a.right);
  const placement = exam.kind === "placement";
  const passed = (exam.score ?? 0) >= TERM_PASS;
  const step = nextStep(user.id, exam.role ? { role: exam.role, level: exam.level ?? 1 } : undefined);
  const title = placement ? `${Math.round((exam.score ?? 0) * 100)}% · ${passed ? `You passed ${claimed}` : `Not yet at ${claimed}`}` : `${Math.round((exam.score ?? 0) * 100)}% · ${check.reached ? reached : "Not yet at Initiate"}`;
  const sub = placement ? (passed ? `You knew ${TERM_PASS * 100}% or more of the ${claimed} terms asked. The next rank is open.` : `Fewer than ${TERM_PASS * 100}% of the ${claimed} terms were right, so this is where the climb stops for now. That is a start, not a failure: the terms you missed are below.`) : msg;
  const right = answers.filter((x) => x.right).length, skipped = answers.filter((x) => x.chosen == null).length;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ForgetSavedAnswers examId={exam.id} />
      <ResultHead score={exam.score ?? 0} title={title.replace(/^\d+% · /, "")} sub={sub} right={right} wrong={missed.length - skipped} skipped={skipped} seconds={Math.max(0, exam.finishedAt - exam.startedAt)} />
      {step.kind !== "start" && <TermNextStep step={step} />}
      <QuestionStrip answers={answers} />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <RankChart stats={check.stats} claimed={exam.claimedTier}
          note={goal && <p className="text-sm text-slate-300">Your goal, <b>{goal.title}</b>, asks for <b>{rankName(goal.rank)}</b>. {check.reached >= goal.rank ? "This check supports that." : "This check does not yet support that: keep working through the terms you missed."}</p>} />
        <TopicBars answers={answers} />
      </div>
      <Review examId={exam.id} answers={answers} />
      <p className="flex flex-wrap gap-4 text-sm">
        <Link href="/terms#test" className="btn btn-ghost">Make another check</Link>
        <Link href="/terms" className="underline self-center">Back to Terms</Link>
      </p>
    </div>
  );
}

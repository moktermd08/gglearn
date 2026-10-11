import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, roleExamAnswers, roleExams, questions } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PASS_MARK } from "@/lib/levels";
import { DOMAIN_KEYS, domainLabel } from "@/lib/blueprint";
import { domainResults, roleExamPlan } from "@/lib/roleExam";
import { roleLabel } from "@/lib/journey";
import { submitRoleExam } from "@/app/actions";
import { Quiz } from "@/components/Quiz";
import { Ring } from "@/components/Ring";
import { PageHero, PALETTE, Radar } from "@/components/charts";
import { ArrowLeft, Target, Trophy } from "lucide-react";

export const metadata = { title: "Role check — gglearn" };

export default async function RoleExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const examId = Number((await params).id);
  const exam = db.select().from(roleExams).where(and(eq(roleExams.id, examId), eq(roleExams.userId, user.id))).get();
  if (!exam) notFound();
  const rows = db.select({ a: roleExamAnswers, q: questions }).from(roleExamAnswers)
    .innerJoin(questions, eq(questions.id, roleExamAnswers.questionId)).where(eq(roleExamAnswers.examId, examId)).all();
  const title = `${roleLabel(exam.role)} role check`;

  if (!exam.finishedAt) {
    const now = roleExamPlan(user);
    const stale = !now || now.role !== exam.role || now.level !== exam.rung;
    return (
      <div className="space-y-4">
        <h1 className="text-center text-xl font-extrabold">{title}</h1>
        {stale && <p role="alert" className="text-center text-sm text-amber-300">This check was started for an earlier level or role, so passing it will not count towards your next promotion. <Link href="/journey" className="underline">Start a current one from your journey</Link>.</p>}
        <p className="text-center text-sm text-slate-400">{rows.length} questions across the areas your role is examined on.</p>
        <Quiz action={submitRoleExam.bind(null, examId)} level={exam.rung} rivalHue={260} rivalName="The panel"
          questions={rows.map(({ q }) => ({ id: q.id, prompt: q.prompt, code: q.code, type: q.type, options: q.options, topic: q.topic }))} />
      </div>
    );
  }

  const score = exam.score ?? 0, passed = !!exam.passed;
  const byDomain = domainResults(examId).sort((a, b) => a.score - b.score);
  const weakest = byDomain[0];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card space-y-4 p-6 text-center">
        <h1 className="text-xl font-extrabold">{title}</h1>
        <div className="flex justify-center"><Ring pct={score} label={`${Math.round(score * 100)}%`} sub={`pass ${PASS_MARK * 100}%`} size={140} color={passed ? "#34d399" : "#fbbf24"} /></div>
        <p className={`flex items-center justify-center gap-2 text-2xl font-extrabold ${passed ? "text-emerald-300" : "text-amber-300"}`}>
          {passed ? <Trophy className="text-yellow-300" /> : <Target />}{passed ? "You meet the bar across your role." : "Not there yet. See where to focus."}
        </p>
        <p className="text-xs text-slate-400">A role check measures readiness. It does not replace track exams, and promotion stays a manager&apos;s decision.</p>
        <Link href="/journey" className="btn btn-ghost"><ArrowLeft size={16} />Back to my journey</Link>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Score by area</h2>
        {byDomain.length >= 3 && <div className="flex justify-center"><Radar size={260} color={passed ? PALETTE.emerald : PALETTE.amber} axes={DOMAIN_KEYS.flatMap((d) => byDomain.filter((r) => r.domain === d)).map((r) => ({ label: domainLabel(r.domain), value: r.score }))} /></div>}
        <ul className="space-y-2.5">
          {DOMAIN_KEYS.flatMap((d) => byDomain.filter((r) => r.domain === d)).map((r) => (
            <li key={r.domain}>
              <div className="flex justify-between text-sm"><span>{domainLabel(r.domain)} <span className="text-xs text-slate-500">({r.asked} question{r.asked === 1 ? "" : "s"})</span></span><span className={`font-semibold ${r.score >= PASS_MARK ? "text-emerald-300" : r.score > 0.5 ? "text-amber-300" : "text-rose-300"}`}>{Math.round(r.score * 100)}%</span></div>
              <div className="bar mt-1"><i style={{ width: `${r.score * 100}%` }} /></div>
            </li>
          ))}
        </ul>
        {weakest && weakest.score < PASS_MARK && <p className="text-sm text-slate-300">Focus next on <b>{domainLabel(weakest.domain)}</b>.</p>}
      </section>
    </div>
  );
}

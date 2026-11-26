import { notFound } from "next/navigation";
import { Compass } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { StartForm } from "@/components/StartForm";
import { TermNextStep } from "@/components/TermNextStep";
import { goalNeed, termsAvailable } from "@/lib/terms";
import { EVERYONE, roleLabel, roleOptions } from "@/lib/termStudy";
import { nextStep } from "@/lib/termJourney";
import { targetsFor } from "@/lib/journey";

export const metadata = { title: "Start with terms — gglearn" };

export default async function Start({ searchParams }: { searchParams: Promise<{ first?: string; error?: string }> }) {
  const { first, error } = await searchParams;
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  const goal = goalNeed(user.id);
  const roles = roleOptions().map((o) => ({ role: o.role, label: roleLabel(o.role), hasTerms: o.hasTerms, levels: o.levels }));
  const mine = user.jobRole.toLowerCase();
  const defaultRole = goal && roles.some((r) => r.role === goal.role) ? goal.role : roles.some((r) => r.role === mine) ? mine : EVERYONE;
  const step = nextStep(user.id);
  // the levels this person's career path leads to: only these can be a career goal, though any role can be learned
  const goalable = targetsFor(user).flatMap((t) => t.levels.map((l) => `${t.role}|${l.level}`));
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHero Icon={Compass} tone="violet" title={first ? "Welcome. Let us find your starting point" : "What do you want to learn?"}
        sub="Every job has words you are expected to know. Say what you are learning and how much you know, and you get a list to study, questions that get deeper as you climb, and a clear next step." />
      {error && <p role="alert" className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {step.kind !== "start" && <TermNextStep step={step} />}
      <StartForm roles={roles} defaultRole={defaultRole} defaultLevel={goal?.role === defaultRole ? goal.level : 1} hasGoal={!!goal} goalable={goalable} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Hammer } from "lucide-react";
import { PageHero } from "@/components/charts";
import { CopyButton } from "@/components/CopyButton";
import { STEPS, fill } from "@/lib/build/progress";

/** One step of Build & launch, shown for anyone: where a stop on the map sends you to do the work for real. */
const generic = { name: "your product", pitch: "your idea", customer: "your customer", templateSlug: "custom" };

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = STEPS.find((s) => s.step.key === key);
  return { title: found ? `${found.step.title} — Build & launch — gglearn` : "Build & launch — gglearn" };
}

export default async function BuildStep({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = STEPS.find((s) => s.step.key === key);
  if (!found) notFound();
  const { step, rank, stage } = found;
  const prompt = step.prompt ? fill(step.prompt, generic) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Hammer} tone="indigo" title={step.title} sub={`${rank.title} rank · ${stage.title}`} />
      <section className="card space-y-4 p-5 text-sm">
        <p>{fill(step.why, generic)}</p>
        <ol className="list-decimal space-y-1 pl-5">{step.doIt.map((t, i) => <li key={i}>{fill(t, generic)}</li>)}</ol>
        {prompt && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2"><span className="font-semibold">A prompt to start with</span><CopyButton text={prompt} label="Copy prompt" /></div>
            <pre className="whitespace-pre-wrap rounded-xl bg-[#f1eee5] p-3 text-[13px] leading-relaxed text-slate-800">{prompt}</pre>
          </div>
        )}
        {step.learn && <Link href={`/tracks/${step.learn}`} className="inline-flex items-center gap-1.5 font-semibold text-sky-300 underline"><BookOpen size={14} />Learn the idea behind this step</Link>}
      </section>
      <p className="text-sm text-slate-400">Do this on a real project and your GitHub repository proves it. Start one, or carry on with the one you have.</p>
      <Link href="/build" className="btn w-fit">Build a real project<ArrowRight size={16} /></Link>
    </div>
  );
}

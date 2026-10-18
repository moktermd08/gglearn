import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { SubjectArt } from "@/components/SubjectArt";
import { KIND_LABEL } from "@/lib/levels";
import { trialTopics } from "@/lib/trial";
import { currentUser } from "@/lib/auth";
import { topicLabel } from "@/lib/topicName";

export const metadata: Metadata = { title: "Try it: three questions, no sign-up — gglearn", description: "Pick a topic and answer three real questions with instant feedback. No account needed." };

export default async function Try({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const topics = trialTopics(), me = await currentUser(), first = (await searchParams).first === "1";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="card pop space-y-3 p-6 text-center sm:p-8" style={{ background: "linear-gradient(135deg, rgba(99,102,241,.14), #fff 70%)" }}>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-500"><Zap size={24} /></span>
        {me ? (<>
          <h1 className="text-3xl font-extrabold">{first ? "Welcome. Let us get your first win." : "Three quick questions."}</h1>
          <p className="mx-auto max-w-xl text-slate-300">Pick anything below and answer three real questions with instant feedback. It takes about a minute, enrols you in the topic, and starts your streak.</p>
        </>) : (<>
          <h1 className="text-3xl font-extrabold">Try it. Three questions, no sign-up.</h1>
          <p className="mx-auto max-w-xl text-slate-300">Pick anything below and answer three real questions with instant feedback. It takes about a minute, and you can keep what you start for free afterwards.</p>
        </>)}
      </section>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <li key={t.slug}>
            <Link href={`/try/${t.slug}`} className="card card-hover flex items-center gap-3 p-4">
              <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={48} />
              <span className="min-w-0 flex-1"><span className="block text-xs uppercase tracking-wide text-slate-400">{KIND_LABEL[t.kind] ?? t.kind}</span><span className="block truncate font-semibold">{topicLabel(t.name)}</span></span>
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
          </li>))}
      </ul>
      {me ? <p className="text-center text-sm text-slate-400">Know exactly what you want? <Link href="/start" className="font-semibold underline">Set up a full race</Link> or <Link href="/dashboard" className="font-semibold underline">go to your path</Link>.</p>
        : <p className="text-center text-sm text-slate-400">Already have an account? <Link href="/login" className="font-semibold underline">Sign in</Link></p>}
    </div>
  );
}

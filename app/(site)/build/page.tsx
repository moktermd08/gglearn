import Link from "next/link";
import { ArrowRight, GitBranch, Hammer, LogIn, Rocket } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { RANKS } from "@/content/build/steps";
import { TEMPLATES } from "@/content/build/projects";
import { STEPS, doneFor, projectsFor, summary } from "@/lib/build/progress";
import { startProject } from "./actions";

export const metadata = { title: "Build & launch — gglearn", description: "Take a real product from idea to public launch with AI coding tools, with every step proved by your GitHub repository." };

const input = "w-full rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 focus:border-indigo-400 focus:outline-none";

export default async function BuildIndex({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await currentUser();
  const { error } = await searchParams;
  const mine = me ? projectsFor(me.id) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHero Icon={Hammer} tone="indigo" title="Build & launch a real product" sub={`From zero to launched, in ${STEPS.length} steps: idea, plan, design, brand, vibe coding, an AI agent, tests, security, deployment, marketing and sales, then data, money, risk and retirement. Everything you make lives in your own GitHub repository, and every step is checked against it.`} />

      {mine.length > 0 && (
        <section className="space-y-3" aria-labelledby="mine">
          <h2 id="mine" className="text-lg font-extrabold">Your projects</h2>
          <ul className="grid gap-3">
            {mine.map((p) => {
              const s = summary(doneFor(p.id), p.templateSlug);
              return (
                <li key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold">{p.name}</h3>
                    <p className="text-sm text-slate-400">{s.done} of {s.total} steps done{p.repo ? ` · ${p.repo}` : " · no repository linked yet"}</p>
                  </div>
                  <Link href={`/build/${p.id}`} className="btn">Carry on<ArrowRight size={16} /></Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="journey">
        <h2 id="journey" className="text-lg font-extrabold">The journey: {RANKS.length} ranks</h2>
        <ol className="space-y-3">
          {RANKS.map((r, i) => (
            <li key={r.key} className="card p-4">
              <h3 className="font-extrabold">{i + 1}. {r.title}{r.for && <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-300">for public services</span>}</h3>
              <p className="text-sm text-slate-400">{r.goal}</p>
              <p className="mt-2 text-sm">{r.stages.map((s) => s.title).join(" · ")}</p>
            </li>
          ))}
        </ol>
        <p className="flex items-start gap-2 text-sm text-slate-400"><GitBranch size={16} className="mt-0.5 shrink-0" aria-hidden />Every step ends in something that exists in your public repository: a document, a test, a release, a live site. Press Check and we read the repository on GitHub and tick what we find, so the finished repository is a portfolio that proves what you did.</p>
      </section>

      <section className="space-y-4" aria-labelledby="start">
        <h2 id="start" className="text-lg font-extrabold">Start a project</h2>
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
        {!me ? (
          <div className="card flex flex-wrap items-center gap-4 p-5">
            <p className="min-w-0 flex-1 text-sm">Sign in to start a project and keep your progress.</p>
            <Link href="/login?next=%2Fbuild" className="btn"><LogIn size={16} />Sign in</Link>
          </div>
        ) : (
          <form action={startProject} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">What will you build?</legend>
              {TEMPLATES.map((t, i) => (
                <label key={t.slug} className="card flex cursor-pointer items-start gap-3 p-4 has-[:checked]:border-indigo-400">
                  <input type="radio" name="template" value={t.slug} defaultChecked={i === 0} className="mt-1" />
                  <span className="min-w-0">
                    <span className="block font-bold">{t.title}</span>
                    <span className="block text-sm text-slate-400">{t.pitch}</span>
                    <span className="mt-1 block text-xs text-slate-400">First version: {t.mvp.slice(0, 2).join("; ")}…</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Name your product
                <input name="name" required minLength={2} maxLength={60} className={`${input} mt-1 font-normal`} placeholder="For example: Tidy Bookings" /></label>
              <label className="block text-sm font-semibold">Who is it for? <span className="font-normal text-slate-400">(optional unless it is your own idea)</span>
                <input name="customer" maxLength={120} className={`${input} mt-1 font-normal`} placeholder="For example: independent hairdressers" /></label>
            </div>
            <label className="block text-sm font-semibold">What does it do, in one sentence? <span className="font-normal text-slate-400">(required for your own idea)</span>
              <input name="pitch" maxLength={200} className={`${input} mt-1 font-normal`} placeholder="Leave empty to use the description above" /></label>
            <button className="btn"><Rocket size={16} />Start my project<ArrowRight size={16} /></button>
          </form>
        )}
      </section>
    </div>
  );
}

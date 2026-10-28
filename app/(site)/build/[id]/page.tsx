import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { BookOpen, CheckCircle2, Circle, ExternalLink, FolderGit2, GitBranch, PartyPopper, Rocket, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db, tracks } from "@/lib/db";
import { PageHero } from "@/components/charts";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmForm } from "@/components/ConfirmForm";
import { RANKS } from "@/content/build/steps";
import { templateBySlug } from "@/content/build/projects";
import { STEPS, doneFor, fill, projectFor, rankApplies, summary } from "@/lib/build/progress";
import { removeProject } from "../actions";
import { CheckButton, LinksForm, SelfForm } from "./forms";

export const metadata = { title: "Build & launch — gglearn" };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "my-project";
const when = (sec: number) => new Date(sec * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function BuildProject({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const project = Number.isInteger(Number(id)) ? projectFor(me.id, Number(id)) : undefined;
  if (!project) notFound();

  const done = doneFor(project.id);
  const sum = summary(done, project.templateSlug);
  const pct = Math.round((sum.done / sum.total) * 100);
  const template = templateBySlug(project.templateSlug);
  const learnSlugs = [...new Set(STEPS.flatMap((s) => (s.step.learn ? [s.step.learn] : [])))];
  const learnable = new Set(db.select({ slug: tracks.slug }).from(tracks).where(inArray(tracks.slug, learnSlugs)).all().map((t) => t.slug));
  const hints = project.checked?.hints ?? {};
  const newRepo = `https://github.com/new?${new URLSearchParams({ name: slugify(project.name), description: project.pitch.slice(0, 120), visibility: "public" })}`;
  const launched = sum.done === sum.total;
  const live = project.siteUrl;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero Icon={Rocket} tone="indigo" title={project.name} sub={project.pitch}>
        <p className="mt-3 text-sm text-slate-400">{template?.title} · for {project.customer}</p>
      </PageHero>

      <section className="card space-y-3 p-5" aria-label="Progress">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold">{sum.done} of {sum.total} steps done</h2>
          <span className="text-sm text-slate-400">{pct}%</span>
        </div>
        <div className="bar" role="img" aria-label={`${pct} percent of the steps are done`}><i style={{ width: `${pct}%` }} /></div>
        <ul className="grid gap-2 text-sm grid-cols-2 sm:grid-cols-4">
          {sum.ranks.map((r) => (
            <li key={r.rank.key} className="rounded-xl border border-black/10 p-2.5">
              <a href={`#rank-${r.rank.key}`} className="font-bold underline">{r.rank.title}</a>
              <p className="text-xs text-slate-400">{r.done} of {r.total}</p>
            </li>
          ))}
        </ul>
      </section>

      {launched && (
        <section className="card flex flex-wrap items-center gap-4 border-emerald-500/40 p-5">
          <PartyPopper className="text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">You launched {project.name}.</h2>
            <p className="text-sm text-slate-400">Every step is done and proved by your repository. Share the case study, and keep shipping.</p>
          </div>
          {project.repo && <a href={`https://github.com/${project.repo}/blob/HEAD/docs/14-case-study.md`} className="btn btn-ghost" target="_blank" rel="noreferrer noopener">Read the case study<ExternalLink size={14} /></a>}
        </section>
      )}

      <section className="card space-y-4 p-5" aria-label="Your GitHub repository">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><FolderGit2 size={20} aria-hidden />Your repository</h2>
          {project.repo
            ? <a href={`https://github.com/${project.repo}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-300 underline">{project.repo}<ExternalLink size={13} /></a>
            : <a href={newRepo} target="_blank" rel="noreferrer noopener" className="btn"><GitBranch size={16} />Create it on GitHub<ExternalLink size={14} /></a>}
        </div>
        {!project.repo && <p className="text-sm text-slate-400">Your work lives in one <strong>public</strong> repository on GitHub. The button opens GitHub with the name and description filled in: press Create repository, then paste its address below.</p>}
        <LinksForm projectId={project.id} repo={project.repo} site={project.siteUrl} />
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-black/10 pt-4">
          <p className="max-w-md text-sm text-slate-400">Do the work, commit it, then press Check. We read your public repository and tick every step it proves. Nothing is ticked on trust, except the few steps that happen away from GitHub.
            {project.checked && <> Last checked {when(project.checked.at)}.</>}</p>
          <CheckButton projectId={project.id} disabled={!project.repo} />
        </div>
      </section>

      {RANKS.filter((rank) => rankApplies(rank, project.templateSlug)).map((rank) => {
        const r = sum.ranks.find((x) => x.rank.key === rank.key)!;
        return (
          <section key={rank.key} id={`rank-${rank.key}`} className="space-y-4 scroll-mt-20" aria-labelledby={`h-${rank.key}`}>
            <header>
              <h2 id={`h-${rank.key}`} className="text-xl font-extrabold">{RANKS.indexOf(rank) + 1}. {rank.title} <span className="text-sm font-semibold text-slate-400">{r.done} of {r.total}</span></h2>
              <p className="text-sm text-slate-400">{rank.goal}</p>
            </header>
            {rank.stages.map((stage) => (
              <div key={stage.key} className="space-y-2">
                <div><h3 className="font-bold">{stage.title}</h3><p className="text-sm text-slate-400">{stage.blurb}</p></div>
                <ul className="space-y-2">
                  {stage.steps.map((step) => {
                    const d = done.get(step.key);
                    const self = step.check.kind === "self";
                    const prompt = step.prompt ? fill(step.prompt, project) : null;
                    return (
                      <li key={step.key}>
                        <details className="card group" open={sum.next === step.key}>
                          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                            {d ? <CheckCircle2 size={20} className="shrink-0 text-emerald-600" aria-label="Done" /> : <Circle size={20} className="shrink-0 text-slate-400" aria-label="Not done yet" />}
                            <span className="min-w-0 flex-1 font-semibold">{fill(step.title, project)}</span>
                            {d && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">{d.how === "github" ? "Proved on GitHub" : "Your note"}</span>}
                            {!d && sum.next === step.key && <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">Next</span>}
                          </summary>
                          <div className="space-y-3 border-t border-black/10 p-4 text-sm">
                            <p>{fill(step.why, project)}</p>
                            <ol className="list-decimal space-y-1 pl-5">{step.doIt.map((t, i) => <li key={i}>{fill(t, project)}</li>)}</ol>
                            {prompt && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2"><span className="font-semibold">A prompt to start with</span><CopyButton text={prompt} label="Copy prompt" /></div>
                                <pre className="whitespace-pre-wrap rounded-xl bg-[#f1eee5] p-3 text-[13px] leading-relaxed text-slate-800">{prompt}</pre>
                              </div>
                            )}
                            {d?.evidence && !self && <p className="text-emerald-600">Found: {d.evidence}</p>}
                            {!d && !self && hints[step.key] && <p role="note" className="rounded-xl bg-amber-500/10 p-3 text-amber-700">{hints[step.key]}</p>}
                            {self && step.check.kind === "self" && <SelfForm projectId={project.id} stepKey={step.key} min={step.check.min} note={d?.how === "self" ? d.evidence : null} />}
                            {step.learn && learnable.has(step.learn) && <Link href={`/tracks/${step.learn}`} className="inline-flex items-center gap-1.5 font-semibold text-sky-300 underline"><BookOpen size={14} />Learn the idea behind this step</Link>}
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      {live && <p className="text-sm text-slate-400">Live at <a href={live} target="_blank" rel="noreferrer noopener" className="underline">{live}</a></p>}
      <ConfirmForm action={removeProject.bind(null, project.id)} message="Delete this project and its progress here? Your GitHub repository is not touched." className="pt-2">
        <button className="inline-flex items-center gap-1 text-xs text-slate-400 underline"><Trash2 size={12} />Delete this project</button>
      </ConfirmForm>
    </div>
  );
}

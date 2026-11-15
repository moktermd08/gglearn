import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, CheckCircle2, Circle, Download, Plus, Target } from "lucide-react";
import { PageHero } from "@/components/charts";
import { CareerTabs } from "@/components/profile/CareerTabs";
import { Crumbs } from "@/components/profile/Crumbs";
import { InlineAction } from "@/components/cv/CvForms";
import { eraseStoriesAction } from "@/app/star-actions";
import { requireUser } from "@/lib/auth";
import { applicationsOf, coverage, nextStep, storiesOf } from "@/lib/star/data";
import { BEHAVIOURS, STATUSES, behaviourTitle } from "@/lib/star/framework";

export const metadata: Metadata = { title: "Behaviour stories — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Behaviours() {
  const me = await requireUser();
  const stories = storiesOf(me.id), apps = applicationsOf(me.id), cov = coverage(stories);
  const covered = cov.filter((c) => c.ready > 0).length, next = nextStep(me.id);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2"><Crumbs trail={[{ label: "Profile", href: "/profile" }, { label: "Behaviour stories" }]} /><CareerTabs current="behaviours" /></div>
      <PageHero Icon={Target} tone="indigo" title="Behaviour stories" sub="Write your real examples once in the STAR way, see which Civil Service behaviours they cover, and build an application pack from them. Private: only you can see this.">
        <Link href="/profile/behaviours/story/new" className="btn !py-1.5 text-sm"><Plus size={15} aria-hidden />New story</Link>
        <Link href="/profile/behaviours/applications/new" className="btn btn-ghost !py-1.5 text-sm"><Briefcase size={15} aria-hidden />New application</Link>
      </PageHero>

      {next && (
        <section className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-indigo-200 bg-indigo-50/60 p-4" aria-labelledby="next">
          <div className="min-w-0 flex-1"><h2 id="next" className="text-xs font-bold uppercase tracking-wide text-indigo-700">Next step</h2><p className="text-sm text-slate-700">{next.text}</p></div>
          <Link href={next.href} className="btn !py-1.5 text-sm">{next.label}</Link>
        </section>
      )}

      <section className="card space-y-3 p-5" aria-labelledby="cov">
        <h2 id="cov" className="text-lg font-bold">Your coverage <span className="text-sm font-normal text-slate-500">{covered} of {BEHAVIOURS.length} behaviours have a story that is ready</span></h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {cov.map((c) => (
            <li key={c.key} className="flex items-start gap-2 rounded-lg border border-black/10 p-2.5 text-sm">
              {c.ready ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Ready" /> : <Circle size={16} className="mt-0.5 shrink-0 text-slate-400" aria-label={c.total ? "Draft only" : "No story"} />}
              <span className="min-w-0"><span className="block font-semibold">{c.title}</span>
                <span className="block text-xs text-slate-500">{c.ready ? `${c.ready} ready` : c.total ? `${c.total} draft` : "No story yet"}{!c.total && <> · <Link href={`/profile/behaviours/story/new?b=${c.key}`} className="text-sky-700 underline">write one</Link></>}</span></span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">One strong story can often cover two behaviours. Aim for at least one ready story per behaviour, and two for the ones a job asks for most. Always check the advert for which behaviours and which level it wants.</p>
      </section>

      <section className="card space-y-3 p-5" aria-labelledby="stories">
        <h2 id="stories" className="text-lg font-bold">Your stories <span className="text-sm font-normal text-slate-500">{stories.length}</span></h2>
        {stories.length === 0 ? <p className="text-sm text-slate-600">No stories yet. Start with the work you are proudest of in the last two years. <Link href="/profile/behaviours/story/new" className="text-sky-700 underline">Write the first one</Link>.</p> : (
          <ul className="divide-y divide-black/10">
            {stories.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link href={`/profile/behaviours/story/${s.id}`} className="min-w-0 flex-1 font-semibold text-sky-800 hover:underline">{s.title}</Link>
                <span className="text-xs text-slate-500">{s.behaviours.length ? s.behaviours.map(behaviourTitle).join(", ") : "No behaviour chosen"}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{s.ready ? "Ready" : "Draft"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-5" aria-labelledby="apps">
        <h2 id="apps" className="text-lg font-bold">Your applications <span className="text-sm font-normal text-slate-500">{apps.length}</span></h2>
        {apps.length === 0 ? <p className="text-sm text-slate-600">Add a job you are applying for, tick the behaviours its advert asks for, and choose a story for each. Then download the pack to go with your application. <Link href="/profile/behaviours/applications/new" className="text-sky-700 underline">Add an application</Link>.</p> : (
          <ul className="divide-y divide-black/10">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link href={`/profile/behaviours/applications/${a.id}`} className="min-w-0 flex-1 font-semibold text-sky-800 hover:underline">{a.title}{a.department ? `, ${a.department}` : ""}</Link>
                {a.closesOn && <span className="text-xs text-slate-500">Closes {a.closesOn}</span>}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{STATUSES.find((s) => s.key === a.status)?.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-5" aria-labelledby="data">
        <h2 id="data" className="text-lg font-bold">Your data</h2>
        <p className="text-sm text-slate-600">Your stories and applications are private to you. Download them to keep, or erase them for good.</p>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/profile/behaviours/export" className="btn btn-ghost !py-1.5 text-sm"><Download size={15} aria-hidden />Download everything (JSON)</a>
          {(stories.length > 0 || apps.length > 0) && <InlineAction action={eraseStoriesAction} fields={{ confirm: "erase" }} label="Erase all stories and applications" tone="danger" confirm={`Erase all ${stories.length} stories and ${apps.length} applications? This cannot be undone. Download first if you want a copy.`} />}
        </div>
      </section>
    </div>
  );
}

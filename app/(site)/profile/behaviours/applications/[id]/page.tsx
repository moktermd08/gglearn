import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { InlineAction } from "@/components/cv/CvForms";
import { Crumbs } from "@/components/profile/Crumbs";
import { KeepForm } from "@/components/star/KeepForm";
import { LimitField } from "@/components/star/LimitField";
import { PickEditor } from "@/components/star/PickEditor";
import { deleteApplicationAction, saveApplicationAction } from "@/app/star-actions";
import { requireUser } from "@/lib/auth";
import { applicationOf, buildPack, picksOf, storiesOf } from "@/lib/star/data";
import { BEHAVIOURS, GRADES, STATUSES, isBehaviour } from "@/lib/star/framework";

export const metadata: Metadata = { title: "Application pack — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";
const lab = "block space-y-1 text-xs font-semibold text-slate-500";
const ghost = "btn btn-ghost !py-1.5 text-sm";

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const app = id === "new" ? null : Number.isInteger(Number(id)) ? applicationOf(me.id, Number(id)) : null;
  if (id !== "new" && !app) notFound();
  const stories = storiesOf(me.id);
  const picks = app ? picksOf(app.id) : [];
  const asked = new Set(picks.map((p) => p.behaviour));
  const pack = app ? buildPack(me.id, app.id) : null;
  const first = (await searchParams).b;
  if (!app && isBehaviour(first)) asked.add(first);
  const href = (q: string) => `/profile/behaviours/applications/${app?.id}/export?${q}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Crumbs trail={[{ label: "Profile", href: "/profile" }, { label: "Behaviour stories", href: "/profile/behaviours" }, { label: app ? app.title : "New application" }]} />
      <h1 className="text-2xl font-extrabold">{app ? app.title : "New application"}</h1>

      {app && (
        <nav aria-label="On this page" className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 text-xs font-semibold">
          <a href="#job" className="shrink-0 rounded-full border border-black/10 bg-[#fff] px-3 py-1 text-slate-600 hover:bg-slate-50">The job</a>
          {BEHAVIOURS.filter((b) => asked.has(b.key)).map((b) => {
            const e = pack?.entries.find((x) => x.behaviour === b.key);
            const tone = !e ? "border-amber-300 bg-amber-50 text-amber-800" : e.over > 0 ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800";
            return <a key={b.key} href={`#b-${b.key}`} className={`shrink-0 rounded-full border px-3 py-1 hover:brightness-95 ${tone}`}>{b.title}<span className="sr-only">{!e ? ": needs a story" : e.over > 0 ? `: ${e.over} over the limit` : ": ready"}</span><span aria-hidden>{!e ? " · needs a story" : e.over > 0 ? ` · ${e.over} over` : " · ready"}</span></a>;
          })}
          <a href="#out" className="shrink-0 rounded-full border border-black/10 bg-[#fff] px-3 py-1 text-slate-600 hover:bg-slate-50">Download</a>
        </nav>
      )}

      <section id="job" className="card scroll-mt-24 p-5" aria-labelledby="job-h">
        <h2 id="job-h" className="mb-3 text-lg font-bold">The job</h2>
        <KeepForm action={saveApplicationAction} className="space-y-3">
          {app && <input type="hidden" name="id" value={app.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Job title<input name="title" required maxLength={120} defaultValue={app?.title} className={field} /></label>
            <label className={lab}>Department or organisation<input name="department" maxLength={120} defaultValue={app?.department} className={field} /></label>
            <label className={lab}>Grade<select name="grade" defaultValue={app?.grade ?? "other"} className={field}>{GRADES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
            <label className={lab}>Closing date<input name="closesOn" type="date" defaultValue={app?.closesOn} className={field} /></label>
            <LimitField unit={app?.limitUnit ?? "words"} limit={app?.wordLimit ?? 250} />
            <label className={lab}>Where you are<select name="status" defaultValue={app?.status ?? "preparing"} className={field}>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          </div>
          <label className={lab}>Advert address (optional)<input name="advertUrl" maxLength={300} defaultValue={app?.advertUrl} placeholder="https://www.civilservicejobs.service.gov.uk/…" className={field} /></label>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-bold">Behaviours the advert asks for</legend>
            <p className="text-xs text-slate-500">Tick the ones listed in the advert. Many roles also ask for a personal statement; the pack covers the behaviours.</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {BEHAVIOURS.map((b) => <label key={b.key} className="flex items-center gap-2 rounded-lg border border-black/10 p-2 text-sm has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"><input type="checkbox" name="behaviours" value={b.key} defaultChecked={asked.has(b.key)} />{b.title}</label>)}
            </div>
          </fieldset>
          <label className={lab}>Notes to yourself<textarea name="note" rows={2} maxLength={600} defaultValue={app?.note} className={field} /></label>
          <button className="btn !py-1.5 text-sm">{app ? "Save job details" : "Create application"}</button>
        </KeepForm>
      </section>

      {app && (
        <>
          <section className="space-y-3" aria-labelledby="picks">
            <h2 id="picks" className="text-lg font-bold">Your answers</h2>
            {picks.length === 0 && <p className="card p-4 text-sm text-slate-600">Tick the behaviours the advert asks for above, save, and they will appear here.</p>}
            {BEHAVIOURS.filter((b) => asked.has(b.key)).map((b) => {
              const p = picks.find((x) => x.behaviour === b.key);
              if (!p) return null;
              return <div key={b.key} id={`b-${b.key}`} className="scroll-mt-24"><PickEditor key={`${b.key}-${p.updatedAt}-${p.storyId}`} applicationId={app.id} behaviour={b.key} title={b.title} gist={b.gist} limit={app.wordLimit} unit={app.limitUnit} storyId={p.storyId} answer={p.answer}
                stories={stories.map((s) => ({ id: s.id, title: s.title, ready: s.ready, tagged: s.behaviours.includes(b.key), text: { situation: s.situation, task: s.task, action: s.action, result: s.result } })).sort((x, y) => Number(y.tagged) - Number(x.tagged))} /></div>;
            })}
          </section>

          <section id="out" className="card scroll-mt-24 space-y-3 p-5" aria-labelledby="out-h">
            <h2 id="out-h" className="flex items-center gap-2 text-lg font-bold"><FileText size={18} aria-hidden />Take it with your application</h2>
            {pack && pack.missing.length > 0 && <p className="text-sm text-amber-700">Still to cover: {pack.missing.join(", ")}.</p>}
            {pack && pack.entries.some((e) => e.over) && <p className="text-sm text-rose-700">Over the limit: {pack.entries.filter((e) => e.over).map((e) => `${e.title} (${e.over} over)`).join(", ")}.</p>}
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Written statements</p>
              <div className="flex flex-wrap gap-2">
                <a href={href("format=pdf&mode=statements")} className={ghost}><Download size={15} aria-hidden />PDF</a>
                <a href={href("format=pdf&mode=statements&cv=1")} className={ghost}><Download size={15} aria-hidden />PDF with my CV in front</a>
                <a href={href("format=pdf&mode=statements&cv=1&blind=1")} className={ghost}><Download size={15} aria-hidden />PDF with CV, name left off</a>
                <a href={href("format=txt&mode=statements")} className={ghost}><Download size={15} aria-hidden />Plain text to paste</a>
              </div>
              <p className="pt-1 font-semibold">Interview cue sheet (short S, T, A, R lines)</p>
              <div className="flex flex-wrap gap-2">
                <a href={href("format=pdf&mode=cue")} className={ghost}><Download size={15} aria-hidden />PDF</a>
                <a href={href("format=txt&mode=cue")} className={ghost}><Download size={15} aria-hidden />Plain text</a>
              </div>
              <p className="text-xs text-slate-500">“CV in front” uses your recruiter view. “Name left off” removes your name and contact details from the CV pages and the pack, for applications marked without names; your employers and other details are still there. Your CV is built in <Link href="/profile/cv" className="text-sky-700 underline">Your CV</Link>.</p>
            </div>
          </section>

          <div className="text-right"><InlineAction action={deleteApplicationAction} fields={{ id: app.id }} label="Delete application" tone="danger" confirm="Delete this application and its answers? Your stories are kept." /></div>
        </>
      )}
    </div>
  );
}

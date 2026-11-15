import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { CvForm, InlineAction } from "@/components/cv/CvForms";
import { PickEditor } from "@/components/star/PickEditor";
import { deleteApplicationAction, saveApplicationAction } from "@/app/star-actions";
import { requireUser } from "@/lib/auth";
import { applicationOf, buildPack, picksOf, storiesOf } from "@/lib/star/data";
import { BEHAVIOURS, DEFAULT_WORD_LIMIT, GRADES, STATUSES, isBehaviour } from "@/lib/star/framework";

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
      <Link href="/profile/behaviours" className="btn btn-ghost !py-1 text-sm"><ArrowLeft size={15} aria-hidden />Back to your stories</Link>
      <h1 className="text-2xl font-extrabold">{app ? app.title : "New application"}</h1>

      <section className="card p-5" aria-labelledby="job">
        <h2 id="job" className="mb-3 text-lg font-bold">The job</h2>
        <CvForm action={saveApplicationAction} className="space-y-3">
          {app && <input type="hidden" name="id" value={app.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Job title<input name="title" required maxLength={120} defaultValue={app?.title} className={field} /></label>
            <label className={lab}>Department or organisation<input name="department" maxLength={120} defaultValue={app?.department} className={field} /></label>
            <label className={lab}>Grade<select name="grade" defaultValue={app?.grade ?? "other"} className={field}>{GRADES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
            <label className={lab}>Closing date<input name="closesOn" type="date" defaultValue={app?.closesOn} className={field} /></label>
            <label className={lab}>Words allowed for each behaviour<input name="wordLimit" type="number" min={50} max={1500} defaultValue={app?.wordLimit ?? DEFAULT_WORD_LIMIT} className={field} /></label>
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
        </CvForm>
      </section>

      {app && (
        <>
          <section className="space-y-3" aria-labelledby="picks">
            <h2 id="picks" className="text-lg font-bold">Your answers</h2>
            {picks.length === 0 && <p className="card p-4 text-sm text-slate-600">Tick the behaviours the advert asks for above, save, and they will appear here.</p>}
            {BEHAVIOURS.filter((b) => asked.has(b.key)).map((b) => {
              const p = picks.find((x) => x.behaviour === b.key);
              if (!p) return null;
              return <PickEditor key={`${b.key}-${p.updatedAt}-${p.storyId}`} applicationId={app.id} behaviour={b.key} title={b.title} gist={b.gist} limit={app.wordLimit} storyId={p.storyId} answer={p.answer}
                stories={stories.map((s) => ({ id: s.id, title: s.title, ready: s.ready, tagged: s.behaviours.includes(b.key), text: { situation: s.situation, task: s.task, action: s.action, result: s.result } })).sort((x, y) => Number(y.tagged) - Number(x.tagged))} />;
            })}
          </section>

          <section className="card space-y-3 p-5" aria-labelledby="out">
            <h2 id="out" className="flex items-center gap-2 text-lg font-bold"><FileText size={18} aria-hidden />Take it with your application</h2>
            {pack && pack.missing.length > 0 && <p className="text-sm text-amber-700">Still to cover: {pack.missing.join(", ")}.</p>}
            {pack && pack.entries.some((e) => e.over) && <p className="text-sm text-rose-700">Over the word limit: {pack.entries.filter((e) => e.over).map((e) => `${e.title} (${e.over} over)`).join(", ")}.</p>}
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

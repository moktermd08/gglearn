import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Download, Eye, EyeOff, FileText, Globe, KeyRound, Link2, Plus, ShieldCheck } from "lucide-react";
import { answerNotes, cvEntries, cvLinks, cvProfiles, cvQuotes, db, users } from "@/lib/db";
import { requireUser, viewAsState } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { CopyField, CvForm, InlineAction, UseSuggestion } from "@/components/cv/CvForms";
import { hiddenKeys, platformFacts } from "@/lib/cv/build";
import { DAYS, pathOf, stateOf, viewOf, type Link as CvLink } from "@/lib/cv/links";
import { suggestFor } from "@/lib/cv/suggest";
import { parseJson } from "@/lib/cv/text";
import { ENTRY_KIND_LIST, ENTRY_LABEL, PRESETS, SECTION_HELP, SECTION_KEYS, SECTION_TITLE, TEMPLATES, type EntryKind } from "@/lib/cv/types";
import { siteUrl } from "@/lib/share";
import { createLinkAction, deleteEntryAction, featureQuoteAction, moveEntryAction, revokeLinkAction, saveEntryAction, saveProfileAction, toggleEntryAction, toggleHiddenAction, updateLinkAction } from "@/app/cv-actions";

export const metadata: Metadata = { title: "Your CV — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";
const lab = "block space-y-1 text-xs font-semibold text-slate-500";
const btn = "btn !py-1.5 text-sm";
const ghost = "btn btn-ghost !py-1.5 text-sm";
const sec = "card space-y-3 p-5 scroll-mt-24";
const h2 = "flex items-center gap-2 text-lg font-bold";
const day = (s: number) => new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const WORDS: Record<EntryKind, { title: string; org?: string; dates: boolean; body: boolean; yearOnly?: boolean }> = {
  experience: { title: "Job title", org: "Employer", dates: true, body: true },
  project: { title: "Project name", org: "For whom or where", dates: true, body: true },
  education: { title: "Course or qualification", org: "School or provider", dates: true, body: true },
  volunteer: { title: "Role", org: "Organisation", dates: true, body: true },
  award: { title: "Award", org: "Given by", dates: true, body: false, yearOnly: true },
  language: { title: "Language", org: "Level (for example Native, Fluent, Basic)", dates: false, body: false },
  skill: { title: "Skill", dates: false, body: false },
};
const ACCENTS = [["", "Default"], ["#2563eb", "Blue"], ["#059669", "Green"], ["#7c3aed", "Violet"], ["#e11d48", "Rose"], ["#d97706", "Amber"], ["#334155", "Slate"]] as const;

function EntryForm({ kind, e }: { kind: EntryKind; e?: typeof cvEntries.$inferSelect }) {
  const w = WORDS[kind];
  return (
    <CvForm action={saveEntryAction} resetOnDone={!e} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />{e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={lab}>{w.title}<input name="title" required maxLength={120} defaultValue={e?.title} className={field} /></label>
        {w.org && <label className={lab}>{w.org}<input name="org" maxLength={120} defaultValue={e?.org} className={field} /></label>}
        {w.dates && kind !== "award" && <label className={lab}>Place (optional)<input name="location" maxLength={80} defaultValue={e?.location} className={field} /></label>}
        {w.dates && <label className={lab}>{w.yearOnly ? "Year" : "Started"} (2024 or 2024-05)<input name="startsOn" maxLength={7} defaultValue={e?.startsOn} placeholder="2024-05" className={field} /></label>}
        {w.dates && !w.yearOnly && <label className={lab}>Finished<input name="endsOn" maxLength={7} defaultValue={e?.endsOn} placeholder="leave empty if current" className={field} /></label>}
      </div>
      {w.dates && !w.yearOnly && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="current" defaultChecked={e?.current} />I am still doing this</label>}
      {w.body && <label className={lab}>What you did and achieved (one point per line)<textarea name="body" rows={4} maxLength={1500} defaultValue={e?.body} placeholder={"Handled 60+ customer contacts a day\nCut average handling time by 12%"} className={field} /></label>}
      <button className={btn}>{e ? "Save changes" : `Add ${ENTRY_LABEL[kind].one}`}</button>
    </CvForm>
  );
}

function ViewBoxes({ view }: { view: ReturnType<typeof viewOf> }) {
  return (
    <fieldset className="space-y-1.5 text-sm">
      <legend className="text-xs font-semibold text-slate-500">What this link shows</legend>
      <input type="hidden" name="custom" value="1" />
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {SECTION_KEYS.map((k) => <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`sec_${k}`} defaultChecked={view.sections[k]} />{SECTION_TITLE[k]}</label>)}
      </div>
      <div className="grid gap-x-4 gap-y-1 border-t border-black/5 pt-1.5 sm:grid-cols-2">
        {(["email", "phone", "location", "links"] as const).map((k) => <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`c_${k}`} defaultChecked={view.contact[k]} />Show my {k === "links" ? "links" : k}</label>)}
      </div>
    </fieldset>
  );
}

export default async function CvPage() {
  const me = await requireUser();
  const viewing = (await viewAsState()) !== null;
  const base = await siteUrl();
  const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, me.id)).get();
  const entries = db.select().from(cvEntries).where(eq(cvEntries.userId, me.id)).orderBy(cvEntries.sort, cvEntries.id).all();
  const facts = platformFacts(me.id, base), hidden = hiddenKeys(me.id), sug = suggestFor(me.id, base)!;
  const links = db.select().from(cvLinks).where(eq(cvLinks.userId, me.id)).orderBy(desc(cvLinks.id)).all();
  const live = links.filter((l) => stateOf(l) === "open"), past = links.filter((l) => stateOf(l) !== "open");
  const praise = db.select({ n: answerNotes, who: users.name }).from(answerNotes).innerJoin(users, eq(users.id, answerNotes.authorId))
    .where(and(eq(answerNotes.learnerId, me.id), eq(answerNotes.quotable, true), eq(answerNotes.kind, "praise"), isNull(answerNotes.deletedAt))).orderBy(desc(answerNotes.id)).all();
  const featured = new Set(db.select({ n: cvQuotes.noteId }).from(cvQuotes).where(eq(cvQuotes.userId, me.id)).all().map((r) => r.n));
  const links0 = parseJson<{ label: string; url: string }[]>(p?.links ?? "[]", []).map((l) => (l.label ? `${l.label} | ${l.url}` : l.url)).join("\n");
  const platform = [
    { title: "Verified certificates", items: facts.certs }, { title: "Assessed skills", items: facts.skills.slice(0, 15) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero Icon={FileText} tone="indigo" title="Your CV" sub="Built from what you do here and what you add. Private until you share it, and you choose what each reader sees.">
        <Link href="/profile/cv/preview" className={ghost}><Eye size={15} aria-hidden />Preview</Link>
        <a href="/profile/cv/pdf" className={ghost}><Download size={15} aria-hidden />Download PDF</a>
      </PageHero>
      {viewing && <p className="card border-l-4 border-amber-500 p-3 text-sm text-amber-900">You are viewing as someone else, so their CV cannot be changed here. Exit the view (red bar) to change your own.</p>}

      <section className={sec} aria-labelledby="cv-score">
        <h2 id="cv-score" className={h2}><ShieldCheck size={18} aria-hidden />How complete it is: {sug.percent}%</h2>
        <div className="h-2 overflow-hidden rounded-full bg-black/10" role="img" aria-label={`${sug.percent} percent complete`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${sug.percent}%` }} /></div>
        {sug.tips.length > 0 ? <ul className="space-y-1 text-sm">{sug.tips.map((t) => <li key={t.id}><a href={`#${t.section}`} className="text-sky-700 underline">{t.text}</a></li>)}</ul> : <p className="text-sm text-emerald-700">Nothing missing. Keep it up to date as you learn.</p>}
        <p className="text-xs text-slate-400">From the platform: {facts.certs.length} verified {facts.certs.length === 1 ? "certificate" : "certificates"}, {facts.topics} assessed {facts.topics === 1 ? "topic" : "topics"}, {facts.levels} levels passed. These appear automatically; you can hide any of them below.</p>
      </section>

      <section id="profile" className={sec} aria-labelledby="cv-profile">
        <h2 id="cv-profile" className={h2}>Headline, summary and contact</h2>
        <CvForm action={saveProfileAction} className="space-y-3">
          <label className={lab}>Headline <span className="font-normal">{sug.headline && sug.headline !== p?.headline && <UseSuggestion field="headline" text={sug.headline} label={`Use “${sug.headline}”`} />}</span>
            <input name="headline" maxLength={120} defaultValue={p?.headline} placeholder="Customer service professional aiming for the Civil Service" className={field} /></label>
          <label className={lab}>Summary <span className="font-normal">{sug.summary && <UseSuggestion field="summary" text={sug.summary} label="Write one from my results" />}</span>
            <textarea name="summary" rows={4} maxLength={1200} defaultValue={p?.summary} placeholder="Two or three sentences: who you are, what you are good at, what you want next." className={field} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Location<input name="location" maxLength={80} defaultValue={p?.location} placeholder="London, UK" className={field} /></label>
            <label className={lab}>Contact email (for the CV)<input name="contactEmail" type="email" maxLength={120} defaultValue={p?.contactEmail} placeholder="you@example.com" className={field} /></label>
            <label className={lab}>Phone<input name="phone" maxLength={30} defaultValue={p?.phone} className={field} /></label>
          </div>
          <label className={lab}>Links (one per line, optionally “Label | address”)
            <textarea name="links" rows={3} maxLength={900} defaultValue={links0} placeholder={"LinkedIn | https://linkedin.com/in/you\nhttps://yourportfolio.example"} className={`${field} font-mono`} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>Layout<select name="template" defaultValue={p?.template ?? "classic"} className={field}>{TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}: {t.help}</option>)}</select></label>
            <label className={lab}>Accent colour<select name="accent" defaultValue={p?.accent ?? ""} className={field}>{ACCENTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          </div>
          <p className="text-xs text-slate-400">Your email, phone and location are only shown on a link where you switch them on. Your login email is never used.</p>
          <button className={btn}>Save</button>
        </CvForm>
      </section>

      {ENTRY_KIND_LIST.map((kind) => {
        const mine = entries.filter((e) => e.kind === kind), L = ENTRY_LABEL[kind];
        const suggestions = kind === "experience" ? sug.experience : [];
        return (
          <section key={kind} id={L.section} className={sec} aria-labelledby={`cv-h-${kind}`}>
            <h2 id={`cv-h-${kind}`} className={h2}>{L.many}</h2>
            <p className="text-xs text-slate-400">{SECTION_HELP[L.section]}</p>
            {suggestions.map((s) => (
              <CvForm key={s.org} action={saveEntryAction} className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-500/5 p-2 text-sm">
                <input type="hidden" name="kind" value="experience" /><input type="hidden" name="title" value={s.title} /><input type="hidden" name="org" value={s.org} /><input type="hidden" name="startsOn" value={s.startsOn} /><input type="hidden" name="current" value="on" />
                <span className="min-w-0 flex-1">You belong to <b>{s.org}</b> here. Add it as experience (<i>{s.title}</i>, from {s.startsOn})?</span><button className={ghost}><Plus size={14} aria-hidden />Add</button>
              </CvForm>
            ))}
            {mine.length > 0 && (
              <ul className="space-y-2">
                {mine.map((e, i) => (
                  <li key={e.id} className={`rounded-lg border border-black/5 p-2.5 text-sm ${e.visible ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="min-w-0 flex-1">{e.title}{e.org && <span className="font-normal text-slate-500"> · {e.org}</span>}{!e.visible && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">hidden</span>}</b>
                      <InlineAction action={moveEntryAction} fields={{ id: e.id, dir: "up" }} label={i === 0 ? "Top" : "Up"} />
                      <InlineAction action={moveEntryAction} fields={{ id: e.id, dir: "down" }} label="Down" />
                      <InlineAction action={toggleEntryAction} fields={{ id: e.id }} label={e.visible ? "Hide" : "Show"} />
                      <InlineAction action={deleteEntryAction} fields={{ id: e.id }} label="Remove" tone="danger" confirm={`Remove “${e.title}” from your CV?`} />
                    </div>
                    <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-sky-700 underline">Edit</summary><div className="mt-2"><EntryForm kind={kind} e={e} /></div></details>
                  </li>
                ))}
              </ul>
            )}
            <details open={mine.length === 0}><summary className="cursor-pointer text-sm font-semibold text-sky-700 underline"><Plus size={13} className="mr-1 inline" aria-hidden />Add {L.one}</summary><div className="mt-2"><EntryForm kind={kind} /></div></details>
          </section>
        );
      })}

      <section id="certificates" className={sec} aria-labelledby="cv-platform">
        <h2 id="cv-platform" className={h2}><ShieldCheck size={18} aria-hidden />From your learning here</h2>
        <p className="text-xs text-slate-400">These come from your real results and appear on your CV automatically. Hide anything you would rather not show. A revoked certificate is never shown.</p>
        {platform.map((g) => (
          <div key={g.title} className="space-y-1.5">
            <h3 className="text-sm font-bold">{g.title}</h3>
            {g.items.length === 0 ? <p className="text-sm text-slate-400">Nothing yet. {g.title === "Verified certificates" ? "Pass level 5 of a topic to earn one." : "Pass a level to see it here."}</p> : (
              <ul className="divide-y divide-black/5 text-sm">
                {g.items.map((it) => (
                  <li key={it.key} className={`flex flex-wrap items-center gap-2 py-1.5 ${hidden.has(it.key!) ? "opacity-60" : ""}`}>
                    <span className="min-w-0 flex-1">{it.title} <span className="text-slate-400">· {it.subtitle}</span></span>
                    {it.verify && <a href={it.verify.url} className="text-xs text-sky-700 underline">check</a>}
                    <InlineAction action={toggleHiddenAction} fields={{ key: it.key! }} label={hidden.has(it.key!) ? "Show" : "Hide"} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-2 text-sm"><span className="flex-1">Learning record line (levels passed, certificates, how active you have been)</span><InlineAction action={toggleHiddenAction} fields={{ key: "stat:highlights" }} label={hidden.has("stat:highlights") ? "Show" : "Hide"} /></div>
      </section>

      <section id="quotes" className={sec} aria-labelledby="cv-quotes">
        <h2 id="cv-quotes" className={h2}>What reviewers say</h2>
        <p className="text-xs text-slate-400">When a mentor or manager praises one of your answers they can allow it to be quoted, with their name. You choose whether to feature it, and they can take their permission back, which removes it here.</p>
        {praise.length === 0 ? <p className="text-sm text-slate-400">No quotable praise yet. It appears here when a reviewer allows it.</p> : (
          <ul className="space-y-2">
            {praise.map(({ n, who }) => (
              <li key={n.id} className="space-y-1 rounded-lg border border-black/5 p-2.5 text-sm">
                <p className="italic">“{n.body.slice(0, 280)}”</p>
                <div className="flex flex-wrap items-center gap-2"><span className="flex-1 text-xs text-slate-500">{who} · {day(n.createdAt)}</span>
                  <InlineAction action={featureQuoteAction} fields={{ noteId: n.id, on: featured.has(n.id) ? 0 : 1 }} label={featured.has(n.id) ? "Stop featuring" : "Feature on my CV"} />
                  {featured.has(n.id) && <InlineAction action={toggleHiddenAction} fields={{ key: `quote:${n.id}` }} label="Hide for now" />}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="share" className={sec} aria-labelledby="cv-share">
        <h2 id="cv-share" className={h2}><Globe size={18} aria-hidden />Share it</h2>
        <p className="text-sm text-slate-600">Nothing is shared until you make a link. Each link has its own view, so a recruiter can see your email and phone while a public page does not. You can end a link at any time.</p>
        <CvForm action={createLinkAction} resetOnDone className="space-y-3 rounded-lg bg-black/[0.03] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Kind<select name="kind" defaultValue="private" className={field}><option value="private">Private link: anyone with the link</option><option value="passcode">Passcode: link plus a code you give them</option><option value="public">Public: a page anyone can open</option></select></label>
            <label className={lab}>Who it is for (your note)<input name="label" maxLength={80} placeholder="e.g. Acme recruiter" className={field} /></label>
            <label className={lab}>Shows<select name="preset" defaultValue="recruiter" className={field}>{(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => <option key={k} value={k}>{PRESETS[k].label}: {PRESETS[k].help}</option>)}</select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Passcode (passcode links only, 6+ characters)<input name="passcode" type="text" autoComplete="off" maxLength={64} className={field} /></label>
            <label className={lab}>Ends<select name="days" defaultValue="90" className={field}><option value="">Never</option>{DAYS.map((d) => <option key={d} value={d}>After {d} days</option>)}</select></label>
            <div className="space-y-1.5 pt-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="allowPdf" defaultChecked />Let them download a PDF</label><label className="flex items-center gap-2"><input type="checkbox" name="indexable" />Public only: let search engines list it</label></div>
          </div>
          <button className={btn}><Link2 size={14} aria-hidden />Create link</button>
        </CvForm>

        {live.length === 0 ? <p className="text-sm text-slate-400">No live links yet.</p> : (
          <ul className="space-y-3">
            {live.map((l: CvLink) => (
              <li key={l.id} className="space-y-2 rounded-lg border border-black/10 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="min-w-0 flex-1">{l.label || "Untitled link"}</b>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{l.kind === "passcode" ? <><KeyRound size={10} className="mr-1 inline" aria-hidden />passcode</> : l.kind}</span>
                  <span className="text-xs text-slate-500">{l.views} {l.views === 1 ? "view" : "views"}{l.lastViewedAt ? ` · last ${day(l.lastViewedAt)}` : ""}{l.expiresAt ? ` · ends ${day(l.expiresAt)}` : " · no end"}{l.allowPdf ? " · PDF allowed" : " · no PDF"}</span>
                </div>
                <CopyField value={`${base}${pathOf(l)}`} label={`Link for ${l.label || "this link"}`} />
                {l.kind === "passcode" && <p className="text-xs text-slate-500">Give them the passcode you chose when you made it. It is not stored in a form that can be shown again.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/profile/cv/preview?as=${l.id}`} className="text-xs font-semibold text-sky-700 underline">Preview as this reader</Link>
                  <a href={`/profile/cv/pdf?as=${l.id}`} className="text-xs font-semibold text-sky-700 underline">Download PDF as this reader</a>
                  <span className="flex-1" /><InlineAction action={revokeLinkAction} fields={{ id: l.id }} label="Revoke" tone="danger" confirm="Revoke this link? Anyone using it will no longer be able to open your CV." />
                </div>
                <details><summary className="cursor-pointer text-xs font-semibold text-sky-700 underline">Change what it shows</summary>
                  <CvForm action={updateLinkAction} className="mt-2 space-y-3">
                    <input type="hidden" name="id" value={l.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={lab}>Note<input name="label" maxLength={80} defaultValue={l.label} className={field} /></label>
                      <label className={lab}>Ends<select name="days" defaultValue="keep" className={field}><option value="keep">Keep as it is</option><option value="none">Never</option>{DAYS.map((d) => <option key={d} value={d}>Restart: {d} days from now</option>)}</select></label>
                      <div className="space-y-1.5 pt-5"><label className="flex items-center gap-2"><input type="checkbox" name="allowPdf" defaultChecked={l.allowPdf} />PDF download</label>{l.kind === "public" && <label className="flex items-center gap-2"><input type="checkbox" name="indexable" defaultChecked={l.indexable} />Search engines</label>}</div>
                    </div>
                    <ViewBoxes view={viewOf(l)} /><button className={btn}>Save changes</button>
                  </CvForm>
                </details>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-xs text-slate-500">{past.length} ended {past.length === 1 ? "link" : "links"}</summary><ul className="mt-1 space-y-0.5 text-xs text-slate-500">{past.map((l) => <li key={l.id}>{l.label || "Untitled link"} · {l.kind} · {l.revokedAt ? "revoked" : "ended"} · {l.views} views</li>)}</ul></details>}
        <p className="flex items-center gap-1.5 text-xs text-slate-400"><EyeOff size={12} aria-hidden />We keep a count of views and the time of the last one. We do not record who looked.</p>
      </section>
    </div>
  );
}

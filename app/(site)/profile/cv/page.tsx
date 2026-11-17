import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Download, FileDown, FileUp, Eye, EyeOff, FileText, Globe, KeyRound, Link2, Plus, ShieldCheck } from "lucide-react";
import { answerNotes, cvEntries, cvLinks, cvProfiles, cvQuotes, db, users } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { CopyField, CvForm, InlineAction, UseSuggestion } from "@/components/cv/CvForms";
import { buildCv, hiddenKeys, platformFacts } from "@/lib/cv/build";
import { Exposure, LinkActivity, LinkHead, LinksOverview, Lifespan, KIND } from "@/components/cv/LinkViz";
import { Ring } from "@/components/Ring";
import { CommentThread } from "@/components/cv/CommentThread";
import { commentsForOwner, openCommentCount, reviewersOf } from "@/lib/cv/review";
import { DAYS, historyOf, pathOf, stateOf, viewOf, type Link as CvLink } from "@/lib/cv/links";
import { askable, endorsementsOf } from "@/lib/cv/endorse";
import { suggestFor } from "@/lib/cv/suggest";
import { parseJson } from "@/lib/cv/text";
import { ENTRY_KIND_LIST, ENTRY_LABEL, PRESETS, SECTION_HELP, SECTION_KEYS, SECTION_TITLE, TEMPLATES, type EntryKind } from "@/lib/cv/types";
import { siteUrl } from "@/lib/share";
import { cancelRequestAction, createLinkAction, endReviewerAction, inviteReviewerAction, decideEndorsementAction, deleteEntryAction, featureQuoteAction, moveEntryAction, requestEndorsementAction, revokeLinkAction, saveEntryAction, saveProfileAction, toggleEntryAction, toggleHiddenAction, updateLinkAction } from "@/app/cv-actions";

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
  const base = await siteUrl();
  const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, me.id)).get();
  const entries = db.select().from(cvEntries).where(eq(cvEntries.userId, me.id)).orderBy(cvEntries.sort, cvEntries.id).all();
  const facts = platformFacts(me.id, base), hidden = hiddenKeys(me.id), sug = suggestFor(me.id, base)!;
  const links = db.select().from(cvLinks).where(eq(cvLinks.userId, me.id)).orderBy(desc(cvLinks.id)).all();
  const live = links.filter((l) => stateOf(l) === "open"), past = links.filter((l) => stateOf(l) !== "open");
  const hist = new Map(live.map((l) => [l.id, historyOf(me.id, l.id) ?? []] as const));
  const praise = db.select({ n: answerNotes, who: users.name }).from(answerNotes).innerJoin(users, eq(users.id, answerNotes.authorId))
    .where(and(eq(answerNotes.learnerId, me.id), eq(answerNotes.quotable, true), eq(answerNotes.kind, "praise"), isNull(answerNotes.deletedAt))).orderBy(desc(answerNotes.id)).all();
  const featured = new Set(db.select({ n: cvQuotes.noteId }).from(cvQuotes).where(eq(cvQuotes.userId, me.id)).all().map((r) => r.n));
  const refs = endorsementsOf(me.id), live0 = new Set(refs.filter((r) => ["requested", "pending", "approved"].includes(r.status)).map((r) => r.authorId));
  const toAsk = askable(me).filter((a) => !live0.has(a.id));
  const comments = commentsForOwner(me.id), openComments = openCommentCount(me.id), rv = reviewersOf(me.id);
  const fullDoc = buildCv(me.id, PRESETS.full.view, base);
  const titleOf = new Map((fullDoc?.sections ?? []).flatMap((x) => x.items.map((i) => [i.anchor ?? "", i.title || x.title] as const)));
  const links0 = parseJson<{ label: string; url: string }[]>(p?.links ?? "[]", []).map((l) => (l.label ? `${l.label} | ${l.url}` : l.url)).join("\n");
  const platform = [
    { title: "Verified certificates", items: facts.certs }, { title: "Assessed skills", items: facts.skills.slice(0, 15) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero Icon={FileText} tone="indigo" title="Your CV" sub="Built from what you do here and what you add. Private until you share it, and you choose what each reader sees.">
        <Link href="/profile/cv/preview" className={ghost}><Eye size={15} aria-hidden />Preview</Link>
        <a href="/profile/cv/pdf" className={ghost}><Download size={15} aria-hidden />Download PDF</a>
        <Link href="/profile/cv/import" className={ghost}><FileUp size={15} aria-hidden />Import</Link>
        <a href="/profile/cv/export" className={ghost}><FileDown size={15} aria-hidden />Export</a>
      </PageHero>

      <section className={`${sec} !p-0 overflow-hidden`} aria-labelledby="cv-score">
        <div className="flex flex-wrap items-center gap-5 bg-gradient-to-br from-emerald-500/[0.07] via-white to-sky-500/[0.07] p-5">
          <Ring pct={sug.percent / 100} size={104} label={`${sug.percent}%`} sub="complete" color="#10b981" />
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="cv-score" className={h2}><ShieldCheck size={18} aria-hidden />{sug.percent >= 100 ? "Your CV is complete" : "Next steps to finish it"}</h2>
            {sug.tips.length > 0 ? <ol className="space-y-1.5 text-sm">{sug.tips.map((t, i) => <li key={t.id}><a href={`#${t.section}`} className="group flex items-center gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-800">{i + 1}</span><span className="text-sky-800 group-hover:underline">{t.text}</span></a></li>)}</ol> : <p className="text-sm text-emerald-700">Nothing missing. Keep it up to date as you learn.</p>}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[[facts.certs.length, facts.certs.length === 1 ? "certificate" : "certificates"], [facts.topics, facts.topics === 1 ? "topic" : "topics"], [facts.levels, "levels passed"]].map(([n, w]) => <div key={w as string} className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-black/5"><dt className="text-xl font-extrabold leading-none">{n}</dt><dd className="mt-1 text-[11px] text-slate-500">{w}</dd></div>)}
          </dl>
        </div>
        <p className="border-t border-black/5 px-5 py-2 text-xs text-slate-400">Verified results appear on your CV automatically; you can hide any of them below.</p>
      </section>

      <nav aria-label="CV sections" className="sticky top-14 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl bg-white/90 p-1.5 text-xs font-semibold shadow-sm ring-1 ring-black/5 backdrop-blur">
        {[["profile", "Headline"], ["experience", "Experience"], ["education", "Education"], ["certificates", "Certificates"], ["endorsements", "References"], ["feedback", "Feedback"], ["share", "Share links"]].map(([id, n]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-sky-500/10 hover:text-sky-800">{n}{id === "feedback" && openComments > 0 ? <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{openComments}</span> : null}{id === "share" && live.length > 0 ? <span className="ml-1 rounded-full bg-sky-600 px-1.5 text-[10px] text-white">{live.length}</span> : null}</a>)}
      </nav>

      <section id="feedback" className={sec} aria-labelledby="cv-feedback">
        <h2 id="cv-feedback" className={h2}>Feedback on your CV{openComments > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-800">{openComments} open</span>}</h2>
        <p className="text-xs text-slate-400">Let a mentor or manager read your draft and comment on any section or item. They see your work, skills and certificates, never your email, phone, location or links, and you can end it at any time. You decide what to change: mark each comment done, or say you will not.</p>
        {rv.active.length > 0 && (
          <ul className="space-y-1 text-sm">{rv.active.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{a.name} <span className="text-slate-400">· can read your draft</span></span><InlineAction action={endReviewerAction} fields={{ reviewerId: a.id }} label="End access" tone="danger" confirm="Stop them reading your draft? Their comments stay here." /></li>)}</ul>
        )}
        {rv.invitable.length > 0 && (
          <div className="space-y-1.5"><h3 className="text-sm font-bold">Ask someone to review it</h3>
            <ul className="space-y-1 text-sm">{rv.invitable.slice(0, 20).map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{a.name} <span className="text-slate-400">· {a.label}</span></span><InlineAction action={inviteReviewerAction} fields={{ reviewerId: a.id }} label="Let them review" /></li>)}</ul></div>
        )}
        {rv.active.length === 0 && rv.invitable.length === 0 && <p className="text-xs text-slate-400">You have no manager or mentor to ask yet. A mentor is someone you invite from the Mentoring page.</p>}
        {comments.length === 0 ? <p className="text-sm text-slate-400">No comments yet.</p> : (
          <ul className="space-y-3">
            {[...comments.filter((c) => c.status === "open"), ...comments.filter((c) => c.status !== "open")].map((c) => (
              <li key={c.id} className="space-y-1">
                <p className="text-xs font-semibold text-slate-500"><a href={`#${c.section === "assessed" || c.section === "certificates" ? "certificates" : c.section}`} className="underline">{SECTION_TITLE[c.section as keyof typeof SECTION_TITLE] ?? c.section}</a>{c.anchor ? ` · ${titleOf.get(c.anchor) ?? "an item that has since changed"}` : ""}</p>
                <CommentThread comments={[c]} as="owner" ownerId={me.id} showAuthor />
              </li>
            ))}
          </ul>
        )}
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

      <section id="endorsements" className={sec} aria-labelledby="cv-refs">
        <h2 id="cv-refs" className={h2}>References</h2>
        <p className="text-xs text-slate-400">A reference is the one thing on a CV that someone else says about you. Ask a manager or mentor, or they can offer one. Nothing appears on your CV until you approve it, and the person who wrote it can withdraw it at any time.</p>
        {refs.length === 0 && <p className="text-sm text-slate-400">No references yet.</p>}
        <ul className="space-y-2">
          {refs.map((r) => (
            <li key={r.id} className={`space-y-1.5 rounded-lg border border-black/5 p-2.5 text-sm ${r.status === "declined" || r.status === "withdrawn" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <b className="min-w-0 flex-1">{r.author} <span className="font-normal text-slate-500">· {r.label}{r.context ? ` · ${r.context}` : ""}</span></b>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{r.status === "requested" ? "waiting for them" : r.status === "pending" ? "needs your approval" : r.status === "approved" ? (hidden.has(`endorsement:${r.id}`) ? "approved, hidden" : "on your CV") : r.status}</span>
              </div>
              {r.body && r.status !== "withdrawn" && <p className="whitespace-pre-wrap italic">“{r.body}”</p>}
              <div className="flex flex-wrap items-center gap-2">
                {r.status === "pending" && <><InlineAction action={decideEndorsementAction} fields={{ id: r.id, on: 1 }} label="Approve: show on my CV" /><InlineAction action={decideEndorsementAction} fields={{ id: r.id, on: 0 }} label="Decline" tone="danger" confirm="Decline this reference? It will not appear anywhere." /></>}
                {r.status === "approved" && <><InlineAction action={toggleHiddenAction} fields={{ key: `endorsement:${r.id}` }} label={hidden.has(`endorsement:${r.id}`) ? "Show again" : "Hide for now"} /><InlineAction action={decideEndorsementAction} fields={{ id: r.id, on: 0 }} label="Remove" tone="danger" confirm="Remove this reference from your CV?" /></>}
                {r.status === "requested" && <InlineAction action={cancelRequestAction} fields={{ id: r.id }} label="Cancel request" />}
              </div>
            </li>
          ))}
        </ul>
        {toAsk.length > 0 && (
          <div className="space-y-1.5 border-t border-black/5 pt-2">
            <h3 className="text-sm font-bold">Ask for a reference</h3>
            <ul className="space-y-1 text-sm">{toAsk.slice(0, 20).map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{a.name} <span className="text-slate-400">· {a.label}</span></span><InlineAction action={requestEndorsementAction} fields={{ authorId: a.id }} label="Ask" /></li>)}</ul>
          </div>
        )}
        {toAsk.length === 0 && refs.length === 0 && <p className="text-xs text-slate-400">You have no manager or mentor to ask yet. A mentor is someone you invite from the Mentoring page.</p>}
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

        <LinksOverview links={live.map((l) => ({ id: l.id, label: l.label, kind: l.kind, days: hist.get(l.id)! }))} />
        {live.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-6 text-center"><Link2 size={22} className="mx-auto text-slate-300" aria-hidden /><p className="mt-2 text-sm font-semibold text-slate-600">No live links yet</p><p className="text-xs text-slate-400">Make one above. You will see here how often it is read, day by day.</p></div>
        ) : (
          <ul className="space-y-4">
            {live.map((l: CvLink) => (
              <li key={l.id} className={`space-y-3 rounded-2xl border border-l-4 border-black/10 bg-white p-4 text-sm shadow-sm ${KIND[l.kind].edge}`}>
                <LinkHead label={l.label} kind={l.kind} views={l.views} last={l.lastViewedAt ? day(l.lastViewedAt) : null} />
                <CopyField value={`${base}${pathOf(l)}`} label={`Link for ${l.label || "this link"}`} />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3"><LinkActivity days={hist.get(l.id)!} /><Lifespan createdAt={l.createdAt} expiresAt={l.expiresAt} now={Math.floor(Date.now() / 1000)} /></div>
                  <Exposure view={viewOf(l)} allowPdf={l.allowPdf} indexable={l.indexable} kind={l.kind} />
                </div>
                {l.kind === "passcode" && <p className="text-xs text-slate-500">Give them the passcode you chose when you made it. It is not stored in a form that can be shown again.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/profile/cv/preview?as=${l.id}`} className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-500/20"><Eye size={12} aria-hidden />Preview as this reader</Link>
                  <a href={`/profile/cv/pdf?as=${l.id}`} className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-black/10"><Download size={12} aria-hidden />PDF as this reader</a>
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

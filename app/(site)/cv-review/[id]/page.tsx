import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, BadgeCheck, ClipboardCheck, ShieldCheck } from "lucide-react";
import { db, users } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { CommentComposer } from "@/components/cv/CommentControls";
import { CommentThread } from "@/components/cv/CommentThread";
import { buildCv } from "@/lib/cv/build";
import { commentsByReviewer, whyNotReviewCv } from "@/lib/cv/review";
import { CV_REVIEW_VIEW } from "@/lib/cv/types";
import { siteUrl } from "@/lib/share";

export const metadata: Metadata = { title: "Review a CV — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TIPS = [
  "Is the summary specific to this person, or could it describe anyone? Ask what they would want a hiring manager to remember.",
  "Do the jobs say what they ACHIEVED, with numbers where there are any, rather than only what they were responsible for?",
  "Is anything missing that you know about: a project, a skill, a result they are proud of?",
  "Is anything unclear, over-claimed, or out of date? Say which item and why.",
];

/**
 * A mentor or manager reads someone's CV draft and comments on a section or one item. Only for someone the owner has let in, who is still their
 * mentor or manager (lib/cv/review.ts); anyone else gets a 404. They never see the owner's email, phone, location or links, and see only their own comments.
 */
export default async function ReviewCv({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || whyNotReviewCv(me, id) !== null) notFound();
  const owner = db.select({ name: users.name }).from(users).where(eq(users.id, id)).get()!;
  const first = owner.name.split(" ")[0];
  const doc = buildCv(id, CV_REVIEW_VIEW, await siteUrl());
  const mine = commentsByReviewer(me.id, id);
  const on = (section: string, anchor: string) => mine.filter((c) => c.section === section && c.anchor === anchor);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHero Icon={ClipboardCheck} tone="violet" title={`${owner.name}'s CV draft`} sub={`Read it, and comment on any section or item. ${first} decides what to change.`}>
        <Link href="/mentoring" className="btn btn-ghost !py-1 text-sm"><ArrowLeft size={15} aria-hidden />Back</Link>
      </PageHero>
      <section className="card space-y-2 p-4 text-sm">
        <p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />{first} chose to let you see this draft, and can end it at any time. You see their work, skills and certificates, but not their email, phone, location or links. Your comments are private between you and {first}.</p>
        <details><summary className="cursor-pointer text-xs font-semibold text-sky-700 underline">What to look for</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">{TIPS.map((t) => <li key={t}>{t}</li>)}</ul></details>
      </section>

      {!doc || doc.sections.length === 0 ? <p className="card p-4 text-sm text-slate-400">{first} has not added anything to their CV yet. Check back later.</p> : doc.sections.map((s) => (
        <section key={s.key} id={s.key} className="card space-y-3 p-4" aria-labelledby={`r-${s.key}`}>
          <h2 id={`r-${s.key}`} className="text-base font-bold">{s.title}</h2>
          {s.chips ? <p className="text-sm">{s.items.map((i) => i.title).join(" · ")}</p> : (
            <ul className="space-y-3">
              {s.items.map((it, k) => (
                <li key={it.anchor ?? k} className="space-y-2 rounded-lg border border-black/5 p-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    {it.title && <b>{it.title}</b>}
                    {(it.dates || it.level) && <span className="ml-auto text-xs text-slate-500">{it.dates ?? it.subtitle}</span>}
                  </div>
                  {it.subtitle && !it.level && <p className="text-xs text-slate-500">{it.subtitle}</p>}
                  {it.body?.map((b, i) => <p key={i} className="whitespace-pre-wrap">{b}</p>)}
                  {it.verify && <p className="inline-flex items-center gap-1 text-xs text-emerald-700"><BadgeCheck size={13} aria-hidden />Verified certificate {it.verify.code}</p>}
                  {it.anchor && (
                    <div className="space-y-2">
                      <CommentThread comments={on(s.key, it.anchor)} as="reviewer" ownerId={id} />
                      <details><summary className="cursor-pointer text-xs font-semibold text-sky-700 underline">Comment on this</summary><div className="mt-2"><CommentComposer ownerId={id} section={s.key} anchor={it.anchor} /></div></details>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t border-black/5 pt-2">
            <CommentThread comments={on(s.key, "")} as="reviewer" ownerId={id} />
            <details><summary className="cursor-pointer text-xs font-semibold text-sky-700 underline">Comment on the whole {s.title.toLowerCase()} section</summary><div className="mt-2"><CommentComposer ownerId={id} section={s.key} placeholder={`About the ${s.title.toLowerCase()} section as a whole`} /></div></details>
          </div>
        </section>
      ))}
    </div>
  );
}

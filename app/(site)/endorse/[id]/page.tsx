import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { cvEndorsements, db, users } from "@/lib/db";
import { requireUser, viewAsState } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { CvForm, InlineAction } from "@/components/cv/CvForms";
import { relationshipOf, whyNotEndorse } from "@/lib/cv/endorse";
import { ENDORSE, RELATIONSHIP_LABEL } from "@/lib/cv/types";
import { withdrawEndorsementAction, writeEndorsementAction } from "@/app/cv-actions";

export const metadata: Metadata = { title: "Write a reference — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-black/15 bg-[#fff] px-2.5 py-1.5 text-sm text-slate-800";
const STATUS: Record<string, string> = {
  requested: "They asked you for one. Nothing is written yet.",
  pending: "Sent. It is waiting for them to approve it, and shows nowhere until they do.",
  approved: "They approved it: it is on their CV with your name. If you change it, they will need to approve it again.",
  declined: "They chose not to feature one from you. They can ask you again.",
  withdrawn: "You withdrew it. You can write a new one.",
};

/**
 * A manager or mentor writes a reference for someone's CV. Only someone who runs them or mentors them may (lib/cv/endorse.ts); anyone else gets a
 * 404, the same as for a person who does not exist. What they write is private until the person approves it.
 */
export default async function Endorse({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || whyNotEndorse(me, id) !== null) notFound();
  const viewing = (await viewAsState()) !== null;
  const person = db.select({ name: users.name }).from(users).where(eq(users.id, id)).get()!;
  const first = person.name.split(" ")[0];
  const mine = db.select().from(cvEndorsements).where(and(eq(cvEndorsements.userId, id), eq(cvEndorsements.authorId, me.id))).get();
  const rel = relationshipOf(me, id)!;
  const blocked = viewing || mine?.status === "declined";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHero Icon={MessageSquareQuote} tone="violet" title={`A reference for ${person.name}`} sub={`Your words, with your name and role, can go on ${first}'s CV once ${first} approves them.`}>
        <Link href={rel === "mentor" ? "/mentoring" : `/admin/people/${id}`} className="btn btn-ghost !py-1 text-sm"><ArrowLeft size={15} aria-hidden />Back</Link>
      </PageHero>
      {viewing && <p className="card border-l-4 border-amber-500 p-3 text-sm text-amber-900">You are viewing as someone else, so a reference cannot be written here. Exit the view to write it as yourself.</p>}
      {mine && <p className="card flex items-start gap-2 p-3 text-sm"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />{STATUS[mine.status]}</p>}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">What makes a good reference</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Say what you actually saw them do, and the difference it made. &ldquo;Rebuilt our onboarding checklist and cut new-starter questions by half&rdquo; beats &ldquo;a hard worker&rdquo;.</li>
          <li>Be honest. A reader trusts a specific, balanced reference far more than a glowing one.</li>
          <li>Write about their work and how they work with others. Leave out anything personal.</li>
          <li>No web addresses or email addresses: the reference stands on what you say.</li>
        </ul>
        <p className="text-xs text-slate-400">It will show as: <b>{me.name} · {RELATIONSHIP_LABEL[rel]}</b>. That label comes from the platform&rsquo;s records, not from what you type.</p>
      </section>

      <section className="card p-5">
        <CvForm action={writeEndorsementAction} className="space-y-3">
          <input type="hidden" name="personId" value={id} />
          <label className="block space-y-1 text-xs font-semibold text-slate-500">Your reference ({ENDORSE.min}–{ENDORSE.max} characters)
            <textarea name="body" required minLength={ENDORSE.min} maxLength={ENDORSE.max} rows={7} defaultValue={mine?.status === "requested" ? "" : mine?.body} disabled={blocked} placeholder={`I managed ${first} for … During that time they …`} className={field} /></label>
          <label className="block space-y-1 text-xs font-semibold text-slate-500">How you know them (optional, shown under your name)
            <input name="context" maxLength={ENDORSE.context} defaultValue={mine?.context} disabled={blocked} placeholder="Managed them on the 2026 onboarding project" className={field} /></label>
          <button disabled={blocked} className="btn !py-1.5 text-sm disabled:opacity-50">{mine?.status === "approved" ? "Save changes (they will approve again)" : "Send for their approval"}</button>
        </CvForm>
        {mine && ["requested", "pending", "approved"].includes(mine.status) && !viewing && (
          <div className="mt-3 border-t border-black/5 pt-3"><InlineAction action={withdrawEndorsementAction} fields={{ id: mine.id, personId: id }} label="Withdraw my reference" tone="danger" confirm="Withdraw it? It will come off their CV straight away." /></div>
        )}
      </section>
    </div>
  );
}

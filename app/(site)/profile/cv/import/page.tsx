import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, FileUp } from "lucide-react";
import { cvEntries, cvProfiles, db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { ImportWizard } from "@/components/cv/ImportWizard";
import { parseJson } from "@/lib/cv/text";

export const metadata: Metadata = { title: "Import a CV — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Bring in a CV the person already has: a JSON Resume file, or the CSV files from a LinkedIn data export. A preview first; nothing is saved until they confirm. */
export default async function ImportCv() {
  const me = await requireUser();
  const p = db.select().from(cvProfiles).where(eq(cvProfiles.userId, me.id)).get();
  const existing = db.select().from(cvEntries).where(eq(cvEntries.userId, me.id)).all().map((e) => `${e.kind}|${e.title.toLowerCase()}|${e.org.toLowerCase()}|${e.startsOn}`);
  const current = { headline: p?.headline ?? "", summary: p?.summary ?? "", location: p?.location ?? "", contactEmail: p?.contactEmail ?? "", phone: p?.phone ?? "", links: parseJson<unknown[]>(p?.links ?? "[]", []) };
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHero Icon={FileUp} tone="indigo" title="Import a CV" sub="Start from what you already have. You see everything first and choose what to keep.">
        <Link href="/profile/cv" className="btn btn-ghost !py-1 text-sm"><ArrowLeft size={15} aria-hidden />Back to your CV</Link>
      </PageHero>
      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-bold">What you can bring in</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[#475569]">
          <li><b>A JSON Resume file</b> (<code>resume.json</code>): the open standard many CV tools can export, including this one.</li>
          <li><b>Your LinkedIn data.</b> On LinkedIn, open Settings, then Data privacy, then &ldquo;Get a copy of your data&rdquo;, and choose the parts you want (positions, education, skills, profile). When LinkedIn emails you the download, unzip it and choose the <code>.csv</code> files here: <code>Positions.csv</code>, <code>Education.csv</code>, <code>Skills.csv</code>, <code>Profile.csv</code> and so on. You can choose several at once. LinkedIn changes its menus now and then, so the wording may differ.</li>
        </ul>
        <p className="text-xs text-slate-400">Your file is read here to build the preview and is not kept. Anything you already have on your CV is never duplicated, and a profile detail you already have is only replaced if you tick it. Your results and certificates from this platform are added automatically and are not part of an import.</p>
      </section>
      <section className="card p-5"><ImportWizard existing={existing} current={current} /></section>
    </div>
  );
}

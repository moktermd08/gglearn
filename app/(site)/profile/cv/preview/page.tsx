import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CvView } from "@/components/cv/CvView";
import { requireUser } from "@/lib/auth";
import { buildCv } from "@/lib/cv/build";
import { viewForOwner } from "@/lib/cv/links";
import { siteUrl } from "@/lib/share";

export const metadata: Metadata = { title: "CV preview — gglearn", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Exactly what a reader would see through one of the person's views, before they share anything. */
export default async function Preview({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const me = await requireUser();
  const as = (await searchParams).as;
  const { view, label } = viewForOwner(me.id, as);
  const doc = buildCv(me.id, view, await siteUrl());
  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 text-sm">
        <Link href="/profile/cv" className="btn btn-ghost !py-1"><ArrowLeft size={15} aria-hidden />Back to your CV</Link>
        <p className="text-slate-500">Previewing: <b>{label}</b>. This is what a reader sees through that view.</p>
      </div>
      {doc ? <CvView doc={doc} pdfHref={`/profile/cv/pdf${as ? `?as=${encodeURIComponent(as)}` : ""}`} /> : <p className="card p-4 text-sm">Nothing to preview.</p>}
    </div>
  );
}

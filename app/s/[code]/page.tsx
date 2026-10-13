import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowRight, Download, Link2 } from "lucide-react";
import { db, shareCards } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/share";
import { revokeShare } from "@/app/share/actions";

const find = (code: string) => db.select().from(shareCards).where(and(eq(shareCards.code, code), isNull(shareCards.revokedAt))).get();

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const c = find((await params).code);
  if (!c) return { title: "gglearn" };
  const base = await siteUrl(), url = `${base}/s/${c.code}`, title = `${c.title}: ${c.headline}`, description = `${c.name} on gglearn. ${c.subtitle}`;
  return {
    metadataBase: new URL(base), title: `${title} — gglearn`, description, robots: { index: false, follow: false },
    openGraph: { title, description, url, type: "website", images: [{ url: `/s/${c.code}/image`, width: 1200, height: 630, alt: `${c.title}: ${c.headline}` }] },
    twitter: { card: "summary_large_image", title, description, images: [`/s/${c.code}/image`] },
  };
}

export default async function Share({ params }: { params: Promise<{ code: string }> }) {
  const c = find((await params).code);
  if (!c) notFound();
  const me = await currentUser(), mine = me?.id === c.userId, url = `${await siteUrl()}/s/${c.code}`;
  const text = encodeURIComponent(`${c.title}: ${c.headline} on gglearn`), enc = encodeURIComponent(url);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated on request by our own route */}
      <img src={`/s/${c.code}/image`} alt={`${c.name}: ${c.title}, ${c.headline}. ${c.subtitle}`} width={1200} height={630} className="w-full rounded-3xl shadow-xl" />
      <div className="text-center">
        <p className="text-lg font-bold">{c.name} earned this on gglearn</p>
        <p className="text-sm text-slate-400">Every level, badge and rank comes from real graded exams.</p>
        <Link href="/" className="btn mt-4 inline-flex">Start learning on gglearn<ArrowRight size={16} /></Link>
      </div>
      {mine && (
        <section className="card space-y-3 p-5" aria-label="Share this card">
          <h2 className="font-bold">Share your card</h2>
          <label className="block text-sm text-slate-400">Link<input readOnly value={url} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-ghost" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc}`} target="_blank" rel="noopener noreferrer"><Link2 size={15} />LinkedIn</a>
            <a className="btn btn-ghost" href={`https://twitter.com/intent/tweet?text=${text}&url=${enc}`} target="_blank" rel="noopener noreferrer"><Link2 size={15} />X</a>
            <a className="btn btn-ghost" href={`/s/${c.code}/image`} download={`gglearn-${c.kind}.png`}><Download size={15} />Download image</a>
          </div>
          <p className="text-xs text-slate-400">Anyone with this link sees only your first name and initial and this achievement.</p>
          <form action={revokeShare.bind(null, c.id)}><button className="text-sm text-slate-400 underline" type="submit">Stop sharing this card</button></form>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, CalendarDays, ShieldCheck, Swords, Target, Trophy } from "lucide-react";
import { db, shareCards } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { TONES, siteUrl } from "@/lib/share";
import { ShareBar } from "@/components/ShareBar";
import { referralCode } from "@/lib/referrals";
import { revokeShare } from "@/app/(site)/share/actions";

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
  
  const tone = TONES[c.tone] ?? TONES.indigo;
  const when = new Date(c.createdAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] p-3 sm:p-6" style={{ background: `linear-gradient(145deg, ${tone.from}33, transparent 70%)` }} aria-label="Shared achievement">
        <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: `${tone.from}55` }} aria-hidden />
        <span className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full blur-3xl" style={{ background: `${tone.to}33` }} aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element -- generated on request by our own route */}
        <img src={`/s/${c.code}/image`} alt={`${c.name}: ${c.title}, ${c.headline}. ${c.subtitle}`} width={1200} height={630} className="relative w-full rounded-3xl shadow-2xl ring-1 ring-black/10" />
        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-emerald-300"><BadgeCheck size={14} />Verified by graded exams</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff]/70 px-3 py-1.5 text-slate-600"><CalendarDays size={14} />Shared {when}</span>
        </div>
      </section>

      <div className="text-center">
        <p className="text-xl font-extrabold">{c.name} earned this on gglearn</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Every level, badge and rank comes from real graded exams. Nothing here can be clicked through.</p>
      </div>

      <section className="card relative overflow-hidden p-5 text-center sm:p-6" aria-label="Join gglearn" style={{ background: "linear-gradient(135deg, rgba(99,102,241,.14), rgba(147,51,234,.10))" }}>
        <h2 className="text-lg font-extrabold">Earn yours</h2>
        <ul className="mx-auto mt-3 grid max-w-xl gap-2 text-left text-sm sm:grid-cols-3">
          {[{ Icon: Target, t: "Climb 20 levels", d: "Novice to Titan, in any subject.", tone: "bg-sky-500/15 text-sky-300" },
            { Icon: Swords, t: "Race a rival", d: "A daily challenger keeps you honest.", tone: "bg-pink-500/15 text-pink-300" },
            { Icon: ShieldCheck, t: "Get certified", d: "A certificate anyone can verify.", tone: "bg-emerald-500/15 text-emerald-300" }].map(({ Icon, t, d, tone: tn }) => (
            <li key={t} className="flex items-start gap-2.5 rounded-xl bg-[#fff]/60 p-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tn}`}><Icon size={16} /></span><span><span className="block font-bold">{t}</span><span className="block text-xs text-slate-400">{d}</span></span></li>))}
        </ul>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={`/signup?ref=${referralCode(c.userId)}`} className="btn inline-flex">Start free on gglearn<ArrowRight size={16} /></Link>
          <Link href="/campaigns" className="btn btn-ghost inline-flex"><Trophy size={16} />Browse campaigns</Link>
        </div>
      </section>
      <section className="card space-y-3 p-5" aria-label="Share this card">
        <h2 className="font-bold">{mine ? "Share your card" : "Share this card"}</h2>
        <ShareBar url={url} text={`${c.title}: ${c.headline}. Can you beat it on gglearn?`} imageUrl={`/s/${c.code}/image`} imageName={`gglearn-${c.kind}.png`} />
        {mine && (<>
          <label className="block text-sm text-slate-400">Link<input readOnly value={url} className="mt-1 w-full rounded-lg border border-black/15 bg-[#fff] px-3 py-2 text-sm text-slate-800" /></label>
          <p className="text-xs text-slate-400">Anyone with this link sees only your first name and initial and this achievement.</p>
          <form action={revokeShare.bind(null, c.id)}><button className="text-sm text-slate-400 underline" type="submit">Stop sharing this card</button></form>
        </>)}
      </section>
    </div>
  );
}

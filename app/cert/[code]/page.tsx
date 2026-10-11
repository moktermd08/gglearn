import { CertFrame } from "@/components/CertFrame";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { certificates, db, tracks, users } from "@/lib/db";
import { LEVELS, TIERS, certTitle, tierOf } from "@/lib/levels";
import { BadgeCheck, CalendarDays, Percent, Printer } from "lucide-react";
import { RankEmblem } from "@/components/RankEmblem";

export const metadata = { title: "Certificate — gglearn" };

/** Public, shareable and verifiable: anyone with the code can confirm it. */
export default async function Cert({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const row = db.select({ c: certificates, t: tracks, u: users }).from(certificates)
    .innerJoin(tracks, eq(tracks.id, certificates.trackId)).innerJoin(users, eq(users.id, certificates.userId))
    .where(eq(certificates.code, code)).get();
  if (!row) notFound();
  const { c, t, u } = row, hue = TIERS[tierOf(c.level)].hue;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <CertFrame hue={hue} code={c.code} seal={<RankEmblem level={c.level} size={64} />}>
        <p className="mt-5 text-xs uppercase tracking-[.4em] text-slate-400">Certificate of achievement</p>
        <h1 className="mt-2 text-3xl font-extrabold gradient-text sm:text-4xl">{certTitle(c.level)} · {t.name}</h1>
        <p className="mt-6 text-slate-400">This certifies that</p>
        <p className="mt-1 border-b border-slate-200 pb-2 font-serif text-4xl font-bold italic">{u.name}</p>
        <p className="mt-3 text-slate-300">passed level {c.level} ({LEVELS[c.level - 1]}) with a score of {Math.round(c.score * 100)}%</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1"><Percent size={14} style={{ color: `hsl(${hue} 70% 40%)` }} />{Math.round(c.score * 100)}% score</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1"><CalendarDays size={14} style={{ color: `hsl(${hue} 70% 40%)` }} />Level {c.level} of 20</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1"><CalendarDays size={14} style={{ color: `hsl(${hue} 70% 40%)` }} />Issued {new Date(c.issuedAt * 1000).toISOString().slice(0, 10)}</span>
        </div>
      </CertFrame>
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-slate-400"><BadgeCheck size={16} className="text-emerald-400" />Verified by gglearn. <Printer size={14} />Print this page to save it as a PDF. <Link href="/" className="underline">gglearn</Link></p>
    </div>
  );
}

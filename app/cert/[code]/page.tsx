import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { certificates, db, tracks, users } from "@/lib/db";
import { LEVELS, TIERS, certTitle, tierOf } from "@/lib/levels";
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
      <div className="card relative overflow-hidden border-2 p-10 text-center" style={{ borderColor: `hsl(${hue} 80% 60%)`, boxShadow: `0 0 60px -15px hsl(${hue} 80% 60%)` }}>
        <div className="mx-auto w-fit"><RankEmblem level={c.level} size={90} /></div>
        <p className="mt-4 text-xs uppercase tracking-[.4em] text-slate-400">Certificate of achievement</p>
        <h1 className="mt-2 text-4xl font-extrabold gradient-text">{certTitle(c.level)} · {t.name}</h1>
        <p className="mt-6 text-slate-400">This certifies that</p>
        <p className="text-3xl font-bold">{u.name}</p>
        <p className="mt-2 text-slate-300">passed level {c.level} ({LEVELS[c.level - 1]}) with a score of {Math.round(c.score * 100)}%</p>
        <p className="mt-8 text-xs text-slate-500">Issued {new Date(c.issuedAt * 1000).toISOString().slice(0, 10)} · Verification code <span className="font-mono text-slate-300">{c.code}</span></p>
      </div>
      <p className="text-center text-sm text-slate-400">Verified by gglearn. Print this page to save it as a PDF. <Link href="/" className="underline">gglearn</Link></p>
    </div>
  );
}

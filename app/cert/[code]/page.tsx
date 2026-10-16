import { CertFrame } from "@/components/CertFrame";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { certificates, db, tracks, users } from "@/lib/db";
import { LEVELS, TIERS, certTitle, tierOf } from "@/lib/levels";
import { AlertTriangle, Ban, BadgeCheck, CalendarDays, Hourglass, Percent, Printer, ShieldAlert } from "lucide-react";
import { RankEmblem } from "@/components/RankEmblem";
import { lookFor, themeStyle } from "@/lib/brand";
import { certState, signatureStatus } from "@/lib/certs";

const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

export const metadata = { title: "Certificate — gglearn" };

/** Public, shareable and verifiable: anyone with the code can confirm it. */
export default async function Cert({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const row = db.select({ c: certificates, t: tracks, u: users }).from(certificates)
    .innerJoin(tracks, eq(tracks.id, certificates.trackId)).innerJoin(users, eq(users.id, certificates.userId))
    .where(eq(certificates.code, code)).get();
  if (!row) notFound();
  const { c, t, u } = row, hue = TIERS[tierOf(c.level)].hue;
  const look = lookFor(u.id); // the certificate carries its holder's company, whoever is looking
  const life = certState(c), sig = signatureStatus(c), altered = sig === "altered", revoked = !!c.revokedAt, expired = life.state === "expired";
  return (
    <div className="mx-auto max-w-3xl space-y-4" style={themeStyle(look) as React.CSSProperties | undefined}>
      <CertFrame look={look} hue={hue} code={c.code} signer={c.signer ? { name: c.signer, title: c.signerTitle } : undefined} seal={<RankEmblem level={c.level} size={64} />}>
        <p className="mt-5 text-xs uppercase tracking-[.4em] text-slate-400">Certificate of achievement</p>
        <h1 className="mt-2 text-3xl font-extrabold gradient-text sm:text-4xl">{certTitle(c.level)} · {t.name}</h1>
        <p className="mt-6 text-slate-400">This certifies that</p>
        <p className="mt-1 border-b border-slate-200 pb-2 font-serif text-4xl font-bold italic">{u.name}</p>
        <p className="mt-3 text-slate-300">passed level {c.level} ({LEVELS[c.level - 1]}) with a score of {Math.round(c.score * 100)}%</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1"><Percent size={14} style={{ color: `hsl(${hue} 70% 40%)` }} />{Math.round(c.score * 100)}% score</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1"><CalendarDays size={14} style={{ color: `hsl(${hue} 70% 40%)` }} />Level {c.level} of 20</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1"><CalendarDays size={14} style={{ color: `hsl(${hue} 70% 40%)` }} />Issued {day(c.issuedAt)}{c.renewedAt ? `, renewed ${day(c.renewedAt)}` : ""}</span>
          {revoked && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-rose-600"><Ban size={14} />Revoked {day(c.revokedAt!)}</span>}
          {!revoked && life.expiresAt != null && <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${expired ? "bg-rose-500/15 text-rose-600" : life.state === "expiring" ? "bg-amber-500/15 text-amber-600" : "bg-black/5"}`}><Hourglass size={14} />{expired ? "Expired" : "Valid until"} {day(life.expiresAt)}</span>}
        </div>
      </CertFrame>
      {altered && <p role="alert" className="flex items-start justify-center gap-2 rounded-xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-600"><ShieldAlert size={18} className="mt-0.5 shrink-0" />This record does not match its signature. Do not rely on it; ask {look.name} to confirm.</p>}
      {!altered && revoked && <p role="status" className="flex items-start justify-center gap-2 rounded-xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-600"><Ban size={18} className="mt-0.5 shrink-0" />This certificate was revoked on {day(c.revokedAt!)} and is no longer valid. Ask {look.name} if you need to know more.</p>}
      {!altered && !revoked && expired && <p role="status" className="flex items-start justify-center gap-2 rounded-xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-600"><AlertTriangle size={18} className="mt-0.5 shrink-0" />This certificate expired on {day(life.expiresAt!)}. It was genuine, but it is no longer current.</p>}
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-slate-400">{altered ? <ShieldAlert size={16} className="text-rose-400" /> : <BadgeCheck size={16} className={expired || revoked ? "text-slate-400" : "text-emerald-400"} />}{altered ? "Not verified" : revoked ? "Revoked" : sig === "valid" ? `Signature ${c.signature} verified by ${look.name}.` : `Verified by ${look.name} (issued before signatures).`} <Printer size={14} />Print this page to save it as a PDF. <Link href="/" className="underline">{look.name}</Link></p>
    </div>
  );
}

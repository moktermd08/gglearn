import { CertFrame } from "@/components/CertFrame";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { certificates, db, tracks, users } from "@/lib/db";
import { LEVELS, TIERS, certTitle, tierOf } from "@/lib/levels";
import { AlertTriangle, Ban, BadgeCheck, CalendarDays, Hourglass, Percent, Printer, ShieldAlert } from "lucide-react";
import { RankEmblem } from "@/components/RankEmblem";
import { lookFor, themeStyle } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { linkedInAddUrl } from "@/lib/linkedin";
import { siteUrl } from "@/lib/share";
import { topicLabel } from "@/lib/topicName";
import { ShareButton } from "@/components/ShareButton";
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
  const me = await currentUser(), mine = me?.id === c.userId;
  const addToLinkedIn = mine ? linkedInAddUrl({ name: `${topicLabel(t.name)}: ${certTitle(c.level)}`, issuer: look.company ? look.issuer : look.name, issuedAt: c.renewedAt ?? c.issuedAt, expiresAt: c.expiresAt, code: c.code, url: `${await siteUrl()}/cert/${c.code}` }) : null;
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
      {mine && !altered && !revoked && !expired && <div className="flex flex-wrap items-center justify-center gap-2"><ShareButton kind="cert" refKey={c.code} label="Share this certificate" prominent />{addToLinkedIn && <a href={addToLinkedIn} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><svg width="16" height="16" viewBox="0 0 24 24" fill="#0a66c2" aria-hidden><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>Add to LinkedIn profile</a>}</div>}
      {altered && <p role="alert" className="flex items-start justify-center gap-2 rounded-xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-600"><ShieldAlert size={18} className="mt-0.5 shrink-0" />This record does not match its signature. Do not rely on it; ask {look.name} to confirm.</p>}
      {!altered && revoked && <p role="status" className="flex items-start justify-center gap-2 rounded-xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-600"><Ban size={18} className="mt-0.5 shrink-0" />This certificate was revoked on {day(c.revokedAt!)} and is no longer valid. Ask {look.name} if you need to know more.</p>}
      {!altered && !revoked && expired && <p role="status" className="flex items-start justify-center gap-2 rounded-xl bg-rose-500/10 p-3 text-center text-sm font-semibold text-rose-600"><AlertTriangle size={18} className="mt-0.5 shrink-0" />This certificate expired on {day(life.expiresAt!)}. It was genuine, but it is no longer current.</p>}
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-slate-400">{altered ? <ShieldAlert size={16} className="text-rose-400" /> : <BadgeCheck size={16} className={expired || revoked ? "text-slate-400" : "text-emerald-400"} />}{altered ? "Not verified" : revoked ? "Revoked" : sig === "valid" ? `Signature ${c.signature} verified by ${look.name}.` : `Verified by ${look.name} (issued before signatures).`} <Printer size={14} />Print this page to save it as a PDF. <Link href="/" className="underline">{look.name}</Link></p>
    </div>
  );
}

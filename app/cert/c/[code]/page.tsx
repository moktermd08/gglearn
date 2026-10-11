import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { competitionCerts, competitions, db, tracks, users } from "@/lib/db";
import { BadgeCheck, CalendarDays, Flag, Printer, Target, Trophy } from "lucide-react";
import { MAX_LEVEL } from "@/lib/levels";

export const metadata = { title: "Contest certificate — gglearn" };

/** Public and verifiable by code. Titles of private contests are not shown to strangers. */
export default async function ContestCert({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const row = db.select({ k: competitionCerts, c: competitions, t: tracks, u: users }).from(competitionCerts)
    .innerJoin(competitions, eq(competitions.id, competitionCerts.competitionId))
    .innerJoin(tracks, eq(tracks.id, competitions.trackId)).innerJoin(users, eq(users.id, competitionCerts.userId))
    .where(eq(competitionCerts.code, code)).get();
  if (!row) notFound();
  const { k, c, t, u } = row, champion = k.kind === "champion";
  const hue = champion ? 45 : 200;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card relative overflow-hidden border-2 p-10 text-center" style={{ borderColor: `hsl(${hue} 80% 60%)`, boxShadow: `0 0 60px -15px hsl(${hue} 80% 60%)` }}>
        <div className="pop mx-auto w-fit" aria-hidden>{champion ? <Trophy size={64} className="pulse-glow text-yellow-300" /> : <Flag size={64} className="text-sky-300" />}</div>
        <p className="mt-4 text-xs uppercase tracking-[.4em] text-slate-400">{champion ? "Champion" : "Certificate of completion"}</p>
        <h1 className="mt-2 text-4xl font-extrabold gradient-text">{t.name}</h1>
        <p className="mt-6 text-slate-400">This certifies that</p>
        <p className="text-3xl font-bold">{u.name}</p>
        <p className="mt-2 text-slate-300">
          {champion ? "was the first person to reach the goal" : `reached the goal (place ${k.place})`} of climbing {c.goalLevels} level{c.goalLevels === 1 ? "" : "s"} in {t.name}
          {c.visibility === "public" ? <> in “{c.title}”</> : ""}, out of {MAX_LEVEL} levels, within {Math.round((c.endsAt - c.startsAt) / 86400)} days.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Target size={14} style={{ color: `hsl(${hue} 80% 70%)` }} />+{c.goalLevels} level{c.goalLevels === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><CalendarDays size={14} style={{ color: `hsl(${hue} 80% 70%)` }} />{Math.round((c.endsAt - c.startsAt) / 86400)} days</span>
        </div>
        <p className="mt-6 text-xs text-slate-500">Issued {new Date(k.issuedAt * 1000).toISOString().slice(0, 10)} · Verification code <span className="font-mono text-slate-300">{k.code}</span></p>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-slate-400"><BadgeCheck size={16} className="text-emerald-400" />Verified by gglearn. Progress comes from real level exams. <Printer size={14} />Print this page to save it as a PDF. <Link href="/" className="underline">gglearn</Link></p>
    </div>
  );
}

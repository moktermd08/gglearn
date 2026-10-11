import { desc, eq, sql } from "drizzle-orm";
import { answers, db, questions, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { retireQuestion } from "@/app/actions";
import { AlertTriangle, BarChart3, Database, MessageSquareText, PenLine, Archive, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";

const MIN_ATTEMPTS = 5;

export default async function Admin() {
  await requireManager();
  const attempts = sql<number>`count(${answers.id})`;
  const accuracy = sql<number>`avg(${answers.score})`;

  const perTrack = db.select({
    track: tracks.name,
    total: sql<number>`count(distinct ${questions.id})`,
    authored: sql<number>`sum(${questions.source} != 'legacy-trialtest')`,
    attempts,
  }).from(tracks).leftJoin(questions, eq(questions.trackId, tracks.id)).leftJoin(answers, eq(answers.questionId, questions.id))
    .groupBy(tracks.id).orderBy(desc(sql`count(distinct ${questions.id})`)).limit(60).all();

  // The improvement loop: questions that people almost always fail (unclear or wrong?) or never fail (too easy).
  const flagged = db.select({ q: questions, track: tracks.name, attempts, accuracy })
    .from(questions).innerJoin(answers, eq(answers.questionId, questions.id)).innerJoin(tracks, eq(tracks.id, questions.trackId))
    .where(eq(questions.status, "active")).groupBy(questions.id)
    .having(sql`count(${answers.id}) >= ${MIN_ATTEMPTS} and (avg(${answers.score}) < 0.25 or avg(${answers.score}) > 0.98)`)
    .limit(50).all();

  const totalQ = perTrack.reduce((a, r) => a + r.total, 0);
  const totalAuthored = perTrack.reduce((a, r) => a + (r.authored ?? 0), 0);
  const totalAttempts = perTrack.reduce((a, r) => a + r.attempts, 0);
  const maxTotal = Math.max(1, ...perTrack.map((r) => r.total));
  const tiles = [
    { Icon: Database, label: "Questions", value: totalQ, cls: "text-sky-300" },
    { Icon: PenLine, label: "Brand-authored", value: totalQ ? `${Math.round((totalAuthored / totalQ) * 100)}%` : "0%", cls: "text-violet-300" },
    { Icon: MessageSquareText, label: "Answers given", value: totalAttempts, cls: "text-emerald-300" },
    { Icon: AlertTriangle, label: "Need review", value: flagged.length, cls: flagged.length ? "text-amber-300" : "text-slate-400" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Database className="text-indigo-300" />Question bank</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ Icon, label, value, cls }, i) => (
          <div key={label} className="card rise p-4 text-center" style={{ "--i": i } as React.CSSProperties}>
            <Icon size={22} className={`mx-auto ${cls}`} />
            <div className="mt-1 text-2xl font-extrabold">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={18} className="text-amber-300" />Needs review ({flagged.length})</h2>
        <p className="mb-3 text-sm text-slate-400">Questions with {MIN_ATTEMPTS}+ attempts that are almost always failed (possibly unclear or wrong) or never failed (too easy).</p>
        {flagged.length === 0 && <p className="card flex items-center gap-2 p-4 text-sm text-slate-400"><CheckCircle2 size={18} className="text-emerald-400" />Nothing flagged yet. Flags appear once learners have answered.</p>}
        <ul className="space-y-2">
          {flagged.map(({ q, track, attempts: n, accuracy: acc }, i) => {
            const hard = acc < 0.25;
            return (
              <li key={q.id} className={`card rise flex items-start gap-3 p-3 text-sm ${hard ? "border-rose-500/40" : "border-sky-500/40"}`} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                {hard ? <TrendingDown size={20} className="mt-0.5 shrink-0 text-rose-300" /> : <TrendingUp size={20} className="mt-0.5 shrink-0 text-sky-300" />}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="font-medium">{q.prompt}</div>
                  <div className="text-slate-400">{track} · L{q.level} · {n} attempts · {hard ? "almost always failed" : "never failed"}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><i className={`grow block h-full rounded-full ${hard ? "bg-rose-400" : "bg-sky-400"}`} style={{ width: `${acc * 100}%` }} /></div>
                    <span className={`w-10 text-right font-bold ${hard ? "text-rose-300" : "text-sky-300"}`}>{Math.round(acc * 100)}%</span>
                  </div>
                </div>
                <form action={retireQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="status" value="retired" />
                  <button className="btn btn-ghost !px-3 !py-1 text-sm"><Archive size={14} />Retire</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><BarChart3 size={18} className="text-violet-300" />Coverage by track</h2>
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Brand-authored</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-400/60" />Other</span>
        </div>
        <ul className="card divide-y divide-white/10 text-sm">
          {perTrack.map((r, i) => {
            const auth = r.authored ?? 0;
            return (
              <li key={r.track} className="rise grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto]" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <span className="truncate font-medium">{r.track}</span>
                <span className="order-3 col-span-2 flex h-2.5 overflow-hidden rounded-full bg-white/10 sm:order-none sm:col-span-1" title={`${auth} authored of ${r.total}`}>
                  <i className="grow block h-full bg-violet-400" style={{ width: `${(auth / maxTotal) * 100}%` }} />
                  <i className="grow block h-full bg-sky-400/60" style={{ width: `${((r.total - auth) / maxTotal) * 100}%` }} />
                </span>
                <span className="text-right text-xs text-slate-400"><b className="text-slate-200">{r.total}</b> Qs · {r.attempts} answers</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

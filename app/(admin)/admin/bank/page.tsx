import { redirect } from "next/navigation";
import { isGlobal, reachOf } from "@/lib/tenancy";
import { desc, eq, sql } from "drizzle-orm";
import { answers, db, questions, topicRequests, tracks } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { retireQuestion } from "@/app/actions";
import { Donut, PageHero, PALETTE, StatTile } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import { AlertTriangle, BarChart3, Lightbulb, Database, MessageSquareText, PenLine, Archive, TrendingDown, TrendingUp, CheckCircle2, Clock } from "lucide-react";

const MIN_ATTEMPTS = 5;

export default async function Admin() {
  const me = await requireManager();
  // whole-academy statistics and the search log are for the platform owner; a company manager reviews its own tracks at /admin/review/<track>
  if (!isGlobal(reachOf(me.id))) redirect("/admin/compliance");
  const attempts = sql<number>`count(${answers.id})`;
  const accuracy = sql<number>`avg(${answers.score})`;

  // The list shows the 60 largest tracks; the tiles count the whole bank (the list used to be summed, which left every smaller track out).
  const SHOWN = 60;
  const activeIds = sql`count(distinct case when ${questions.status} = 'active' then ${questions.id} end)`;
  const perTrack = db.select({
    track: tracks.name, slug: tracks.slug, kind: tracks.kind,
    total: sql<number>`${activeIds}`,
    authored: sql<number>`count(distinct case when ${questions.status} = 'active' and ${questions.source} = 'authored' then ${questions.id} end)`,
    attempts,
  }).from(tracks).leftJoin(questions, eq(questions.trackId, tracks.id)).leftJoin(answers, eq(answers.questionId, questions.id))
    .groupBy(tracks.id).orderBy(desc(activeIds)).limit(SHOWN).all();
  const bank = db.select({
    active: sql<number>`coalesce(sum(${questions.status} = 'active'), 0)`,
    review: sql<number>`coalesce(sum(${questions.status} = 'review'), 0)`,
    authoredQ: sql<number>`coalesce(sum(${questions.status} = 'active' and ${questions.source} = 'authored'), 0)`,
  }).from(questions).get()!;
  const totalAnswers = db.select({ n: sql<number>`count(*)` }).from(answers).get()!.n;
  const trackCount = db.select({ n: sql<number>`count(*)` }).from(tracks).get()!.n;

  // The improvement loop: questions that people almost always fail (unclear or wrong?) or never fail (too easy).
  const flagged = db.select({ q: questions, track: tracks.name, attempts, accuracy })
    .from(questions).innerJoin(answers, eq(answers.questionId, questions.id)).innerJoin(tracks, eq(tracks.id, questions.trackId))
    .where(eq(questions.status, "active")).groupBy(questions.id)
    .having(sql`count(${answers.id}) >= ${MIN_ATTEMPTS} and (avg(${answers.score}) < 0.25 or avg(${answers.score}) > 0.98)`)
    .limit(50).all();

  const maxTotal = Math.max(1, ...perTrack.map((r) => r.total));
  const tiles = [
    { Icon: Database, label: "Active questions", value: bank.active.toLocaleString("en-GB"), cls: "text-sky-300" },
    { Icon: Clock, label: "Held for review", value: bank.review.toLocaleString("en-GB"), cls: bank.review ? "text-amber-300" : "text-slate-400" },
    { Icon: PenLine, label: "Authored", value: bank.active ? `${Math.round((bank.authoredQ / bank.active) * 1000) / 10}%` : "0%", cls: "text-violet-300" },
    { Icon: MessageSquareText, label: "Answers given", value: totalAnswers.toLocaleString("en-GB"), cls: "text-emerald-300" },
    { Icon: AlertTriangle, label: "Need review", value: flagged.length, cls: flagged.length ? "text-amber-300" : "text-slate-400" },
  ];

  // what people searched for and did not find: the best guide to which track to write next
  const wanted = db.select({ text: topicRequests.text, people: sql<number>`count(*)` }).from(topicRequests).groupBy(topicRequests.text).orderBy(desc(sql`count(*)`), topicRequests.text).limit(15).all();

  return (
    <div className="space-y-8">
      <PageHero Icon={Database} title="Question bank" sub="What learners are asked, how much of it is hand-written, and which questions need a second look." />
      {wanted.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><Lightbulb size={18} className="text-amber-300" />Topics people asked for</h2>
          <p className="mb-2 text-xs text-slate-400">Searches on Start a race that found nothing. Most asked first.</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {wanted.map((w) => <li key={w.text} className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-200">{w.text} <span className="text-xs text-amber-300/70">· {w.people}</span></li>)}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2">
        {tiles.map(({ Icon, label, value }, i) => <StatTile key={label} i={i} Icon={Icon} label={label} value={value} color={[PALETTE.sky, PALETTE.amber, PALETTE.violet, PALETTE.emerald, flagged.length ? PALETTE.amber : PALETTE.slate][i]} />)}
      </div>
      <section className="card grid items-center gap-6 p-5 md:grid-cols-[auto_1fr]">
        <Donut size={150} sub="active" center={bank.active.toLocaleString("en-GB")} parts={[
          { label: "Authored", value: bank.authoredQ, color: PALETTE.violet },
          { label: "Generated or imported", value: Math.max(0, bank.active - bank.authoredQ), color: PALETTE.sky },
          { label: "Held for review", value: bank.review, color: PALETTE.amber },
        ]} />
        <div className="text-sm text-slate-400">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-200"><BarChart3 size={18} className="text-violet-300" />Shape of the bank</h2>
          Hand-written questions are the gold standard; generated and imported ones fill the long tail. Held questions wait for a person to approve them before learners see them.
        </div>
      </section>
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
        <p className="mb-2 text-xs text-slate-400">Active questions in the {Math.min(SHOWN, trackCount)} largest of {trackCount} tracks. Authored means written as knowledge items and imported from the content files; the rest are generated (concept cards, the question generators) or come from the legacy and questions-repo imports.</p>
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-violet-400" />Authored</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sky-400/60" />Generated or imported</span>
        </div>
        <ul className="card divide-y divide-white/10 text-sm">
          {perTrack.map((r, i) => {
            const auth = r.authored ?? 0;
            return (
              <li key={r.track} className="rise grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto]" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <span className="flex min-w-0 items-center gap-2.5"><SubjectArt slug={r.slug} name={r.track} kind={r.kind} size={28} /><span className="truncate font-medium">{r.track}</span></span>
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

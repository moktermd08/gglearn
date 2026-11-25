import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ClipboardCheck, GraduationCap, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { termsAvailable } from "@/lib/terms";
import { RANKS, rankName, studyState } from "@/lib/termsCore";
import { EXAM_SIZE, myStudyRoles, progressFor, rankExams, roleLabel, roleList, roleSlug, roleSummary } from "@/lib/termStudy";
import { chooseRoleAction, startRankExamAction, startRoleCheckAction } from "@/app/terms-actions";

export const metadata = { title: "Terms for a role — gglearn" };

const CHIP = { new: "bg-slate-100 text-slate-300", learning: "bg-amber-100 text-amber-800", known: "bg-emerald-100 text-emerald-800" } as const;

export default async function RoleTerms({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<{ level?: string; error?: string }> }) {
  const [{ role: raw }, { level: lv, error }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  const role = decodeURIComponent(raw).trim().toLowerCase();
  const saved = myStudyRoles(user.id).find((r) => r.role === role);
  const level = Number(lv) || saved?.level || 1;
  const list = roleList(role, level);
  if (!list) notFound();
  const sum = roleSummary(user.id, list);
  const prog = progressFor(user.id, list.terms.map((t) => t.id));

  // the ladder's other levels, so the person can see what changes as they climb
  const levels = Array.from({ length: list.rungs }, (_, i) => i + 1).map((n) => ({ n, l: roleList(role, n) })).filter((x) => x.l);
  const groups = new Map<string, typeof list.terms>();
  for (const t of list.terms) {
    const bank = list.banks.find((b) => b.id === t.bankId)?.name ?? "Other";
    const key = `${bank} · ${t.groupName || "General"}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const exams = rankExams(user.id, list);
  const pct = (n: number) => (sum.total ? Math.round((n / sum.total) * 100) : 0);
  const base = `/terms/study?role=${roleSlug(role)}&level=${level}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero Icon={GraduationCap} tone="violet" title={`${roleLabel(role)} · ${list.title}`}
        sub={`${sum.total} terms to know at this level, from ${list.banks.map((b) => b.name).join(", ")}, up to ${rankName(list.ceiling)}. The list grows as you aim higher.`} />

      {error && <p role="alert" className="card border-amber-300 p-3 text-sm text-amber-800">{error}</p>}

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Level:</span>
          {levels.map(({ n, l }) => (
            <Link key={n} href={`/terms/role/${roleSlug(role)}?level=${l!.level}`} className={`rounded-full border px-3 py-1 ${l!.level === level ? "border-indigo-500 bg-indigo-50 font-semibold" : "border-black/15"}`}>{l!.title} <span className="text-slate-500">{l!.terms.length}</span></Link>
          ))}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${sum.counts.known} known, ${sum.counts.learning} learning, ${sum.counts.new} not started`}>
          <div className="flex h-full"><div className="bg-emerald-500" style={{ width: `${pct(sum.counts.known)}%` }} /><div className="bg-amber-400" style={{ width: `${pct(sum.counts.learning)}%` }} /></div>
        </div>
        <p className="text-sm text-slate-300"><b className="text-emerald-700">{sum.counts.known} known</b> · <b className="text-amber-700">{sum.counts.learning} learning</b> · {sum.counts.new} not started{sum.due ? <> · <b>{sum.due} due to see again</b></> : null}</p>
        <p className="text-xs text-slate-500">A term counts as known once you have recalled it correctly four times, spread over days. Until then it is learning.</p>
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {RANKS.map((r, i) => {
            const b = sum.byRank[i + 1];
            return <div key={r} className={`rounded border p-2 ${i + 1 > list.ceiling ? "border-dashed border-black/10 text-slate-300" : "border-black/10"}`}><div className="text-slate-500">{r}</div><div className="font-semibold">{b ? `${b.known}/${b.total}` : "–"}</div></div>;
          })}
        </div>
        <p className="text-sm text-slate-300">{sum.tested.asked ? <>Checks so far say you are at <b>{sum.tested.rank ? rankName(sum.tested.rank) : "no rank yet"}</b> on this list ({sum.tested.asked} of {sum.total} terms asked).</> : "You have not been tested on this list yet."}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={base} className="btn"><BookOpen size={15} />Study{sum.due ? ` (${sum.due} due)` : ""}</Link>
          <form action={startRoleCheckAction}><input type="hidden" name="role" value={role} /><input type="hidden" name="level" value={level} /><button className="btn btn-ghost"><ClipboardCheck size={15} />Test me on this list</button></form>
          {!saved && <form action={chooseRoleAction}><input type="hidden" name="role" value={role} /><input type="hidden" name="level" value={level} /><button className="btn btn-ghost"><Plus size={15} />Add to my roles</button></form>}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">Exams for this level</h2>
        <p className="text-sm text-slate-300">One exam for each rank this level reaches. Each draws {EXAM_SIZE} terms from the list at that rank and below, and asks about them as deeply as the rank: an Initiate exam asks what a term means, a Master exam asks you to judge, a Titan exam asks how close terms differ. Sit one again and you get different questions. Pass mark 80%.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {exams.map((e) => (
            <form key={e.rank} action={startRankExamAction} className="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm">
              <input type="hidden" name="role" value={role} /><input type="hidden" name="level" value={level} /><input type="hidden" name="rank" value={e.rank} />
              <div className="min-w-0 flex-1"><b>{rankName(e.rank)} exam</b><div className="text-xs text-slate-500">{e.eligible} terms to draw from{e.best ? ` · best ${Math.round(e.best.score * 100)}%` : " · not taken yet"}</div></div>
              {e.best?.passed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Passed</span>}
              <button className="btn btn-ghost">{e.best ? "Again" : "Start"}</button>
            </form>
          ))}
        </div>
        <p className="text-sm"><Link href={`/terms/build?role=${roleSlug(role)}&level=${level}`} className="underline">Build your own exam from this list</Link></p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The terms, in the order to learn them</h2>
        {[...groups].map(([name, ts]) => {
          const known = ts.filter((t) => studyState(prog.get(t.id)?.box) === "known").length;
          return (
            <details key={name} className="card p-3">
              <summary className="cursor-pointer text-sm font-semibold">{name} <span className="font-normal text-slate-500">({known}/{ts.length} known)</span></summary>
              <ul className="mt-2 divide-y divide-black/10 text-sm">
                {ts.map((t) => {
                  const st = studyState(prog.get(t.id)?.box);
                  return (
                    <li key={t.id} className="flex flex-wrap items-baseline gap-2 py-2">
                      <b>{t.term}</b><span className="text-xs text-slate-500">{rankName(t.tier)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[st]}`}>{st === "new" ? "not started" : st}</span>
                      <span className="w-full text-slate-300">{t.meaning}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
        {list.terms.length === 0 && <p className="card p-4 text-sm text-slate-500">There are no terms for this level yet.</p>}
      </section>
      <p className="text-sm"><Link href="/terms" className="underline">Back to Terms</Link></p>
    </div>
  );
}

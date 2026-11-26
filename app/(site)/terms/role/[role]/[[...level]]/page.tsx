import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, BookOpen, ClipboardCheck, GraduationCap, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { Ring } from "@/components/Ring";
import { TermExplorer } from "@/components/TermExplorer";
import { termsAvailable } from "@/lib/terms";
import { rankName, studyState } from "@/lib/termsCore";
import { EXAM_SIZE, myStudyRoles, progressFor, rankExams, roleLabel, roleList, roleSummary } from "@/lib/termStudy";
import { readTermUrl, termUrl } from "@/lib/termUrls";
import { readFlash } from "@/lib/flash";
import { chooseRoleAction, startRankExamAction, startRoleCheckAction } from "@/app/terms-actions";

export const metadata = { title: "Terms for a role — gglearn" };

export default async function RoleTerms({ params, searchParams }: { params: Promise<{ role: string; level?: string[] }>; searchParams: Promise<{ level?: string }> }) {
  const [{ role: raw, level: rest = [] }, { level: lv }, error] = await Promise.all([params, searchParams, readFlash()]);
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  const mine = myStudyRoles(user.id);
  const at = readTermUrl("role", [raw, ...rest], { level: lv }, (r) => mine.find((x) => x.role === r)?.level ?? 1);
  if (!at) notFound();
  if (at.canonical) redirect(at.canonical);
  const { role, level } = at;
  const saved = mine.find((r) => r.role === role);
  const list = roleList(role, level);
  if (!list) notFound();
  const sum = roleSummary(user.id, list);
  const prog = progressFor(user.id, list.terms.map((t) => t.id));

  // the ladder's other levels, so the person can see what changes as they climb
  const levels = Array.from({ length: list.rungs }, (_, i) => i + 1).map((n) => ({ n, l: roleList(role, n) })).filter((x) => x.l);
  const bankName = new Map(list.banks.map((b) => [b.id, b.name]));
  // in the order to learn them, so the topics and the walk-through follow it
  const explore = list.terms.map((t) => ({ id: t.id, term: t.term, meaning: t.meaning, tier: t.tier, group: t.groupName, bank: bankName.get(t.bankId!) ?? "Other", state: studyState(prog.get(t.id)?.box) }));
  const most = Math.max(1, ...levels.map((x) => x.l!.terms.length));
  const exams = rankExams(user.id, list);
  const base = termUrl("study", role, level);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero Icon={GraduationCap} tone="violet" title={`${roleLabel(role)} · ${list.title}`}
        sub={`${sum.total} terms to know at this level, from ${list.banks.map((b) => b.name).join(", ")}, up to ${rankName(list.ceiling)}. The list grows as you aim higher.`} />

      {error && <p role="alert" className="card border-amber-300 p-3 text-sm text-amber-800">{error}</p>}

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Your ladder <span className="text-xs font-normal text-slate-400">the list grows as you climb; tap a level</span></h2>
          <ol className="mt-3 flex items-end gap-2">
            {levels.map(({ n, l }) => (
              <li key={n} className="min-w-0 flex-1">
                <Link href={termUrl("role", role, l!.level)} aria-current={l!.level === level ? "step" : undefined} className="block rounded-lg text-center">
                  <span className={`block text-xs font-bold ${l!.level === level ? "text-indigo-300" : "text-slate-400"}`}>{l!.terms.length}</span>
                  <span className="mt-1 block rounded-t-lg transition-colors" style={{ height: 14 + Math.round((l!.terms.length / most) * 70), background: l!.level === level ? "#4f46e5" : l!.level < level ? "#c7d2fe" : "#ece9e0" }} />
                  <span className={`mt-1 block text-[11px] leading-tight ${l!.level === level ? "font-bold" : "text-slate-400"}`}>{l!.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-slate-300">{sum.tested.asked ? <>Checks so far say you are at <b>{sum.tested.rank ? rankName(sum.tested.rank) : "no rank yet"}</b> on this list ({sum.tested.asked} of {sum.total} terms asked).</> : "You have not been tested on this list yet."}{sum.due ? <> <b>{sum.due} due to see again.</b></> : null} A term counts as known once you have recalled it four times, spread over days.</p>
        <div className="flex flex-wrap gap-3">
          <Link href={base} className="btn"><BookOpen size={15} />Study{sum.due ? ` (${sum.due} due)` : ""}</Link>
          <form action={startRoleCheckAction}><input type="hidden" name="role" value={role} /><input type="hidden" name="level" value={level} /><button className="btn btn-ghost"><ClipboardCheck size={15} />Test me on this list</button></form>
          {!saved && <form action={chooseRoleAction}><input type="hidden" name="role" value={role} /><input type="hidden" name="level" value={level} /><button className="btn btn-ghost"><Plus size={15} />Add to my roles</button></form>}
        </div>
      </section>

      {list.terms.length === 0 ? <p className="card p-4 text-sm text-slate-400">There are no terms for this level yet.</p>
        : <TermExplorer key={`${role}-${level}`} terms={explore} ceiling={list.ceiling} />}

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">Exams for this level</h2>
        <p className="text-sm text-slate-300">One exam for each rank this level reaches, {EXAM_SIZE} questions drawn from that rank and below. Questions go deeper at each rank and change every time. Pass mark 80%.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => (
            <form key={e.rank} action={startRankExamAction} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${e.best?.passed ? "border-emerald-400 bg-emerald-500/10" : "border-black/10"}`}>
              <input type="hidden" name="role" value={role} /><input type="hidden" name="level" value={level} /><input type="hidden" name="rank" value={e.rank} />
              <Ring pct={e.best?.score ?? 0} size={56} label={e.best ? `${Math.round(e.best.score * 100)}%` : "–"} color={e.best?.passed ? "#059669" : "#d97706"} />
              <div className="min-w-0 flex-1"><b className="flex items-center gap-1.5">{e.best?.passed && <Award size={15} className="text-emerald-300" aria-hidden />}{rankName(e.rank)} exam</b><div className="text-xs text-slate-400">{e.eligible} terms{e.best ? (e.best.passed ? " · passed" : " · not passed yet") : " · not taken yet"}</div></div>
              <button className="btn btn-ghost">{e.best ? "Again" : "Start"}</button>
            </form>
          ))}
        </div>
        <p className="text-sm"><Link href={termUrl("build", role, level)} className="underline">Build your own exam from this list</Link></p>
      </section>
      <p className="text-sm"><Link href="/terms" className="underline">Back to Terms</Link></p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { StudySession } from "@/components/StudySession";
import { termsAvailable } from "@/lib/terms";
import { roleLabel, roleList, roleSlug, roleSummary, studyCardsFor, studyQueue } from "@/lib/termStudy";
import { loadCheck } from "@/lib/terms";

export const metadata = { title: "Study terms — gglearn" };
export const dynamic = "force-dynamic"; // a new round must be drawn each time, not cached

export default async function Study({ searchParams }: { searchParams: Promise<{ role?: string; level?: string; check?: string }> }) {
  const { role: raw = "", level: lv, check } = await searchParams;
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  if (check) { // the terms missed in a check, to go over straight away
    const c = loadCheck(user, Number(check));
    if (!c || c.exam.finishedAt == null) notFound();
    const missed = studyCardsFor(user.id, c.answers.filter((a) => !a.right).map((a) => a.termId));
    const back = c.exam.role ? `/terms/role/${roleSlug(c.exam.role)}?level=${c.exam.level ?? 1}` : "/terms";
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHero Icon={BookOpen} tone="violet" title="Study the terms you missed" sub={`${missed.length} term${missed.length === 1 ? "" : "s"} from your last check. Read each, say whether you knew it, and the ones you forget come back.`} />
        {missed.length ? <StudySession cards={missed} listHref={back} againHref={`/terms/study?check=${c.exam.id}`} />
          : <div className="card space-y-3 p-6 text-center"><h2 className="text-xl font-bold">Nothing was missed</h2><Link href={back} className="btn">Back</Link></div>}
      </div>
    );
  }
  const role = decodeURIComponent(raw).trim().toLowerCase(), level = Number(lv) || 1;
  const list = roleList(role, level);
  if (!list) notFound();
  const cards = studyQueue(user.id, list, 10);
  const sum = roleSummary(user.id, list);
  const listHref = `/terms/role/${roleSlug(role)}?level=${level}`;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHero Icon={BookOpen} tone="violet" title={`Study · ${roleLabel(role)}`} sub={`${list.title}. ${sum.counts.known} of ${sum.total} terms known. Terms you have forgotten or not met come first; ones you know come back later.`} />
      {cards.length ? <StudySession cards={cards} listHref={listHref} againHref={`/terms/study?role=${roleSlug(role)}&level=${level}`} />
        : <div className="card space-y-3 p-6 text-center"><h2 className="text-xl font-bold">Nothing to study right now</h2><p className="text-sm text-slate-600">Every term on this list has been met and none is due to see again. Come back later, or test yourself.</p><Link href={listHref} className="btn">Back to the list</Link></div>}
    </div>
  );
}

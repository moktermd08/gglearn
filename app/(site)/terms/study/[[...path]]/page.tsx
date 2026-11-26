import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { StudySession } from "@/components/StudySession";
import { termsAvailable } from "@/lib/terms";
import { myStudyRoles, roleLabel, roleList, roleSummary, studyCardsFor, studyQueue } from "@/lib/termStudy";
import { readTermUrl, termUrl } from "@/lib/termUrls";
import { loadCheck } from "@/lib/terms";
import { withDetails } from "@/lib/termDetails";

export const metadata = { title: "Study terms — gglearn" };
export const dynamic = "force-dynamic"; // a new round must be drawn each time, not cached

/** /terms/study/<role>/<level> studies a list; /terms/study/missed/<check> goes over what a check got wrong. */
export default async function Study({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<{ role?: string; level?: string; check?: string }> }) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  if (query.check) redirect(`/terms/study/missed/${Number(query.check) || 0}`); // the older address
  if (path[0] === "missed") { // the terms missed in a check, to go over straight away
    const c = path.length === 2 ? loadCheck(user, Number(path[1])) : null;
    if (!c || c.exam.finishedAt == null) notFound();
    const missed = withDetails(user.id, studyCardsFor(user.id, c.answers.filter((a) => !a.right).map((a) => a.termId)));
    const back = c.exam.role ? termUrl("role", c.exam.role, c.exam.level ?? 1) : "/terms";
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHero Icon={BookOpen} tone="violet" title="Study the terms you missed" sub={`${missed.length} term${missed.length === 1 ? "" : "s"} from your last check. Read each, say whether you knew it, and the ones you forget come back.`} />
        {missed.length ? <StudySession cards={missed} listHref={back} againHref={`/terms/study/missed/${c.exam.id}`} />
          : <div className="card space-y-3 p-6 text-center"><h2 className="text-xl font-bold">Nothing was missed</h2><Link href={back} className="btn">Back</Link></div>}
      </div>
    );
  }
  const at = readTermUrl("study", path, query, (r) => myStudyRoles(user.id).find((x) => x.role === r)?.level ?? 1);
  if (!at) notFound();
  if (at.canonical) redirect(at.canonical);
  const { role, level } = at;
  const list = roleList(role, level);
  if (!list) notFound();
  const cards = withDetails(user.id, studyQueue(user.id, list, 10));
  const sum = roleSummary(user.id, list);
  const listHref = termUrl("role", role, level);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHero Icon={BookOpen} tone="violet" title={`Study · ${roleLabel(role)}`} sub={`${list.title}. ${sum.counts.known} of ${sum.total} terms known. Terms you have forgotten or not met come first; ones you know come back later.`} />
      {cards.length ? <StudySession cards={cards} listHref={listHref} againHref={termUrl("study", role, level)} />
        : <div className="card space-y-3 p-6 text-center"><h2 className="text-xl font-bold">Nothing to study right now</h2><p className="text-sm text-slate-300">Every term on this list has been met and none is due to see again. Come back later, or test yourself.</p><Link href={listHref} className="btn">Back to the list</Link></div>}
    </div>
  );
}

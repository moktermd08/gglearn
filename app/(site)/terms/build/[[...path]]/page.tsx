import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Hammer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { TermPicker, type PickBank } from "@/components/TermPicker";
import { myTerms, termsAvailable } from "@/lib/terms";
import { myStudyRoles, roleLabel, roleList } from "@/lib/termStudy";
import { readTermUrl, termUrl } from "@/lib/termUrls";

export const metadata = { title: "Build an exam — gglearn" };

/** Your own exam from a role's list: pick the terms and the rank you are trying; the questions go as deep as that rank. */
export default async function BuildExam({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<{ role?: string; level?: string }> }) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  const at = readTermUrl("build", path, query, (r) => myStudyRoles(user.id).find((x) => x.role === r)?.level ?? 1);
  if (!at) notFound();
  if (at.canonical) redirect(at.canonical);
  const { role } = at;
  const list = roleList(role, at.level);
  if (!list) notFound();
  const groups = new Map<string, { id: number; term: string; tier: number }[]>();
  for (const t of list.terms) {
    const key = `${list.banks.find((b) => b.id === t.bankId)?.name ?? "Other"} · ${t.groupName || "General"}`;
    groups.set(key, [...(groups.get(key) ?? []), { id: t.id, term: t.term, tier: t.tier }]);
  }
  const banks: PickBank[] = [{ key: "list", name: `${roleLabel(role)} · ${list.title}`, open: true, groups: [...groups].map(([name, terms]) => ({ name, terms })) }];
  const own = myTerms(user.id);
  if (own.length) banks.unshift({ key: "mine", name: "My own terms", open: false, groups: [{ name: "Added by me", terms: own.map((t) => ({ id: t.id, term: t.term, tier: t.tier })) }] });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHero Icon={Hammer} tone="violet" title="Build your own exam" sub={`Pick the terms from ${roleLabel(role)} at ${list.title} that you want to be examined on, and the rank you are trying. Each term gets one question, as deep as that rank.`} />
      <TermPicker banks={banks} defaultClaim={list.ceiling} />
      <p className="text-sm"><Link href={termUrl("role", role, list.level)} className="underline">Back to the list</Link></p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHero } from "@/components/charts";
import { TermPicker, type PickBank } from "@/components/TermPicker";
import { myTerms, termsAvailable } from "@/lib/terms";
import { roleLabel, roleList, roleSlug } from "@/lib/termStudy";

export const metadata = { title: "Build an exam — gglearn" };

/** Your own exam from a role's list: pick the terms and the rank you are trying; the questions go as deep as that rank. */
export default async function BuildExam({ searchParams }: { searchParams: Promise<{ role?: string; level?: string }> }) {
  const { role: raw = "", level: lv } = await searchParams;
  const user = await requireUser();
  if (!termsAvailable()) notFound();
  const role = decodeURIComponent(raw).trim().toLowerCase();
  const list = roleList(role, Number(lv) || 1);
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
      <p className="text-sm"><Link href={`/terms/role/${roleSlug(role)}?level=${list.level}`} className="underline">Back to the list</Link></p>
    </div>
  );
}

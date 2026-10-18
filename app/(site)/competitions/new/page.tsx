import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { pickableTopics } from "@/lib/pickTopics";
import { Trophy } from "lucide-react";
import { PageHero } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import NewCompetitionForm from "./form";

export const metadata = { title: "Race options — gglearn" };

export default async function NewCompetition() {
  const me = await requireUser();
  // grouped by where the topic comes from (a company's brand, or the shared academy), A to Z, numbered ones in number order
  const byBrand = new Map<string, { id: number; name: string; kind: string; art: React.ReactNode }[]>();
  for (const t of pickableTopics(me).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }))) {
    byBrand.set(t.brand.name, [...(byBrand.get(t.brand.name) ?? []), { id: t.id, name: t.name, kind: t.kind, art: <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={64} className="shadow-lg" /> }]);
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero Icon={Trophy} tone="amber" title="Set up a race yourself" sub="Every option in one place: topic, goal, deadline, rivals, who can watch, prizes. Pick a topic, set a goal and a deadline, then race people, bots, or both." />
      <NewCompetitionForm groups={[...byBrand].sort(([a], [b]) => a.localeCompare(b))} />
      <p className="text-center text-sm text-slate-400">Just want to race a friend or a group in a few steps? <Link href="/start" className="font-semibold text-indigo-300 underline">Start a race the guided way</Link>.</p>
    </div>
  );
}

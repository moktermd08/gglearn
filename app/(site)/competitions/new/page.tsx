import Link from "next/link";
import { topicLabel } from "@/lib/topicName";
import { guestAudience } from "@/lib/guestLink";
import { requireUser } from "@/lib/auth";
import { raceScopeOptions } from "@/lib/tenancy";
import { pickableTopics } from "@/lib/pickTopics";
import { Trophy } from "lucide-react";
import { PageHero } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import NewCompetitionForm from "./form";

export const metadata = { title: "Race options — gglearn" };

export default async function NewCompetition() {
  const me = await requireUser();
  // grouped by where the topic comes from (a company's brand, or the shared academy), A to Z, numbered ones in number order
  const byBrand = new Map<string, { id: number; name: string; guest: boolean; kind: string; art: React.ReactNode }[]>();
  for (const t of pickableTopics(me).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }))) {
    byBrand.set(t.brand.name, [...(byBrand.get(t.brand.name) ?? []), { id: t.id, name: topicLabel(t.name), guest: guestAudience(t.id) !== null, kind: t.kind, art: <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={64} className="shadow-lg" /> }]);
  }
  // the topics most people reach for, as one-tap shortcuts above the list
  const FAVOURITES = ["python-titan", "javascript-titan", "git-titan", "react-titan", "html-titan", "claude-chatgpt-everyday-titan", "llm-prompting-titan"];
  const open = pickableTopics(me), popular = FAVOURITES.flatMap((s) => { const t = open.find((x) => x.slug === s); return t ? [{ id: t.id, name: topicLabel(t.name) }] : []; }).slice(0, 6);
  const mine = raceScopeOptions(me.id);
  const scopes = [...mine.companies.map((c) => ({ value: `company:${c.id}`, label: c.name })), ...mine.brands.map((b) => ({ value: `brand:${b.id}`, label: b.company ? `${b.name} (${b.company})` : b.name }))];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero Icon={Trophy} tone="amber" title="Set up a race yourself" sub="Pick a topic, a goal and a length, and you are ready. Rivals, who can watch, prizes and the rest are under More options, and the defaults are fine." />
      <NewCompetitionForm groups={[...byBrand].sort(([a], [b]) => a.localeCompare(b))} popular={popular} scopes={scopes} />
      <p className="text-center text-sm text-slate-400">Just want to race a friend or a group in a few steps? <Link href="/start" className="font-semibold text-indigo-300 underline">Start a race the guided way</Link>.</p>
    </div>
  );
}

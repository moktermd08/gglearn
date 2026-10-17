import { asc } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { openTo } from "@/lib/paths";
import { KIND_LABEL } from "@/lib/levels";
import { Trophy } from "lucide-react";
import { PageHero } from "@/components/charts";
import { SubjectArt } from "@/components/SubjectArt";
import NewCompetitionForm from "./form";

export const metadata = { title: "Start a contest — gglearn" };

export default async function NewCompetition() {
  const me = await requireUser();
  const all = db.select({ id: tracks.id, slug: tracks.slug, name: tracks.name, kind: tracks.kind, audience: tracks.audience }).from(tracks).orderBy(asc(tracks.kind), asc(tracks.name)).all()
    .filter((t) => openTo(me.audience, t.audience))
    .map((t) => ({ id: t.id, name: t.name, kind: t.kind, art: <SubjectArt slug={t.slug} name={t.name} kind={t.kind} size={64} className="shadow-lg" /> }));
  const byKind = new Map<string, typeof all>();
  for (const t of all) {
    const k = KIND_LABEL[t.kind] ?? t.kind;
    byKind.set(k, [...(byKind.get(k) ?? []), t]);
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero Icon={Trophy} tone="amber" title="Start a contest" sub="Pick a topic, set a goal and a deadline, then race people, bots, or both." />
      <NewCompetitionForm groups={[...byKind]} />
    </div>
  );
}

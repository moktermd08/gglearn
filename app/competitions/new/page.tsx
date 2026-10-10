import { asc } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL } from "@/lib/levels";
import NewCompetitionForm from "./form";

export const metadata = { title: "Start a contest — gglearn" };

export default async function NewCompetition() {
  await requireUser();
  const all = db.select({ id: tracks.id, name: tracks.name, kind: tracks.kind }).from(tracks).orderBy(asc(tracks.kind), asc(tracks.name)).all();
  const byKind = new Map<string, typeof all>();
  for (const t of all) {
    const k = KIND_LABEL[t.kind] ?? t.kind;
    byKind.set(k, [...(byKind.get(k) ?? []), t]);
  }
  const groups = [...byKind];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold">Start a contest</h1>
      <NewCompetitionForm groups={groups} />
    </div>
  );
}

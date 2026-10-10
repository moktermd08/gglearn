import { asc } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL } from "@/lib/levels";
import { JourneySteps } from "@/components/JourneySteps";
import Begin from "./begin";

export const metadata = { title: "Start your journey — gglearn" };

export default async function Start() {
  await requireUser();
  const all = db.select({ id: tracks.id, name: tracks.name, kind: tracks.kind, description: tracks.description }).from(tracks).orderBy(asc(tracks.name)).all()
    .map((t) => ({ ...t, kindLabel: KIND_LABEL[t.kind] ?? t.kind }));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <JourneySteps at={1} />
      <div>
        <h1 className="text-3xl font-extrabold">What do you want to <span className="gradient-text">master</span>?</h1>
        <p className="mt-1 text-slate-300">Pick a topic, choose your arena, and we will find your starting level, set a finish line and open a live race.</p>
      </div>
      <Begin topics={all} />
    </div>
  );
}

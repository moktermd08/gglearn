import { asc } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { hiddenTrackIds } from "@/lib/tracks";
import { requireUser } from "@/lib/auth";
import { openTo, requirementsFor, scopesOf } from "@/lib/paths";
import { KIND_LABEL } from "@/lib/levels";
import { JourneySteps } from "@/components/JourneySteps";
import { Sparkles } from "lucide-react";
import Begin from "./begin";

export const metadata = { title: "Start your journey — gglearn" };

export default async function Start() {
  const me = await requireUser();
  const hidden = hiddenTrackIds();
  // what this person most likely wants first: what they are required to pass, then tracks made for their job role
  const required = new Set(requirementsFor(me, scopesOf(me.id)).map((r) => r.track.id));
  const role = me.jobRole.trim().toLowerCase();
  const all = db.select({ id: tracks.id, name: tracks.name, kind: tracks.kind, description: tracks.description, audience: tracks.audience, roles: tracks.roles }).from(tracks).orderBy(asc(tracks.name)).all()
    .filter((t) => !hidden.has(t.id) && openTo(me.audience, t.audience))
    .map(({ audience: _a, roles, ...t }) => ({ ...t, kindLabel: KIND_LABEL[t.kind] ?? t.kind, suggested: required.has(t.id) || roles.split(",").some((r) => r.trim().toLowerCase() === role) }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <JourneySteps at={1} />
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Sparkles className="pulse-glow shrink-0 text-yellow-300" />What do you want to <span className="gradient-text">master</span>?</h1>
        <p className="mt-1 text-slate-300">Pick a topic, choose your arena, and we will find your starting level, set a finish line and open a live race.</p>
      </div>
      <Begin topics={all} />
    </div>
  );
}

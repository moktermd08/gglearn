import { asc } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { hiddenTrackIds } from "@/lib/tracks";
import { requireUser } from "@/lib/auth";
import { openTo, requirementsFor, scopesOf } from "@/lib/paths";
import { KIND_LABEL } from "@/lib/levels";
import { JourneySteps } from "@/components/JourneySteps";
import { Sparkles } from "lucide-react";
import { SubjectArt } from "@/components/SubjectArt";
import { rivalFor } from "@/lib/rivals";
import { questions } from "@/lib/db";
import { and, sql } from "drizzle-orm";
import { PageHero } from "@/components/charts";
import Begin from "./begin";

export const metadata = { title: "Start your journey — gglearn" };

export default async function Start() {
  const me = await requireUser();
  const hidden = hiddenTrackIds();
  // what this person most likely wants first: what they are required to pass, then tracks made for their job role
  const required = new Set(requirementsFor(me, scopesOf(me.id)).map((r) => r.track.id));
  const role = me.jobRole.trim().toLowerCase();
  const counts = new Map(db.select({ id: questions.trackId, n: sql<number>`count(*)` }).from(questions).where(and(sql`${questions.status} = 'active'`)).groupBy(questions.trackId).all().map((r) => [r.id, r.n]));
  const all = db.select({ id: tracks.id, slug: tracks.slug, name: tracks.name, kind: tracks.kind, description: tracks.description, audience: tracks.audience, roles: tracks.roles }).from(tracks).orderBy(asc(tracks.name)).all()
    .filter((t) => !hidden.has(t.id) && (counts.get(t.id) ?? 0) > 0 && openTo(me.audience, t.audience)) // a subject with no live questions cannot be started: it would be a dead end
    .map(({ audience: _a, roles, slug, ...t }) => ({ ...t, n: counts.get(t.id) ?? 0, rival: (({ name, tagline, hue }) => ({ name, tagline, hue }))(rivalFor(slug)), icon: <SubjectArt slug={slug} name={t.name} kind={t.kind} size={40} />, bigIcon: <SubjectArt slug={slug} name={t.name} kind={t.kind} size={72} className="shadow-lg" />, kindLabel: KIND_LABEL[t.kind] ?? t.kind, suggested: required.has(t.id) || roles.split(",").some((r) => r.trim().toLowerCase() === role) }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <JourneySteps at={1} />
      <PageHero Icon={Sparkles} tone="violet" title="What do you want to master?" sub="Pick a topic, choose your arena, and we will find your starting level, set a finish line and open a live race." />
      <Begin topics={all} />
    </div>
  );
}

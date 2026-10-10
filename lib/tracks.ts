import { db, tracks } from "@/lib/db";

const subject = (slug: string) => slug.replace(/^foundations-/, "").replace(/-titan$/, "").replace(/[^a-z0-9]/g, "");

/**
 * Older "foundations-*" tracks (the TrialTest import) are hidden from browsing and auto-enrolment once the same
 * subject exists as a "*-titan" track. Nothing is deleted: enrolled learners and direct links keep working.
 */
export function hiddenTrackIds(): Set<number> {
  const all = db.select({ id: tracks.id, slug: tracks.slug }).from(tracks).all();
  const titan = new Set(all.filter((t) => t.slug.endsWith("-titan")).map((t) => subject(t.slug)));
  return new Set(all.filter((t) => t.slug.startsWith("foundations-") && titan.has(subject(t.slug))).map((t) => t.id));
}

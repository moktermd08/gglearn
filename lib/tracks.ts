import { db, tracks } from "@/lib/db";

const subject = (slug: string) => slug.replace(/^foundations-/, "").replace(/-titan$/, "").replace(/[^a-z0-9]/g, "");

/** Tracks replaced by a newer, larger one. Hidden the same way; learners already enrolled keep them. */
const SUPERSEDED = ["chatgpt-titan", "openai-titan", "foundations-chatgpt", "foundations-openai", "foundations-typeacript" /* a second import of TypeScript with a misspelt identifier; foundations-typescript is the larger one */];
/** Seed examples whose description says "replace with real content". Never shown to learners. */
const PLACEHOLDERS = ["sample-brand-sales-basics"];

/**
 * Older "foundations-*" tracks (the TrialTest import) are hidden from browsing and auto-enrolment once the same
 * subject exists as a "*-titan" track. Nothing is deleted: enrolled learners and direct links keep working.
 */
export function hiddenTrackIds(): Set<number> {
  const all = db.select({ id: tracks.id, slug: tracks.slug }).from(tracks).all();
  const titan = new Set(all.filter((t) => t.slug.endsWith("-titan")).map((t) => subject(t.slug)));
  return new Set(all.filter((t) => SUPERSEDED.includes(t.slug) || PLACEHOLDERS.includes(t.slug) || (t.slug.startsWith("foundations-") && titan.has(subject(t.slug)))).map((t) => t.id));
}

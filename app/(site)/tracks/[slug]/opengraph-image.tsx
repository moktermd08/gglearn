import { eq } from "drizzle-orm";
import { db, tracks } from "@/lib/db";
import { artFor } from "@/components/SubjectArt";
import { KIND_LABEL } from "@/lib/levels";
import { isPublicTrack } from "@/lib/publicCatalog";
import { topicLabel } from "@/lib/topicName";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A gglearn topic";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = db.select().from(tracks).where(eq(tracks.slug, (await params).slug)).get();
  // anything that is not public gets the plain brand picture: a company's topic name is never drawn into a preview
  if (!t || !isPublicTrack(t.id)) return ogCard({ kicker: "Learn · Race · Prove it", title: "Climb from Novice to Titan", sub: "Free to start." });
  const color = artFor(t.slug, t.name, t.kind).color;
  return ogCard({ kicker: KIND_LABEL[t.kind] ?? "Topic", title: topicLabel(t.name), sub: "Find your level, race a rival, earn certificates.", from: color, to: "#1e1b4b" });
}

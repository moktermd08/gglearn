import { eq } from "drizzle-orm";
import { competitions, db, tracks } from "@/lib/db";
import { topicLabel } from "@/lib/topicName";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A gglearn race";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = db.select().from(competitions).where(eq(competitions.slug, (await params).slug)).get();
  // a private race's name never appears in a preview
  if (!c || c.visibility !== "public") return ogCard({ kicker: "You are invited to race", title: "Join a race on gglearn", sub: "Climb a live leaderboard with friends." });
  const t = db.select({ name: tracks.name }).from(tracks).where(eq(tracks.id, c.trackId)).get();
  return ogCard({ kicker: "Race", title: c.title, sub: `Gain ${c.goalLevels} level${c.goalLevels === 1 ? "" : "s"} in ${t ? topicLabel(t.name) : "this topic"}. Open to watch and join.`, from: "#db2777", to: "#4f46e5" });
}

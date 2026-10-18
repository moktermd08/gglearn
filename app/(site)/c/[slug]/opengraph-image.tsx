import { entryOf } from "@/lib/entry";
import { darken } from "@/lib/brand";
import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A learning academy on gglearn";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const e = entryOf((await params).slug);
  if (!e) return ogCard({ kicker: "Learn · Race · Prove it", title: "Climb from Novice to Titan", sub: "Free to start." });
  const from = e.look.accent ?? "#4f46e5";
  return ogCard({ kicker: e.company.name, title: e.look.name, sub: e.company.entryText || "Learn, take exams and earn certificates. Free to join.", from, to: darken(from, 0.4) });
}

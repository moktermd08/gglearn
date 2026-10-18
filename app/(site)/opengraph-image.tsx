import { ogCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "gglearn: learn, race and prove it";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ kicker: "Learn · Race · Prove it", title: "Climb from Novice to Titan", sub: "Learn alone, race friends, or train a whole team. Free to start." });
}

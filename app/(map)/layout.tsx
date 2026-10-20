import type { Metadata } from "next";
import "../globals.css";
import { currentUser } from "@/lib/auth";
import { lookFor, themeStyle } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Find your stop, plan your route: the software lifecycle map — gglearn",
  description: "Every stage from first idea to final shutdown, drawn as a transit map. Say what you do or where your company is, see your route, and learn each stop.",
};

/** The map is its own root layout (app/(map)): a single full-screen page with no site header or footer. */
export default async function MapLayout({ children }: { children: React.ReactNode }) {
  const look = lookFor((await currentUser())?.id);
  return (
    <html lang="en" style={themeStyle(look) as React.CSSProperties | undefined}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

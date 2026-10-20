import type { Metadata } from "next";
import "../globals.css";
import { currentUser } from "@/lib/auth";
import { lookFor, themeStyle } from "@/lib/brand";
import { DEFAULT_MAP, MAPS } from "@/lib/lifecycle/maps";

export const metadata: Metadata = {
  // the fallback; each map page sets its own (app/(map)/map/mapPage.tsx)
  title: MAPS[DEFAULT_MAP].words.metaTitle,
  description: MAPS[DEFAULT_MAP].words.metaDescription,
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

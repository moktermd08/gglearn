import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { competitions, db } from "@/lib/db";
import { baseUrl, publicTracks } from "@/lib/publicCatalog";
import { entryCompanies } from "@/lib/entry";

// built from the database on each request, so new topics and campaigns appear without a redeploy
export const dynamic = "force-dynamic";

/** Only pages a stranger can open and that say something on their own: the front page, the lists, public topics and public races. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl(), at = (p: string) => `${base}${p}`;
  const pages: MetadataRoute.Sitemap = [
    { url: at("/"), changeFrequency: "daily", priority: 1 },
    { url: at("/signup"), changeFrequency: "monthly", priority: 0.8 },
    { url: at("/try"), changeFrequency: "weekly", priority: 0.8 },
    { url: at("/campaigns"), changeFrequency: "daily", priority: 0.9 },
    { url: at("/competitions"), changeFrequency: "daily", priority: 0.8 },
    { url: at("/map"), changeFrequency: "monthly", priority: 0.5 },
    { url: at("/map/software"), changeFrequency: "monthly", priority: 0.4 },
  ];
  for (const c of entryCompanies()) pages.push({ url: at(`/c/${c.slug}`), changeFrequency: "weekly", priority: 0.7 }); // companies that opened a public page
  for (const { track } of publicTracks()) pages.push({ url: at(`/tracks/${track.slug}`), changeFrequency: "weekly", priority: 0.7 });
  for (const c of db.select({ slug: competitions.slug, endsAt: competitions.endsAt }).from(competitions)
    .where(and(eq(competitions.visibility, "public"), isNull(competitions.canceledAt))).all()) {
    pages.push({ url: at(`/competitions/${c.slug}`), lastModified: new Date(Math.min(c.endsAt, Math.floor(Date.now() / 1000)) * 1000), changeFrequency: "daily", priority: 0.6 });
  }
  return pages;
}

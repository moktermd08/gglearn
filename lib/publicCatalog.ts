import { eq, sql } from "drizzle-orm";
import { brands, db, questions, tracks } from "@/lib/db";
import { hiddenTrackIds } from "@/lib/tracks";

/**
 * Which topics a stranger may see, and search engines may list: ones with live questions that are not retired, and that are either
 * shared academy topics or made for customers. A company's own staff material (its brand is not "shared") stays behind sign-in, the same
 * rule a race invite link uses (lib/guestLink.ts, guestAudience).
 */
export function publicTracks() {
  const hidden = hiddenTrackIds();
  return db
    .select({ track: tracks, brand: brands, n: sql<number>`(select count(*) from ${questions} q where q.track_id = ${tracks.id} and q.status = 'active')` })
    .from(tracks).innerJoin(brands, eq(brands.id, tracks.brandId)).all()
    .filter((r) => r.n > 0 && !hidden.has(r.track.id) && (r.track.audience !== "staff" || r.brand.kind === "shared"));
}

export function isPublicTrack(trackId: number): boolean {
  return publicTracks().some((r) => r.track.id === trackId);
}

/** The address search engines and previews should use. Set SITE_URL in production; the local address is only a development fallback. */
export const baseUrl = () => (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

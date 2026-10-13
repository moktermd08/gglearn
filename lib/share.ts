import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, seasonResults, shareCards } from "@/lib/db";
import { periodByKey, shortName, type Kind } from "@/lib/seasons";
import { progressionFor } from "@/lib/progression";

export type ShareKind = (typeof shareCards.$inferSelect)["kind"];
export type Snapshot = Pick<typeof shareCards.$inferInsert, "kind" | "ref" | "headline" | "title" | "subtitle" | "tone" | "name">;

/** Colours for the card, by tone. */
export const TONES: Record<string, { from: string; to: string; ink: string }> = {
  bronze: { from: "#f59e0b", to: "#b45309", ink: "#fff7ed" },
  silver: { from: "#94a3b8", to: "#475569", ink: "#f8fafc" },
  gold: { from: "#fbbf24", to: "#d97706", ink: "#fffbeb" },
  legend: { from: "#d946ef", to: "#6d28d9", ink: "#fdf4ff" },
  indigo: { from: "#6366f1", to: "#9333ea", ink: "#eef2ff" },
  orange: { from: "#fb923c", to: "#dc2626", ink: "#fff7ed" },
};

const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold", legend: "Legend" } as const;

/** Where the app is served from, for absolute links in previews. Set SITE_URL in production; otherwise the request's own host is used. */
export async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers(), host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/**
 * What a share card says, rebuilt from real data every time. Never trusts the browser: a card only exists for something the
 * person has actually earned. Returns null when the thing does not exist or is not earned yet.
 */
export function snapshotFor(me: { id: number; name: string }, kind: ShareKind, ref: string): Snapshot | null {
  const name = shortName(me.name);
  if (kind === "level") {
    const { player } = progressionFor(me.id);
    return { kind, ref: "level", headline: `Level ${player.level}`, title: `${player.title} on gglearn`, subtitle: `${player.xp.toLocaleString("en-GB")} XP earned by passing real exams`, tone: "indigo", name };
  }
  if (kind === "streak") {
    const { streak } = progressionFor(me.id);
    return streak.longest >= 3 ? { kind, ref: "streak", headline: `${streak.longest} days`, title: "Longest learning streak", subtitle: "Learning on gglearn, day after day", tone: "orange", name } : null;
  }
  if (kind === "badge") {
    const b = progressionFor(me.id).badges.find((x) => x.key === ref && x.earned);
    return b ? { kind, ref, headline: TIER_LABEL[b.tier], title: b.name, subtitle: b.desc, tone: b.tier, name } : null;
  }
  const [k, key] = ref.split(":");
  if ((k !== "week" && k !== "month") || !key) return null;
  const r = db.select().from(seasonResults).where(and(eq(seasonResults.userId, me.id), eq(seasonResults.kind, k as Kind), eq(seasonResults.key, key))).get();
  if (!r) return null;
  const label = periodByKey(k as Kind, key)?.label.replace(/ · from.*/, "") ?? (k === "week" ? `Week ${key.slice(5)}, ${key.slice(0, 4)}` : key);
  return { kind, ref, headline: `#${r.rank}`, title: `${k === "week" ? "Weekly" : "Monthly"} season: ${label}`, subtitle: `Out of ${r.players} players, with ${r.points} points`, tone: r.rank === 1 ? "gold" : r.rank === 2 ? "silver" : r.rank === 3 ? "bronze" : "indigo", name };
}

import { and, eq, like, sql } from "drizzle-orm";
import { competitionMembers, competitions, db, tracks } from "@/lib/db";
import { campaigns, type Campaign } from "@/content/campaigns";
import { stateOf, type State } from "@/lib/competitions";

export type RewardKind = "cash" | "voucher" | "certificate";
export type CampaignView = Campaign & {
  slug: string; trackName: string; trackKind: string; state: State | "soon"; humans: number; endsAt: number | null;
  rewardKind: RewardKind; headline: string;
};

export const SETS = { career: "Careers", general: "General", ai: "AI" } as const;
export type SetKey = keyof typeof SETS;

export function rewardKind(r: Campaign["reward"]): RewardKind {
  return r.cash > 0 ? "cash" : /Amazon voucher/.test(r.note) ? "voucher" : "certificate";
}

/** Short reward line for a card: the best thing you can win, certificates being the floor for everyone. */
function headline(r: Campaign["reward"]): string {
  if (r.cash > 0) return `$${r.cash / 100} prize pool`;
  const v = /\$(\d+) Amazon voucher/.exec(r.note);
  return v ? `$${v[1]} Amazon voucher` : "Certificate";
}

/** The catalogue joined with its contest row. Campaigns not yet seeded show as "soon" and are not linked. */
export function campaignViews(): CampaignView[] {
  const rows = db.select({ c: competitions, trackName: tracks.name, trackKind: tracks.kind }).from(competitions)
    .innerJoin(tracks, eq(tracks.id, competitions.trackId)).where(like(competitions.slug, "camp-%")).all();
  const bySlug = new Map(rows.map((r) => [r.c.slug, r]));
  const counts = new Map(db.select({ id: competitionMembers.competitionId, n: sql<number>`count(*)` }).from(competitionMembers)
    .where(and(eq(competitionMembers.kind, "human"), eq(competitionMembers.status, "joined"))).groupBy(competitionMembers.competitionId).all().map((r) => [r.id, r.n]));
  const trackNames = new Map(db.select({ slug: tracks.slug, name: tracks.name, kind: tracks.kind }).from(tracks).all().map((t) => [t.slug, t]));
  return campaigns.map((c) => {
    const slug = `camp-${c.id}`, row = bySlug.get(slug), t = trackNames.get(c.track);
    return {
      ...c, slug, trackName: row?.trackName ?? t?.name ?? c.track, trackKind: row?.trackKind ?? t?.kind ?? "subject",
      state: row ? stateOf(row.c) : "soon", humans: row ? counts.get(row.c.id) ?? 0 : 0, endsAt: row?.c.endsAt ?? null,
      rewardKind: rewardKind(c.reward), headline: headline(c.reward),
    };
  });
}
